import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import { test } from "node:test";
import {
  createMonitorHandlers,
  pairNetworkGaps,
} from "../src/controllers/monitor.controller.js";

const ownerId = "00000000-0000-4000-8000-000000000010";
const otherExaminerId = "00000000-0000-4000-8000-000000000011";
const examId = "00000000-0000-4000-8000-000000000020";
const candidateA = "00000000-0000-4000-8000-000000000030";
const candidateB = "00000000-0000-4000-8000-000000000031";
const attemptA = "00000000-0000-4000-8000-000000000040";
const attemptB = "00000000-0000-4000-8000-000000000041";

function createFixture() {
  const state = {
    exams: [
      {
        id: examId,
        ownerId,
        durationMinutes: 90,
        endsAt: new Date("2026-03-01T14:00:00.000Z"),
      },
    ],
    attempts: [],
  };

  const users = {
    [candidateA]: {
      id: candidateA,
      fullName: "Alice Candidate",
      email: "alice@example.com",
    },
    [candidateB]: {
      id: candidateB,
      fullName: "Bob Candidate",
      email: "bob@example.com",
    },
  };

  const db = {
    exam: {
      async findFirst({ where, select }) {
        const exam = state.exams.find(
          (row) => row.id === where.id && row.ownerId === where.ownerId,
        );
        if (!exam) return null;
        if (!select) return exam;
        return Object.fromEntries(
          Object.keys(select).map((key) => [key, exam[key]]),
        );
      },
    },
    examAttempt: {
      async findMany({ where, select }) {
        let rows = state.attempts.filter((row) => row.examId === where.examId);
        if (where.mode) {
          rows = rows.filter((row) => row.mode === where.mode);
        }

        return rows.map((row) => {
          const networkTypes = select?.events?.where?.type?.in;
          let events = row.events ?? [];
          if (Array.isArray(networkTypes)) {
            events = events.filter((event) => networkTypes.includes(event.type));
          }
          events = [...events].sort(
            (a, b) =>
              new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
          );

          return {
            id: row.id,
            status: row.status,
            startedAt: row.startedAt,
            expiresAt: row.expiresAt,
            participant: users[row.participantId],
            events: events.map((event) => ({
              id: event.id,
              type: event.type,
              occurredAt: event.occurredAt,
            })),
          };
        });
      },
    },
  };

  return { db, state };
}

function createApp({ db, userId = ownerId }) {
  const { listExamDisruptions } = createMonitorHandlers(db);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: userId, role: "EXAMINER" };
    next();
  });
  app.get("/exams/:examId/disruptions", listExamDisruptions);
  return app;
}

async function listen(app) {
  const server = app.listen(0);
  await once(server, "listening");
  const { port } = server.address();
  return { server, url: `http://127.0.0.1:${port}` };
}

test("pairNetworkGaps closes a complete disconnect/restoration pair", () => {
  const gaps = pairNetworkGaps(
    [
      {
        id: "d1",
        type: "NETWORK_DISCONNECTED",
        occurredAt: "2026-03-01T12:00:00.000Z",
      },
      {
        id: "r1",
        type: "NETWORK_RESTORED",
        occurredAt: "2026-03-01T12:02:00.000Z",
      },
    ],
    new Date("2026-03-01T12:10:00.000Z"),
  );

  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].id, "d1");
  assert.equal(gaps[0].from, "2026-03-01T12:00:00.000Z");
  assert.equal(gaps[0].to, "2026-03-01T12:02:00.000Z");
  assert.equal(gaps[0].ongoing, false);
  assert.equal(gaps[0].seconds, 120);
});

test("pairNetworkGaps keeps unresolved disconnects open", () => {
  const now = new Date("2026-03-01T12:05:00.000Z");
  const gaps = pairNetworkGaps(
    [
      {
        id: "d1",
        type: "NETWORK_DISCONNECTED",
        occurredAt: "2026-03-01T12:00:00.000Z",
      },
    ],
    now,
  );

  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].to, null);
  assert.equal(gaps[0].ongoing, true);
  assert.equal(gaps[0].seconds, 300);
});

