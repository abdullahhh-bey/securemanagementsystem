import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import { test } from "node:test";
import { createQuestionAnalyticsHandlers } from "../src/controllers/question-analytics.controller.js";

const examinerId = "00000000-0000-4000-8000-000000000010";
const otherExaminerId = "00000000-0000-4000-8000-000000000011";
const examId = "00000000-0000-4000-8000-000000000020";

const choiceQuestion = {
  id: "00000000-0000-4000-8000-000000000030",
  questionId: "00000000-0000-4000-8000-000000000031",
  versionNumber: 1,
  questionText: "Which answer is correct?",
  type: "SINGLE_CHOICE",
  options: [
    { id: "correct-option", optionText: "Correct", isCorrect: true },
    { id: "wrong-option", optionText: "Wrong", isCorrect: false },
  ],
};
const writtenQuestion = {
  id: "00000000-0000-4000-8000-000000000040",
  questionId: "00000000-0000-4000-8000-000000000041",
  versionNumber: 1,
  questionText: "Explain your reasoning.",
  type: "WRITTEN",
  options: [],
};

function createFixture({ ownerId = examinerId } = {}) {
  const attempts = [
    {
      id: "official-final-1",
      questions: [
        {
          id: "attempt-q-1",
          position: 1,
          assignedMarks: 1,
          questionVersion: choiceQuestion,
          answer: {
            status: "ANSWERED",
            awardedMarks: 1,
            textResponse: null,
            selectedOptions: [{ optionId: "correct-option" }],
          },
        },
        {
          id: "attempt-q-2",
          position: 2,
          assignedMarks: 4,
          questionVersion: writtenQuestion,
          answer: {
            status: "ANSWERED",
            awardedMarks: null,
            textResponse: "private written answer",
            selectedOptions: [],
          },
        },
      ],
    },
    {
      id: "official-final-2",
      questions: [
        {
          id: "attempt-q-3",
          position: 1,
          assignedMarks: 1,
          questionVersion: choiceQuestion,
          answer: {
            status: "ANSWERED",
            awardedMarks: 0,
            textResponse: null,
            selectedOptions: [{ optionId: "wrong-option" }],
          },
        },
        {
          id: "attempt-q-4",
          position: 2,
          assignedMarks: 4,
          questionVersion: writtenQuestion,
          answer: null,
        },
      ],
    },
  ];
  let attemptQuery;
  const db = {
    exam: {
      async findFirst({ where }) {
        return where.id === examId && where.ownerId === ownerId ? { id: examId } : null;
      },
    },
    examAttempt: {
      async findMany(query) {
        attemptQuery = query;
        return attempts;
      },
    },
  };
  return { db, getAttemptQuery: () => attemptQuery };
}

function createApp({ db, userId = examinerId }) {
  const { getQuestionAnalytics } = createQuestionAnalyticsHandlers(db);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: userId, role: "EXAMINER" };
    next();
  });
  app.get("/exams/:examId/analytics/questions", getQuestionAnalytics);
  return app;
}

async function listen(app) {
  const server = app.listen(0);
  await once(server, "listening");
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

test("question analytics use final official answers and exclude ungraded written answers from difficulty", async () => {
  const fixture = createFixture();
  const app = createApp(fixture);
  const { server, url } = await listen(app);

  try {
    const response = await fetch(`${url}/exams/${examId}/analytics/questions`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.finalAttemptCount, 2);

    const choice = body.questions.find((row) => row.questionVersionId === choiceQuestion.id);
    assert.equal(choice.attempts, 2);
    assert.equal(choice.skippedRate, 0);
    assert.equal(choice.incorrectRate, 50);
    assert.equal(choice.correctRate, 50);
    assert.equal(choice.observedDifficulty, "MEDIUM");
    assert.equal(choice.responsePatterns.answeredChoiceResponses, 2);

    const written = body.questions.find((row) => row.questionVersionId === writtenQuestion.id);
    assert.equal(written.attempts, 2);
    assert.equal(written.skipped, 1);
    assert.equal(written.skippedRate, 50);
    assert.equal(written.ungraded, 1);
    assert.equal(written.gradedResponses, 0);
    assert.equal(written.observedDifficulty, null);
    assert.equal(JSON.stringify(body).includes("private written answer"), false);
    assert.equal(JSON.stringify(body).includes("official-final-1"), false);

    const query = fixture.getAttemptQuery();
    assert.equal(query.where.mode, "OFFICIAL");
    assert.deepEqual(query.where.status.in, ["SUBMITTED", "AUTO_SUBMITTED"]);
  } finally {
    server.close();
  }
});

test("question analytics are unavailable to an examiner who does not own the exam", async () => {
  const app = createApp(createFixture({ ownerId: otherExaminerId }));
  const { server, url } = await listen(app);

  try {
    const response = await fetch(`${url}/exams/${examId}/analytics/questions`);
    assert.equal(response.status, 404);
  } finally {
    server.close();
  }
});
