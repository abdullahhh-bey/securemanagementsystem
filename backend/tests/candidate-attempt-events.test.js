import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import { test } from "node:test";
import { createCandidateEventHandlers } from "../src/controllers/candidate-event.controller.js";

const candidateId = "00000000-0000-4000-8000-000000000040";
const otherCandidateId = "00000000-0000-4000-8000-000000000041";
const attemptId = "00000000-0000-4000-8000-000000000050";

function createFixture({ status = "IN_PROGRESS", ownerId = candidateId } = {}) {
  const state = {
    attempts: [
      {
        id: attemptId,
        participantId: ownerId,
        mode: "OFFICIAL",
        status,
        lastActivityAt: new Date("2026-03-01T10:00:00.000Z"),
      },
    ],
    events: [],
  };

  const db = {
    async $transaction(fn) {
      return fn(db);
    },
    examAttempt: {
      async findFirst({ where, select }) {
        const attempt = state.attempts.find(
          (row) =>
            row.id === where.id &&
            row.participantId === where.participantId &&
            (!where.mode || row.mode === where.mode),
        );
        if (!attempt) return null;
        if (!select) return attempt;
        return Object.fromEntries(
          Object.keys(select).map((key) => [key, attempt[key]]),
        );
      },
      async update({ where, data }) {
        const attempt = state.attempts.find((row) => row.id === where.id);
        Object.assign(attempt, data);
        return attempt;
      },
    },
    attemptEvent: {
      async create({ data }) {
        const event = {
          id: `ev-${state.events.length + 1}`,
          reviewStatus: "UNREVIEWED",
          ...data,
        };
        state.events.push(event);
        return event;
      },
    },
  };

  return { db, state };
}

function createApp({ db, userId = candidateId }) {
  const { reportAttemptEvent } = createCandidateEventHandlers(db);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: userId, role: "CANDIDATE" };
    next();
  });
  app.post("/attempts/:attemptId/events", reportAttemptEvent);
  return app;
}

async function listen(app) {
  const server = app.listen(0);
  await once(server, "listening");
  const { port } = server.address();
  return { server, url: `http://127.0.0.1:${port}` };
}

test("records a valid attempt event and refreshes lastActivityAt", async () => {
  const { db, state } = createFixture();
  const app = createApp({ db });
  const { server, url } = await listen(app);

  try {
    const response = await fetch(`${url}/attempts/${attemptId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "TAB_HIDDEN",
        metadata: { reason: "visibilitychange" },
      }),
    });
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.event.type, "TAB_HIDDEN");
    assert.ok(body.event.id);
    assert.ok(body.event.occurredAt);
    assert.deepEqual(body.event.metadata, { reason: "visibilitychange" });
    assert.equal(state.events.length, 1);
    assert.ok(
      new Date(state.attempts[0].lastActivityAt).getTime() >
        new Date("2026-03-01T10:00:00.000Z").getTime(),
    );
  } finally {
    server.close();
  }
});

test("rejects invalid event types", async () => {
  const { db, state } = createFixture();
  const app = createApp({ db });
  const { server, url } = await listen(app);

  try {
    const response = await fetch(`${url}/attempts/${attemptId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "FULLSCREEN_EXIT" }),
    });
    assert.equal(response.status, 400);
    assert.equal(state.events.length, 0);
  } finally {
    server.close();
  }
});

test("returns 404 when the attempt belongs to another candidate", async () => {
  const { db, state } = createFixture();
  const app = createApp({ db, userId: otherCandidateId });
  const { server, url } = await listen(app);

  try {
    const response = await fetch(`${url}/attempts/${attemptId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "WINDOW_BLURRED" }),
    });
    assert.equal(response.status, 404);
    assert.equal(state.events.length, 0);
  } finally {
    server.close();
  }
});

test("rejects events when the attempt is not IN_PROGRESS", async () => {
  const { db, state } = createFixture({ status: "SUBMITTED" });
  const app = createApp({ db });
  const { server, url } = await listen(app);

  try {
    const response = await fetch(`${url}/attempts/${attemptId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "ATTEMPT_RESUMED" }),
    });
    assert.equal(response.status, 400);
    assert.equal(state.events.length, 0);
  } finally {
    server.close();
  }
});
