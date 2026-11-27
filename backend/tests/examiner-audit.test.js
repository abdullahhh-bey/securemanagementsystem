import assert from "node:assert/strict";
import { test } from "node:test";
import { AuditAction, AuditEntityType, writeAuditLog } from "../src/utils/audit.js";

/**
 * These tests mirror the Examiner controller success/failure sequencing:
 * mutations call writeAuditLog only after the business write succeeds.
 */

function createDb() {
  const auditCreates = [];
  const exams = new Map();

  const db = {
    exam: {
      async create({ data }) {
        const exam = {
          id: "00000000-0000-4000-8000-000000000201",
          ...data,
        };
        exams.set(exam.id, exam);
        return exam;
      },
      async findFirst({ where }) {
        return (
          [...exams.values()].find(
            (exam) => exam.id === where.id && exam.ownerId === where.ownerId,
          ) ?? null
        );
      },
      async update({ where, data }) {
        const exam = exams.get(where.id);
        Object.assign(exam, data);
        return exam;
      },
    },
    auditLog: {
      async create({ data }) {
        auditCreates.push(data);
        return { id: `audit-${auditCreates.length}`, ...data };
      },
    },
  };

  return { db, auditCreates, exams };
}

async function createExamLikeController(db, { userId, body }) {
  const {
    title,
    startsAt,
    endsAt,
    durationMinutes,
  } = body;

  if (
    typeof title !== "string" ||
    !title.trim() ||
    !startsAt ||
    !endsAt ||
    !Number.isInteger(durationMinutes) ||
    durationMinutes <= 0
  ) {
    return { status: 400, audited: false };
  }

  const exam = await db.exam.create({
    data: {
      ownerId: userId,
      title: title.trim(),
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      durationMinutes,
      status: "DRAFT",
    },
  });

  await writeAuditLog(db, {
    actorId: userId,
    action: AuditAction.EXAM_CREATED,
    entityType: AuditEntityType.EXAM,
    entityId: exam.id,
    newValues: {
      title: exam.title,
      status: exam.status,
      startsAt: exam.startsAt,
      endsAt: exam.endsAt,
      durationMinutes: exam.durationMinutes,
    },
  });

  return { status: 201, audited: true, exam };
}

async function publishExamLikeController(db, { userId, examId, questionCount }) {
  const exam = await db.exam.findFirst({
    where: { id: examId, ownerId: userId },
  });

  if (!exam) return { status: 404, audited: false };
  if (exam.status !== "DRAFT") return { status: 400, audited: false };
  if (questionCount === 0) return { status: 400, audited: false };

  const previousStatus = exam.status;

  const publishedExam = await db.exam.update({
    where: { id: examId },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });

  await writeAuditLog(db, {
    actorId: userId,
    action: AuditAction.EXAM_PUBLISHED,
    entityType: AuditEntityType.EXAM,
    entityId: publishedExam.id,
    oldValues: { status: previousStatus },
    newValues: {
      status: publishedExam.status,
      publishedAt: publishedExam.publishedAt,
      questionCount,
    },
  });

  return { status: 200, audited: true, exam: publishedExam };
}

test("successful exam create records EXAM_CREATED", async () => {
  const { db, auditCreates } = createDb();
  const userId = "00000000-0000-4000-8000-000000000003";

  const result = await createExamLikeController(db, {
    userId,
    body: {
      title: "Networks Quiz",
      startsAt: "2026-05-01T09:00:00.000Z",
      endsAt: "2026-05-01T10:00:00.000Z",
      durationMinutes: 60,
    },
  });

  assert.equal(result.status, 201);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].action, AuditAction.EXAM_CREATED);
  assert.equal(auditCreates[0].actorId, userId);
  assert.equal(auditCreates[0].entityType, AuditEntityType.EXAM);
  assert.equal(auditCreates[0].entityId, result.exam.id);
});

test("failed exam create does not record audit", async () => {
  const { db, auditCreates } = createDb();

  const result = await createExamLikeController(db, {
    userId: "00000000-0000-4000-8000-000000000003",
    body: {
      title: "   ",
      startsAt: "2026-05-01T09:00:00.000Z",
      endsAt: "2026-05-01T10:00:00.000Z",
      durationMinutes: 60,
    },
  });

  assert.equal(result.status, 400);
  assert.equal(auditCreates.length, 0);
});

test("successful exam publish records EXAM_PUBLISHED", async () => {
  const { db, auditCreates, exams } = createDb();
  const userId = "00000000-0000-4000-8000-000000000003";
  const examId = "00000000-0000-4000-8000-000000000202";

  exams.set(examId, {
    id: examId,
    ownerId: userId,
    title: "Ready Draft",
    status: "DRAFT",
  });

  const result = await publishExamLikeController(db, {
    userId,
    examId,
    questionCount: 3,
  });

  assert.equal(result.status, 200);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].action, AuditAction.EXAM_PUBLISHED);
  assert.deepEqual(auditCreates[0].oldValues, { status: "DRAFT" });
  assert.equal(auditCreates[0].newValues.status, "PUBLISHED");
  assert.equal(auditCreates[0].newValues.questionCount, 3);
});

test("failed exam publish does not record audit", async () => {
  const { db, auditCreates, exams } = createDb();
  const userId = "00000000-0000-4000-8000-000000000003";
  const examId = "00000000-0000-4000-8000-000000000203";

  exams.set(examId, {
    id: examId,
    ownerId: userId,
    title: "Empty Draft",
    status: "DRAFT",
  });

  const result = await publishExamLikeController(db, {
    userId,
    examId,
    questionCount: 0,
  });

  assert.equal(result.status, 400);
  assert.equal(auditCreates.length, 0);
});

test("transaction-style results publish keeps mutation and audit together", async () => {
  const auditCreates = [];
  const resultUpdates = [];

  const tx = {
    result: {
      async update({ where, data }) {
        resultUpdates.push({ id: where.id, ...data });
        return { id: where.id, ...data };
      },
    },
    auditLog: {
      async create({ data }) {
        auditCreates.push(data);
        return data;
      },
    },
  };

  const readyResults = [{ id: "r1" }, { id: "r2" }];
  const actorId = "00000000-0000-4000-8000-000000000003";
  const examId = "00000000-0000-4000-8000-000000000204";

  // Mirrors publishExamResults interactive transaction.
  for (const result of readyResults) {
    await tx.result.update({
      where: { id: result.id },
      data: { status: "PUBLISHED", publishedById: actorId },
    });
  }
  await writeAuditLog(tx, {
    actorId,
    action: AuditAction.RESULTS_PUBLISHED,
    entityType: AuditEntityType.EXAM,
    entityId: examId,
    oldValues: { status: "READY_TO_PUBLISH" },
    newValues: { status: "PUBLISHED", publishedCount: readyResults.length },
  });

  assert.equal(resultUpdates.length, 2);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].action, AuditAction.RESULTS_PUBLISHED);
  assert.equal(auditCreates[0].newValues.publishedCount, 2);
});
