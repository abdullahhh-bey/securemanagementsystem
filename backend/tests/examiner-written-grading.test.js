import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import { test } from "node:test";
import {
  createGradingHandlers,
  deriveGradingState,
  recalculateAttemptResult,
} from "../src/controllers/grading.controller.js";
import { AuditAction, AuditEntityType } from "../src/utils/audit.js";

const ownerId = "00000000-0000-4000-8000-000000000010";
const otherExaminerId = "00000000-0000-4000-8000-000000000011";
const examId = "00000000-0000-4000-8000-000000000020";
const attemptId = "00000000-0000-4000-8000-000000000040";
const questionId = "00000000-0000-4000-8000-000000000060";
const versionId = "00000000-0000-4000-8000-000000000061";
const attemptQuestionId = "00000000-0000-4000-8000-000000000062";
const answerId = "00000000-0000-4000-8000-000000000063";
const mcqAnswerId = "00000000-0000-4000-8000-000000000064";
const mcqAttemptQuestionId = "00000000-0000-4000-8000-000000000065";

function createFixture({
  examStatus = "COMPLETED",
  attemptStatus = "SUBMITTED",
  writtenScore = null,
  resultStatus = null,
  owner = ownerId,
} = {}) {
  const state = {
    exams: [
      {
        id: examId,
        ownerId: owner,
        title: "Networks Midterm",
        status: examStatus,
      },
    ],
    attempts: [
      {
        id: attemptId,
        examId,
        mode: "OFFICIAL",
        status: attemptStatus,
        submittedAt: new Date("2026-03-01T12:00:00.000Z"),
      },
    ],
    results: resultStatus
      ? [
          {
            id: "result-1",
            attemptId,
            totalMarks: 20,
            obtainedMarks: writtenScore == null ? 8 : 8 + writtenScore,
            status: resultStatus,
          },
        ]
      : [],
    attemptQuestions: [
      {
        id: attemptQuestionId,
        attemptId,
        questionVersionId: versionId,
        position: 1,
        assignedMarks: 12,
      },
      {
        id: mcqAttemptQuestionId,
        attemptId,
        questionVersionId: "mcq-version",
        position: 2,
        assignedMarks: 8,
      },
    ],
    answers: [
      {
        id: answerId,
        attemptQuestionId,
        textResponse: "TCP handshake synchronises sequence numbers.",
        status: "ANSWERED",
        awardedMarks: writtenScore,
        gradingMethod: writtenScore == null ? null : "MANUAL",
        feedback: writtenScore == null ? null : "Good",
        gradedById: writtenScore == null ? null : ownerId,
        gradedAt: writtenScore == null ? null : new Date("2026-03-01T13:00:00.000Z"),
      },
      {
        id: mcqAnswerId,
        attemptQuestionId: mcqAttemptQuestionId,
        textResponse: null,
        status: "ANSWERED",
        awardedMarks: 8,
        gradingMethod: "AUTO",
        feedback: null,
        gradedById: ownerId,
        gradedAt: new Date("2026-03-01T12:30:00.000Z"),
      },
    ],
    versions: {
      [versionId]: {
        id: versionId,
        questionId,
        type: "WRITTEN",
        questionText: "Explain the TCP handshake.",
        markingGuide: "SYN, SYN-ACK, ACK",
        question: {
          id: questionId,
          category: { id: "cat-1", name: "Networks" },
        },
      },
      "mcq-version": {
        id: "mcq-version",
        questionId: "mcq-q",
        type: "SINGLE_CHOICE",
        questionText: "Pick one",
        markingGuide: null,
        question: { id: "mcq-q", category: null },
        options: [],
      },
    },
    auditLogs: [],
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
      async findMany({ where, select, orderBy, include }) {
        let rows = state.attempts.filter((row) => row.examId === where.examId);
        if (where.mode) rows = rows.filter((row) => row.mode === where.mode);
        if (where.status?.in) {
          rows = rows.filter((row) => where.status.in.includes(row.status));
        }
        if (orderBy?.submittedAt === "asc") {
          rows = [...rows].sort(
            (a, b) => new Date(a.submittedAt) - new Date(b.submittedAt),
          );
        }
        return rows.map((row) =>
          projectAttempt(row, select ?? include, state),
        );
      },
      async findFirst({ where, select }) {
        const attempt = state.attempts.find(
          (row) =>
            row.id === where.id &&
            row.examId === where.examId &&
            (!where.mode || row.mode === where.mode) &&
            (!where.status?.in || where.status.in.includes(row.status)),
        );
        if (!attempt) return null;
        return projectAttempt(attempt, select, state);
      },
    },
    attemptQuestion: {
      async findMany({ where, include }) {
        return state.attemptQuestions
          .filter((row) => row.attemptId === where.attemptId)
          .map((row) => projectAttemptQuestion(row, include, state));
      },
      async findFirst({ where, include }) {
        let rows = [...state.attemptQuestions];
        if (where.id) {
          rows = rows.filter((row) => row.id === where.id);
        }
        if (where.attemptId) {
          rows = rows.filter((row) => row.attemptId === where.attemptId);
        }
        if (where.questionVersion?.questionId) {
          rows = rows.filter((row) => {
            const version = state.versions[row.questionVersionId];
            return (
              version?.questionId === where.questionVersion.questionId &&
              (!where.questionVersion.type ||
                version.type === where.questionVersion.type)
            );
          });
        }
        const row = rows[0];
        if (!row) return null;
        return projectAttemptQuestion(row, include, state);
      },
    },
    attemptAnswer: {
      async update({ where, data }) {
        const answer = state.answers.find((row) => row.id === where.id);
        Object.assign(answer, data);
        return answer;
      },
      async create({ data }) {
        const row = { id: `ans-${state.answers.length + 1}`, ...data };
        state.answers.push(row);
        return row;
      },
    },
    result: {
      async findUnique({ where, select }) {
        const result = state.results.find(
          (row) => row.attemptId === where.attemptId,
        );
        if (!result) return null;
        if (!select) return result;
        return Object.fromEntries(
          Object.keys(select).map((key) => [key, result[key]]),
        );
      },
      async upsert({ where, create, update }) {
        const existing = state.results.find(
          (row) => row.attemptId === where.attemptId,
        );
        if (!existing) {
          const created = { id: `result-${state.results.length + 1}`, ...create };
          state.results.push(created);
          return created;
        }
        Object.assign(existing, update);
        return existing;
      },
    },
    auditLog: {
      async create({ data }) {
        const entry = { id: `audit-${state.auditLogs.length + 1}`, ...data };
        state.auditLogs.push(entry);
        return entry;
      },
    },
  };

  return { db, state };
}

