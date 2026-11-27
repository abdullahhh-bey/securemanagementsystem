import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import { test } from "node:test";
import {
  MONITOR_INACTIVITY_MS,
  createMonitorHandlers,
  deriveMonitorConnection,
} from "../src/controllers/monitor.controller.js";

const ownerId = "00000000-0000-4000-8000-000000000010";
const otherExaminerId = "00000000-0000-4000-8000-000000000011";
const examId = "00000000-0000-4000-8000-000000000020";
const candidateA = "00000000-0000-4000-8000-000000000030";
const candidateB = "00000000-0000-4000-8000-000000000031";

function createFixture() {
  const state = {
    exams: [{ id: examId, ownerId, title: "Networks Midterm" }],
    enrollments: [
      { id: "en-1", examId, candidateId: candidateA, status: "ENROLLED" },
      { id: "en-2", examId, candidateId: candidateB, status: "ENROLLED" },
      {
        id: "en-3",
        examId,
        candidateId: "00000000-0000-4000-8000-000000000032",
        status: "WITHDRAWN",
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
    examEnrollment: {
      async count({ where }) {
        return state.enrollments.filter(
          (row) =>
            row.examId === where.examId &&
            (!where.status || row.status === where.status),
        ).length;
      },
    },
    examAttempt: {
      async findMany({ where, select }) {
        let rows = state.attempts.filter((row) => row.examId === where.examId);
        if (where.mode) {
          rows = rows.filter((row) => row.mode === where.mode);
        }

        return rows.map((row) => {
          const answeredIds = (row.questions ?? [])
            .filter((q) => q.answer?.status === "ANSWERED")
            .map((q) => ({ id: q.id }));

          return {
            id: row.id,
            status: row.status,
            startedAt: row.startedAt,
            expiresAt: row.expiresAt,
            submittedAt: row.submittedAt ?? null,
            lastActivityAt: row.lastActivityAt,
            participant: users[row.participantId] ?? {
              id: row.participantId,
              fullName: "",
              email: "",
            },
            questions: answeredIds,
            _count: {
              questions: (row.questions ?? []).length,
              events: (row.events ?? []).length,
            },
          };
        });
      },
    },
  };

  return { db, state };
}

function createApp({ db, userId = ownerId }) {
  const { getExamMonitor } = createMonitorHandlers(db);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: userId, role: "EXAMINER" };
    next();
  });
  app.get("/exams/:examId/monitor", getExamMonitor);
  return app;
}

async function listen(app) {
  const server = app.listen(0);
  await once(server, "listening");
  const { port } = server.address();
  return { server, url: `http://127.0.0.1:${port}` };
}

test("deriveMonitorConnection uses inactivity threshold for IN_PROGRESS", () => {
  const now = new Date("2026-03-01T12:00:00.000Z");
  assert.equal(
    deriveMonitorConnection(
      {
        status: "IN_PROGRESS",
        lastActivityAt: new Date(now.getTime() - 30_000),
      },
      now,
    ),
    "ONLINE",
  );
  assert.equal(
    deriveMonitorConnection(
      {
        status: "IN_PROGRESS",
        lastActivityAt: new Date(now.getTime() - MONITOR_INACTIVITY_MS - 1),
      },
      now,
    ),
    "OFFLINE",
  );
  assert.equal(
    deriveMonitorConnection(
      { status: "SUBMITTED", lastActivityAt: now },
      now,
    ),
    "ENDED",
  );
});

