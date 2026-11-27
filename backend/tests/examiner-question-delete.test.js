import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import { test } from "node:test";
import { createQuestionDeletionHandlers } from "../src/controllers/question.controller.js";
import { AuditAction, AuditEntityType } from "../src/utils/audit.js";

const ownerId = "00000000-0000-4000-8000-000000000010";
const otherExaminerId = "00000000-0000-4000-8000-000000000011";
const questionId = "00000000-0000-4000-8000-000000000050";
const versionId = "00000000-0000-4000-8000-000000000051";

function createFixture({
  authorId = ownerId,
  isActive = true,
  examQuestions = 0,
  attemptQuestions = 0,
} = {}) {
  const state = {
    questions: [
      {
        id: questionId,
        authorId,
        categoryId: null,
        isActive,
      },
    ],
    versions: [
      {
        id: versionId,
        questionId,
        versionNumber: 1,
        examQuestions,
        attemptQuestions,
      },
    ],
    options: [
      {
        id: "opt-1",
        questionVersionId: versionId,
      },
    ],
    auditLogs: [],
  };

  const db = {
    async $transaction(fn) {
      return fn(db);
    },
    question: {
      async findFirst({ where, select }) {
        const question = state.questions.find(
          (row) =>
            row.id === where.id &&
            row.authorId === where.authorId &&
            (where.isActive === undefined || row.isActive === where.isActive),
        );
        if (!question) return null;

        const versions = state.versions
          .filter((version) => version.questionId === question.id)
          .map((version) => ({
            id: version.id,
            versionNumber: version.versionNumber,
            _count: {
              examQuestions: version.examQuestions,
              attemptQuestions: version.attemptQuestions,
            },
          }));

        if (!select) return { ...question, versions };
        return {
          id: question.id,
          categoryId: question.categoryId,
          versions,
        };
      },
      async update({ where, data }) {
        const question = state.questions.find((row) => row.id === where.id);
        Object.assign(question, data);
        return question;
      },
      async delete({ where }) {
        const index = state.questions.findIndex((row) => row.id === where.id);
        const [removed] = state.questions.splice(index, 1);
        return removed;
      },
    },
    questionOption: {
      async deleteMany({ where }) {
        const ids = where.questionVersionId?.in ?? [];
        const before = state.options.length;
        state.options = state.options.filter(
          (row) => !ids.includes(row.questionVersionId),
        );
        return { count: before - state.options.length };
      },
    },
    questionVersion: {
      async deleteMany({ where }) {
        const before = state.versions.length;
        state.versions = state.versions.filter(
          (row) => row.questionId !== where.questionId,
        );
        return { count: before - state.versions.length };
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

function createApp({ db, userId = ownerId }) {
  const { deleteQuestion } = createQuestionDeletionHandlers(db);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: userId, role: "EXAMINER" };
    next();
  });
  app.delete("/questions/:questionId", deleteQuestion);
  return app;
}

async function listen(app) {
  const server = app.listen(0);
  await once(server, "listening");
  const { port } = server.address();
  return { server, url: `http://127.0.0.1:${port}` };
}

test("hard-deletes an unreferenced owned question", async () => {
  const { db, state } = createFixture();
  const app = createApp({ db });
  const { server, url } = await listen(app);

  try {
    const response = await fetch(`${url}/questions/${questionId}`, {
      method: "DELETE",
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.deletion.mode, "hard");
    assert.equal(state.questions.length, 0);
    assert.equal(state.versions.length, 0);
    assert.equal(state.options.length, 0);
    assert.equal(state.auditLogs.length, 1);
    assert.equal(state.auditLogs[0].action, AuditAction.QUESTION_DELETED);
    assert.equal(state.auditLogs[0].entityType, AuditEntityType.QUESTION);
    assert.equal(state.auditLogs[0].newValues.mode, "hard");
  } finally {
    server.close();
  }
});

test("soft-deletes a question referenced by an exam assignment", async () => {
  const { db, state } = createFixture({ examQuestions: 1 });
  const app = createApp({ db });
  const { server, url } = await listen(app);

  try {
    const response = await fetch(`${url}/questions/${questionId}`, {
      method: "DELETE",
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.deletion.mode, "soft");
    assert.equal(state.questions[0].isActive, false);
    assert.equal(state.versions.length, 1);
    assert.equal(state.options.length, 1);
    assert.equal(state.auditLogs[0].newValues.mode, "soft");
    assert.equal(state.auditLogs[0].newValues.examAssignmentCount, 1);
  } finally {
    server.close();
  }
});

test("soft-deletes a question referenced by historical attempts", async () => {
  const { db, state } = createFixture({ attemptQuestions: 2 });
  const app = createApp({ db });
  const { server, url } = await listen(app);

  try {
    const response = await fetch(`${url}/questions/${questionId}`, {
      method: "DELETE",
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.deletion.mode, "soft");
    assert.equal(state.questions[0].isActive, false);
    assert.equal(state.versions.length, 1);
    assert.equal(state.auditLogs[0].newValues.attemptReferenceCount, 2);
  } finally {
    server.close();
  }
});

test("returns 404 for another examiner's question", async () => {
  const { db, state } = createFixture();
  const app = createApp({ db, userId: otherExaminerId });
  const { server, url } = await listen(app);

  try {
    const response = await fetch(`${url}/questions/${questionId}`, {
      method: "DELETE",
    });
    assert.equal(response.status, 404);
    assert.equal(state.questions.length, 1);
    assert.equal(state.auditLogs.length, 0);
  } finally {
    server.close();
  }
});

test("returns 404 for a missing or already inactive question", async () => {
  const missingFixture = createFixture();
  const inactiveFixture = createFixture({ isActive: false });
  const missingApp = createApp({ db: missingFixture.db });
  const inactiveApp = createApp({ db: inactiveFixture.db });
  const missing = await listen(missingApp);
  const inactive = await listen(inactiveApp);

  try {
    const missingResponse = await fetch(
      `${missing.url}/questions/00000000-0000-4000-8000-000000000099`,
      { method: "DELETE" },
    );
    assert.equal(missingResponse.status, 404);

    const inactiveResponse = await fetch(
      `${inactive.url}/questions/${questionId}`,
      { method: "DELETE" },
    );
    assert.equal(inactiveResponse.status, 404);
    assert.equal(inactiveFixture.state.auditLogs.length, 0);
  } finally {
    missing.server.close();
    inactive.server.close();
  }
});