function projectAttempt(row, shape, state) {
  const result = state.results.find((item) => item.attemptId === row.id) ?? null;
  const base = {
    id: row.id,
    submittedAt: row.submittedAt,
    status: row.status,
    mode: row.mode,
    examId: row.examId,
    result: result ? { status: result.status } : null,
  };
  if (!shape) return base;
  if (shape.questions || shape.questions === undefined) {
    // include path
  }
  const projected = {};
  for (const key of Object.keys(shape)) {
    if (key === "result") {
      projected.result = result ? { status: result.status } : null;
    } else if (key === "questions") {
      const filter = shape.questions?.where?.questionVersion?.type;
      projected.questions = state.attemptQuestions
        .filter((aq) => aq.attemptId === row.id)
        .filter((aq) => {
          if (!filter) return true;
          return state.versions[aq.questionVersionId]?.type === filter;
        })
        .map((aq) =>
          projectAttemptQuestion(aq, shape.questions?.include, state),
        );
    } else {
      projected[key] = row[key];
    }
  }
  return projected;
}

function projectAttemptQuestion(row, include, state) {
  const version = state.versions[row.questionVersionId];
  const answer =
    state.answers.find((item) => item.attemptQuestionId === row.id) ?? null;
  return {
    id: row.id,
    attemptId: row.attemptId,
    assignedMarks: row.assignedMarks,
    position: row.position,
    answer: include?.answer === true || include?.answer ? answer : answer,
    questionVersion: {
      ...version,
      question: version.question,
    },
  };
}

function createApp({ db, userId = ownerId }) {
  const { getExamGradingQueue, saveWrittenGrade } = createGradingHandlers(db);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: userId, role: "EXAMINER", fullName: "Examiner One" };
    next();
  });
  app.get("/exams/:examId/grading", getExamGradingQueue);
  app.put(
    "/exams/:examId/attempts/:attemptId/answers/:questionId/grade",
    saveWrittenGrade,
  );
  return app;
}

async function listen(app) {
  const server = app.listen(0);
  await once(server, "listening");
  const { port } = server.address();
  return { server, url: `http://127.0.0.1:${port}` };
}

