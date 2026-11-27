import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import { test } from "node:test";
import { createCompensationHandlers } from "../src/controllers/compensation.controller.js";
import { compensationCapMinutes } from "../src/controllers/monitor.controller.js";
import { AuditAction, AuditEntityType } from "../src/utils/audit.js";

const ownerId = "00000000-0000-4000-8000-000000000010";
const otherExaminerId = "00000000-0000-4000-8000-000000000011";
const examId = "00000000-0000-4000-8000-000000000020";
const otherExamId = "00000000-0000-4000-8000-000000000021";
const candidateId = "00000000-0000-4000-8000-000000000030";
const attemptId = "00000000-0000-4000-8000-000000000040";
const otherAttemptId = "00000000-0000-4000-8000-000000000041";

function createFixture({
  status = "IN_PROGRESS",
  durationMinutes = 90,
  expiresAt = new Date("2026-03-01T12:30:00.000Z"),
} = {}) {
  const state = {
    exams: [
      {
        id: examId,
        ownerId,
        title: "Networks Midterm",
        durationMinutes,
        endsAt: new Date("2026-03-01T14:00:00.000Z"),
      },
      {
        id: otherExamId,
        ownerId,
        title: "Other Exam",
        durationMinutes: 60,
        endsAt: new Date("2026-03-01T15:00:00.000Z"),
      },
    ],
    attempts: [
      {
        id: attemptId,
        examId,
        participantId: candidateId,
        mode: "OFFICIAL",
        status,
        startedAt: new Date("2026-03-01T11:00:00.000Z"),
        expiresAt,
        lastActivityAt: new Date("2026-03-01T11:30:00.000Z"),
        events: [],
      },
      {
        id: otherAttemptId,
        examId: otherExamId,
        participantId: candidateId,
        mode: "OFFICIAL",
        status: "IN_PROGRESS",
        startedAt: new Date("2026-03-01T11:00:00.000Z"),
        expiresAt: new Date("2026-03-01T12:00:00.000Z"),
        lastActivityAt: new Date("2026-03-01T11:10:00.000Z"),
        events: [],
      },
    ],
    auditLogs: [],
  };

  const users = {
    [ownerId]: { id: ownerId, fullName: "Examiner One" },
    [candidateId]: {
      id: candidateId,
      fullName: "Alice Candidate",
      email: "alice@example.com",
    },
  };

  const db = {
    async $transaction(fn) {
      return fn(db);
    },
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
        if (where.mode) rows = rows.filter((row) => row.mode === where.mode);
        return rows.map((row) => projectAttempt(row, select, users));
      },
      async findFirst({ where, select }) {
        const attempt = state.attempts.find(
          (row) =>
            row.id === where.id &&
            (!where.examId || row.examId === where.examId) &&
            (!where.mode || row.mode === where.mode),
        );
        if (!attempt) return null;
        return projectAttempt(attempt, select, users);
      },
      async update({ where, data, select }) {
        const attempt = state.attempts.find((row) => row.id === where.id);
        Object.assign(attempt, data);
        return projectAttempt(attempt, select, users);
      },
    },
    auditLog: {
      async findMany({ where, include, orderBy }) {
        let rows = state.auditLogs.filter((row) => {
          if (where.action && row.action !== where.action) return false;
          if (where.entityType && row.entityType !== where.entityType) return false;
          if (where.entityId?.in && !where.entityId.in.includes(row.entityId)) {
            return false;
          }
          return true;
        });
        if (orderBy?.createdAt === "desc") {
          rows = [...rows].sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
          );
        }
        return rows.map((row) => ({
          ...row,
          actor: include?.actor ? users[row.actorId] : undefined,
        }));
      },
      async create({ data }) {
        const entry = {
          id: `cmp-${state.auditLogs.length + 1}`,
          createdAt: new Date(),
          ...data,
        };
        state.auditLogs.push(entry);
        return entry;
      },
    },
  };

  return { db, state, users };
}

function projectAttempt(row, select, users) {
  if (!select) return { ...row };
  const projected = {};
  for (const key of Object.keys(select)) {
    if (key === "participant") {
      projected.participant = users[row.participantId];
    } else if (key === "events") {
      projected.events = row.events ?? [];
    } else {
      projected[key] = row[key];
    }
  }
  return projected;
}

function createApp({ db, userId = ownerId }) {
  const { listExamCompensations, grantAttemptCompensation } =
    createCompensationHandlers(db);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: userId, role: "EXAMINER", fullName: "Examiner One" };
    next();
  });
  app.get("/exams/:examId/compensations", listExamCompensations);
  app.post(
    "/exams/:examId/attempts/:attemptId/compensation",
    grantAttemptCompensation,
  );
  return app;
}

async function listen(app) {
  const server = app.listen(0);
  await once(server, "listening");
  const { port } = server.address();
  return { server, url: `http://127.0.0.1:${port}` };
}

test("compensationCapMinutes matches mock policy (min of 30 and 25% duration)", () => {
  assert.equal(compensationCapMinutes(90), 23);
  assert.equal(compensationCapMinutes(200), 30);
});