test("returns empty attempts with enrolled summary when nobody has started", async () => {
  const { db } = createFixture();
  const app = createApp({ db });
  const { server, url } = await listen(app);

  try {
    const response = await fetch(`${url}/exams/${examId}/monitor`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.ok(body.serverTime);
    assert.deepEqual(body.attempts, []);
    assert.equal(body.summary.enrolled, 2);
    assert.equal(body.summary.started, 0);
    assert.equal(body.summary.notStarted, 2);
    assert.equal(body.summary.online, 0);
    assert.equal(body.summary.offline, 0);
    assert.equal(body.summary.incidents, 0);
  } finally {
    server.close();
  }
});

test("derives progress, status, incident count, and connection", async () => {
  const { db, state } = createFixture();
  const now = Date.now();
  state.attempts.push(
    {
      id: "att-1",
      examId,
      participantId: candidateA,
      mode: "OFFICIAL",
      status: "IN_PROGRESS",
      startedAt: new Date(now - 10 * 60_000).toISOString(),
      expiresAt: new Date(now + 50 * 60_000).toISOString(),
      lastActivityAt: new Date(now - 15_000).toISOString(),
      questions: [
        { id: "aq-1", answer: { status: "ANSWERED" } },
        { id: "aq-2", answer: { status: "UNANSWERED" } },
        { id: "aq-3", answer: null },
        { id: "aq-4", answer: { status: "ANSWERED" } },
      ],
      events: [{ id: "ev-1" }, { id: "ev-2" }, { id: "ev-3" }],
    },
    {
      id: "att-2",
      examId,
      participantId: candidateB,
      mode: "OFFICIAL",
      status: "SUBMITTED",
      startedAt: new Date(now - 70 * 60_000).toISOString(),
      expiresAt: new Date(now - 10 * 60_000).toISOString(),
      submittedAt: new Date(now - 12 * 60_000).toISOString(),
      lastActivityAt: new Date(now - 12 * 60_000).toISOString(),
      questions: [
        { id: "bq-1", answer: { status: "ANSWERED" } },
        { id: "bq-2", answer: { status: "ANSWERED" } },
      ],
      events: [],
    },
    {
      id: "att-sandbox",
      examId,
      participantId: candidateA,
      mode: "SANDBOX",
      status: "IN_PROGRESS",
      startedAt: new Date(now - 5 * 60_000).toISOString(),
      expiresAt: new Date(now + 55 * 60_000).toISOString(),
      lastActivityAt: new Date().toISOString(),
      questions: [{ id: "sq-1", answer: { status: "ANSWERED" } }],
      events: [{ id: "sev-1" }],
    },
  );

  const app = createApp({ db });
  const { server, url } = await listen(app);

  try {
    const response = await fetch(`${url}/exams/${examId}/monitor`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.attempts.length, 2);

    const alice = body.attempts.find((row) => row.candidate.id === candidateA);
    const bob = body.attempts.find((row) => row.candidate.id === candidateB);

    assert.equal(alice.status, "IN_PROGRESS");
    assert.equal(alice.answered, 2);
    assert.equal(alice.total, 4);
    assert.equal(alice.progressPercent, 50);
    assert.equal(alice.incidentCount, 3);
    assert.equal(alice.connection, "ONLINE");
    assert.equal(alice.compensationMinutes, 0);
    assert.ok(alice.personalDeadline);

    assert.equal(bob.status, "SUBMITTED");
    assert.equal(bob.answered, 2);
    assert.equal(bob.total, 2);
    assert.equal(bob.progressPercent, 100);
    assert.equal(bob.incidentCount, 0);
    assert.equal(bob.connection, "ENDED");

    assert.equal(body.summary.enrolled, 2);
    assert.equal(body.summary.started, 2);
    assert.equal(body.summary.notStarted, 0);
    assert.equal(body.summary.online, 1);
    assert.equal(body.summary.offline, 0);
    assert.equal(body.summary.incidents, 3);
  } finally {
    server.close();
  }
});

test("returns 404 when the exam is not owned by the examiner", async () => {
  const { db } = createFixture();
  const app = createApp({ db, userId: otherExaminerId });
  const { server, url } = await listen(app);

  try {
    const response = await fetch(`${url}/exams/${examId}/monitor`);
    assert.equal(response.status, 404);
  } finally {
    server.close();
  }
});