test("deriveGradingState maps exam completion and pending written work", () => {
  assert.equal(
    deriveGradingState({
      examStatus: "ONGOING",
      hasPublishedResults: false,
      pendingWrittenCount: 1,
    }),
    "NOT_READY",
  );
  assert.equal(
    deriveGradingState({
      examStatus: "COMPLETED",
      hasPublishedResults: false,
      pendingWrittenCount: 2,
    }),
    "UNGRADED",
  );
  assert.equal(
    deriveGradingState({
      examStatus: "COMPLETED",
      hasPublishedResults: false,
      pendingWrittenCount: 0,
    }),
    "GRADED",
  );
  assert.equal(
    deriveGradingState({
      examStatus: "COMPLETED",
      hasPublishedResults: true,
      pendingWrittenCount: 0,
    }),
    "PUBLISHED",
  );
});

test("lists written answers for grading without candidate names", async () => {
  const { db } = createFixture();
  const app = createApp({ db });
  const { server, url } = await listen(app);

  try {
    const response = await fetch(`${url}/exams/${examId}/grading`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.state, "UNGRADED");
    assert.equal(body.progress.total, 1);
    assert.equal(body.progress.graded, 0);
    assert.equal(body.items[0].submissionLabel, "Submission 1");
    assert.equal(body.items[0].question.modelAnswer, "SYN, SYN-ACK, ACK");
    assert.equal(body.items[0].score, null);
    assert.equal(body.items[0].candidate, undefined);
  } finally {
    server.close();
  }
});

test("saves a written grade, preserves MCQ marks, and recalculates the result", async () => {
  const { db, state } = createFixture();
  const app = createApp({ db });
  const { server, url } = await listen(app);

  try {
    const response = await fetch(
      `${url}/exams/${examId}/attempts/${attemptId}/answers/${questionId}/grade`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: 10,
          feedback: "Clear explanation of the handshake.",
        }),
      },
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.item.score, 10);
    assert.equal(body.item.feedback, "Clear explanation of the handshake.");

    const written = state.answers.find((row) => row.id === answerId);
    const mcq = state.answers.find((row) => row.id === mcqAnswerId);
    assert.equal(Number(written.awardedMarks), 10);
    assert.equal(written.gradingMethod, "MANUAL");
    assert.equal(Number(mcq.awardedMarks), 8);
    assert.equal(mcq.gradingMethod, "AUTO");

    assert.equal(state.results.length, 1);
    assert.equal(Number(state.results[0].obtainedMarks), 18);
    assert.equal(state.results[0].status, "READY_TO_PUBLISH");

    assert.equal(state.auditLogs[0].action, AuditAction.GRADE_SAVED);
    assert.equal(state.auditLogs[0].entityType, AuditEntityType.ATTEMPT_ANSWER);
    assert.equal(state.auditLogs[0].newValues.score, 10);
    assert.equal(state.auditLogs[0].newValues.answerText, undefined);
  } finally {
    server.close();
  }
});

test("rejects invalid marks and ownership failures", async () => {
  const owned = createFixture();
  const foreign = createFixture();
  const ownedApp = createApp({ db: owned.db });
  const foreignApp = createApp({ db: foreign.db, userId: otherExaminerId });
  const ownedListen = await listen(ownedApp);
  const foreignListen = await listen(foreignApp);

  try {
    const invalid = await fetch(
      `${ownedListen.url}/exams/${examId}/attempts/${attemptId}/answers/${questionId}/grade`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: 99, feedback: "Too high" }),
      },
    );
    assert.equal(invalid.status, 422);

    const ownership = await fetch(
      `${foreignListen.url}/exams/${examId}/grading`,
    );
    assert.equal(ownership.status, 404);
  } finally {
    ownedListen.server.close();
    foreignListen.server.close();
  }
});

test("rejects grading for non-submitted attempts", async () => {
  const { db, state } = createFixture({ attemptStatus: "IN_PROGRESS" });
  const app = createApp({ db });
  const { server, url } = await listen(app);

  try {
    const response = await fetch(
      `${url}/exams/${examId}/attempts/${attemptId}/answers/${questionId}/grade`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: 5, feedback: "Not yet submitted" }),
      },
    );
    assert.equal(response.status, 400);
    assert.equal(state.auditLogs.length, 0);
  } finally {
    server.close();
  }
});

test("recalculateAttemptResult keeps PENDING_REVIEW while written work remains", async () => {
  const { db, state } = createFixture();
  const outcome = await recalculateAttemptResult(db, {
    attemptId,
    examinerId: ownerId,
  });
  assert.equal(outcome.status, "PENDING_REVIEW");
  assert.equal(outcome.pendingWritten, 1);
  assert.equal(outcome.obtainedMarks, 8);
  assert.equal(state.results[0].status, "PENDING_REVIEW");
});
