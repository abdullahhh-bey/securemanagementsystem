import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import { test } from "node:test";
import { createCandidateWorkspaceHandlers } from "../src/controllers/candidate-workspace.controller.js";

const candidateId = "00000000-0000-4000-8000-000000000040";
const otherCandidateId = "00000000-0000-4000-8000-000000000041";
const attemptId = "00000000-0000-4000-8000-000000000050";

function createFixture({ status = "IN_PROGRESS", mode = "OFFICIAL", ownerId = candidateId } = {}) {
  const state = {
    preferences: new Map(),
    scratchpads: new Map(),
    attempt: { id: attemptId, participantId: ownerId, mode, status },
  };
  const db = {
    async $transaction(callback) {
      return callback(db);
    },
    candidatePreference: {
      async findUnique({ where }) {
        const preferences = state.preferences.get(where.userId);
        return preferences ? { preferences } : null;
      },
      async upsert({ where, create, update }) {
        const preferences = state.preferences.has(where.userId)
          ? update.preferences
          : create.preferences;
        state.preferences.set(where.userId, preferences);
        return { preferences };
      },
    },
    examAttempt: {
      async findFirst({ where, select }) {
        const matches =
          state.attempt.id === where.id &&
          state.attempt.participantId === where.participantId &&
          (!where.mode || state.attempt.mode === where.mode);
        if (!matches) return null;
        return Object.fromEntries(
          Object.keys(select).map((key) => [key, state.attempt[key]]),
        );
      },
    },
    attemptScratchpad: {
      async findUnique({ where }) {
        const scratchpad = state.scratchpads.get(where.attemptId);
        return scratchpad ? { ...scratchpad } : null;
      },
      async upsert({ where, create, update }) {
        const scratchpad = {
          content: state.scratchpads.has(where.attemptId)
            ? update.content
            : create.content,
          updatedAt: new Date("2026-03-01T10:00:00.000Z"),
        };
        state.scratchpads.set(where.attemptId, scratchpad);
        return { ...scratchpad };
      },
    },
  };
  return { db, state };
}

function createApp({ db, userId = candidateId } = {}) {
  const handlers = createCandidateWorkspaceHandlers(db);
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    if (!userId) return res.status(401).json({ success: false });
    req.user = { id: userId, role: "CANDIDATE" };
    return next();
  });
  app.get("/preferences", handlers.getPreferences);
  app.patch("/preferences", handlers.updatePreferences);
  app.get("/attempts/:attemptId/scratchpad", handlers.getScratchpad);
  app.put("/attempts/:attemptId/scratchpad", handlers.saveScratchpad);
  return app;
}

async function listen(app) {
  const server = app.listen(0);
  await once(server, "listening");
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

test("candidate display preferences default, persist, and merge partial updates", async () => {
  const { db, state } = createFixture();
  const app = createApp({ db });
  const { server, url } = await listen(app);

  try {
    const defaults = await fetch(`${url}/preferences`).then((response) =>
      response.json(),
    );
    assert.deepEqual(defaults.preferences, {
      textSize: "medium",
      contrast: "standard",
      lineSpacing: "standard",
    });

    const updated = await fetch(`${url}/preferences`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ textSize: "large" }),
    }).then((response) => response.json());
    assert.deepEqual(updated.preferences, {
      textSize: "large",
      contrast: "standard",
      lineSpacing: "standard",
    });
    assert.deepEqual(state.preferences.get(candidateId), updated.preferences);
  } finally {
    server.close();
  }
});

test("candidate preference validation rejects unknown and invalid values", async () => {
  const { db, state } = createFixture();
  const app = createApp({ db });
  const { server, url } = await listen(app);

  try {
    const invalid = await fetch(`${url}/preferences`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contrast: "inverted", userId: otherCandidateId }),
    });
    assert.equal(invalid.status, 400);
    assert.equal(state.preferences.size, 0);
  } finally {
    server.close();
  }
});

test("candidate preferences are returned only for the authenticated candidate", async () => {
  const { db } = createFixture();
  const ownerApp = createApp({ db });
  const ownerServer = await listen(ownerApp);
  const otherApp = createApp({ db, userId: otherCandidateId });
  const otherServer = await listen(otherApp);

  try {
    await fetch(`${ownerServer.url}/preferences`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contrast: "high" }),
    });

    const otherPreferences = await fetch(`${otherServer.url}/preferences`).then(
      (response) => response.json(),
    );
    assert.equal(otherPreferences.preferences.contrast, "standard");
  } finally {
    ownerServer.server.close();
    otherServer.server.close();
  }
});

test("scratchpad is private to its candidate and persists only as scratchpad content", async () => {
  const { db, state } = createFixture();
  const app = createApp({ db });
  const { server, url } = await listen(app);

  try {
    const saved = await fetch(`${url}/attempts/${attemptId}/scratchpad`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "private calculations" }),
    });
    assert.equal(saved.status, 200);
    assert.deepEqual(state.scratchpads.get(attemptId).content, "private calculations");

    const otherCandidate = createApp({ db, userId: otherCandidateId });
    const otherServer = await listen(otherCandidate);
    try {
      const privateResponse = await fetch(
        `${otherServer.url}/attempts/${attemptId}/scratchpad`,
      );
      assert.equal(privateResponse.status, 404);
    } finally {
      otherServer.server.close();
    }

    const restored = await fetch(`${url}/attempts/${attemptId}/scratchpad`).then(
      (response) => response.json(),
    );
    assert.equal(restored.scratchpad.content, "private calculations");
    assert.equal("textResponse" in restored.scratchpad, false);
  } finally {
    server.close();
  }
});

test("sandbox attempt scratchpads are not accessible through the official scratchpad API", async () => {
  const { db } = createFixture({ mode: "SANDBOX" });
  const app = createApp({ db });
  const { server, url } = await listen(app);

  try {
    const response = await fetch(`${url}/attempts/${attemptId}/scratchpad`);
    assert.equal(response.status, 404);
  } finally {
    server.close();
  }
});

test("scratchpad rejects oversized content and cannot be changed after submission", async () => {
  const { db, state } = createFixture();
  const app = createApp({ db });
  const { server, url } = await listen(app);

  try {
    const oversized = await fetch(`${url}/attempts/${attemptId}/scratchpad`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "x".repeat(20001) }),
    });
    assert.equal(oversized.status, 400);

    state.attempt.status = "SUBMITTED";
    const inactive = await fetch(`${url}/attempts/${attemptId}/scratchpad`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "late update" }),
    });
    assert.equal(inactive.status, 409);
    assert.equal(state.scratchpads.size, 0);
  } finally {
    server.close();
  }
});

test("candidate workspace endpoints require an authenticated candidate", async () => {
  const { db } = createFixture();
  const app = createApp({ db, userId: null });
  const { server, url } = await listen(app);

  try {
    const response = await fetch(`${url}/preferences`);
    assert.equal(response.status, 401);
  } finally {
    server.close();
  }
});