test("grants compensation, extends expiresAt, and writes audit history", async () => {
  const { db, state } = createFixture();
  const app = createApp({ db });
  const { server, url } = await listen(app);
  const before = new Date(state.attempts[0].expiresAt).getTime();

  try {
    const response = await fetch(
      `${url}/exams/${examId}/attempts/${attemptId}/compensation`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minutes: 5,
          reason: "Network outage lasting several minutes",
        }),
      },
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.attempt.compensationMinutes, 5);
    assert.equal(body.attempt.cap.usedMinutes, 5);
    assert.equal(body.attempt.cap.remainingMinutes, 18);
    assert.equal(
      new Date(state.attempts[0].expiresAt).getTime(),
      before + 5 * 60_000,
    );
    assert.equal(state.auditLogs.length, 1);
    assert.equal(state.auditLogs[0].action, AuditAction.COMPENSATION_GRANTED);
    assert.equal(state.auditLogs[0].entityType, AuditEntityType.ATTEMPT);
    assert.equal(state.auditLogs[0].newValues.minutes, 5);
    assert.equal(state.auditLogs[0].newValues.candidateId, candidateId);
  } finally {
    server.close();
  }
});

test("rejects invalid minutes and short reasons", async () => {
  const { db, state } = createFixture();
  const app = createApp({ db });
  const { server, url } = await listen(app);

  try {
    const badMinutes = await fetch(
      `${url}/exams/${examId}/attempts/${attemptId}/compensation`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes: 0, reason: "Valid reason text here" }),
      },
    );
    assert.equal(badMinutes.status, 422);

    const shortReason = await fetch(
      `${url}/exams/${examId}/attempts/${attemptId}/compensation`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes: 2, reason: "too short" }),
      },
    );
    assert.equal(shortReason.status, 422);
    assert.equal(state.auditLogs.length, 0);
  } finally {
    server.close();
  }
});

test("returns 404 for ownership failure and wrong exam/attempt association", async () => {
  const { db } = createFixture();
  const foreign = createApp({ db, userId: otherExaminerId });
  const owned = createApp({ db });
  const foreignListen = await listen(foreign);
  const ownedListen = await listen(owned);

  try {
    const ownership = await fetch(
      `${foreignListen.url}/exams/${examId}/attempts/${attemptId}/compensation`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minutes: 2,
          reason: "Valid reason text here!!",
        }),
      },
    );
    assert.equal(ownership.status, 404);

    const mismatch = await fetch(
      `${ownedListen.url}/exams/${examId}/attempts/${otherAttemptId}/compensation`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minutes: 2,
          reason: "Valid reason text here!!",
        }),
      },
    );
    assert.equal(mismatch.status, 404);
  } finally {
    foreignListen.server.close();
    ownedListen.server.close();
  }
});

test("enforces the cumulative compensation cap across repeated grants", async () => {
  const { db, state } = createFixture({ durationMinutes: 80 });
  // cap = min(30, round(20)) = 20
  const app = createApp({ db });
  const { server, url } = await listen(app);

  try {
    const first = await fetch(
      `${url}/exams/${examId}/attempts/${attemptId}/compensation`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minutes: 15,
          reason: "First compensation for prolonged disconnect",
        }),
      },
    );
    assert.equal(first.status, 200);

    const overCap = await fetch(
      `${url}/exams/${examId}/attempts/${attemptId}/compensation`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minutes: 6,
          reason: "Second compensation should exceed remaining cap",
        }),
      },
    );
    assert.equal(overCap.status, 422);
    const overBody = await overCap.json();
    assert.match(overBody.details.minutes, /5 remain/);

    const second = await fetch(
      `${url}/exams/${examId}/attempts/${attemptId}/compensation`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minutes: 5,
          reason: "Second compensation uses the remaining allowance",
        }),
      },
    );
    assert.equal(second.status, 200);
    const secondBody = await second.json();
    assert.equal(secondBody.attempt.cap.usedMinutes, 20);
    assert.equal(secondBody.attempt.cap.remainingMinutes, 0);
    assert.equal(state.auditLogs.length, 2);
  } finally {
    server.close();
  }
});

test("lists compensation history newest first", async () => {
  const { db } = createFixture();
  const app = createApp({ db });
  const { server, url } = await listen(app);

  try {
    await fetch(`${url}/exams/${examId}/attempts/${attemptId}/compensation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        minutes: 3,
        reason: "First grant reason long enough",
      }),
    });
    await fetch(`${url}/exams/${examId}/attempts/${attemptId}/compensation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        minutes: 2,
        reason: "Second grant reason long enough",
      }),
    });

    const response = await fetch(`${url}/exams/${examId}/compensations`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.compensations.length, 2);
    assert.equal(body.compensations[0].minutes, 2);
    assert.equal(body.compensations[0].attemptId, attemptId);
    assert.equal(body.compensations[0].candidate.name, "Alice Candidate");
    assert.equal(body.compensations[0].grantedBy, "Examiner One");
    assert.equal(body.compensations[1].minutes, 3);
  } finally {
    server.close();
  }
});

test("rejects compensation when the attempt is not in progress", async () => {
  const { db, state } = createFixture({ status: "SUBMITTED" });
  const app = createApp({ db });
  const { server, url } = await listen(app);

  try {
    const response = await fetch(
      `${url}/exams/${examId}/attempts/${attemptId}/compensation`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minutes: 2,
          reason: "Valid reason text here!!",
        }),
      },
    );
    assert.equal(response.status, 400);
    assert.equal(state.auditLogs.length, 0);
  } finally {
    server.close();
  }
});