test("pairNetworkGaps supports multiple disconnect/restoration cycles", () => {
  const gaps = pairNetworkGaps(
    [
      {
        id: "d1",
        type: "NETWORK_DISCONNECTED",
        occurredAt: "2026-03-01T12:00:00.000Z",
      },
      {
        id: "r1",
        type: "NETWORK_RESTORED",
        occurredAt: "2026-03-01T12:01:00.000Z",
      },
      {
        id: "d2",
        type: "NETWORK_DISCONNECTED",
        occurredAt: "2026-03-01T12:10:00.000Z",
      },
      {
        id: "r2",
        type: "NETWORK_RESTORED",
        occurredAt: "2026-03-01T12:12:30.000Z",
      },
    ],
    new Date("2026-03-01T13:00:00.000Z"),
  );

  assert.equal(gaps.length, 2);
  assert.equal(gaps[0].seconds, 60);
  assert.equal(gaps[1].seconds, 150);
  assert.equal(gaps[1].id, "d2");
});

test("lists disruptions per attempt and ignores unrelated events", async () => {
  const { db, state } = createFixture();
  state.attempts.push(
    {
      id: attemptA,
      examId,
      participantId: candidateA,
      mode: "OFFICIAL",
      status: "IN_PROGRESS",
      startedAt: new Date("2026-03-01T11:00:00.000Z"),
      expiresAt: new Date("2026-03-01T12:30:00.000Z"),
      events: [
        {
          id: "noise-1",
          type: "TAB_HIDDEN",
          occurredAt: "2026-03-01T11:30:00.000Z",
        },
        {
          id: "d-a",
          type: "NETWORK_DISCONNECTED",
          occurredAt: "2026-03-01T11:40:00.000Z",
        },
        {
          id: "noise-2",
          type: "ANSWER_SAVE_SUCCEEDED",
          occurredAt: "2026-03-01T11:41:00.000Z",
        },
        {
          id: "r-a",
          type: "NETWORK_RESTORED",
          occurredAt: "2026-03-01T11:42:00.000Z",
        },
      ],
    },
    {
      id: attemptB,
      examId,
      participantId: candidateB,
      mode: "OFFICIAL",
      status: "IN_PROGRESS",
      startedAt: new Date("2026-03-01T11:05:00.000Z"),
      expiresAt: new Date("2026-03-01T12:35:00.000Z"),
      events: [
        {
          id: "d-b",
          type: "NETWORK_DISCONNECTED",
          occurredAt: "2026-03-01T11:50:00.000Z",
        },
      ],
    },
  );

  const app = createApp({ db });
  const { server, url } = await listen(app);

  try {
    const response = await fetch(`${url}/exams/${examId}/disruptions`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.ok(body.policy);
    assert.equal(body.attempts.length, 2);

    const alice = body.attempts.find((row) => row.attemptId === attemptA);
    const bob = body.attempts.find((row) => row.attemptId === attemptB);

    assert.equal(alice.gaps.length, 1);
    assert.equal(alice.gaps[0].seconds, 120);
    assert.equal(alice.gaps[0].ongoing, false);
    assert.equal(alice.candidate.name, "Alice Candidate");
    assert.equal(alice.compensationMinutes, 0);
    assert.deepEqual(alice.compensations, []);

    assert.equal(bob.gaps.length, 1);
    assert.equal(bob.gaps[0].ongoing, true);
    assert.equal(bob.gaps[0].to, null);

    // Sorted by totalGapSeconds descending — Bob's open gap may be longer depending on now.
    assert.ok(body.attempts[0].totalGapSeconds >= body.attempts[1].totalGapSeconds);
  } finally {
    server.close();
  }
});

test("returns empty attempts for an owned exam with no attempts", async () => {
  const { db } = createFixture();
  const app = createApp({ db });
  const { server, url } = await listen(app);

  try {
    const response = await fetch(`${url}/exams/${examId}/disruptions`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.attempts, []);
  } finally {
    server.close();
  }
});

test("returns 404 when the exam is not owned by the examiner", async () => {
  const { db } = createFixture();
  const app = createApp({ db, userId: otherExaminerId });
  const { server, url } = await listen(app);

  try {
    const response = await fetch(`${url}/exams/${examId}/disruptions`);
    assert.equal(response.status, 404);
  } finally {
    server.close();
  }
});
