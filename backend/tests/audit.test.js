import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AuditAction,
  AuditEntityType,
  deriveAuditDetail,
  deriveAuditTarget,
  mapAuditLogEntry,
  writeAuditLog,
} from "../src/utils/audit.js";

function createAuditClient() {
  const created = [];
  return {
    created,
    client: {
      auditLog: {
        async create({ data }) {
          created.push(data);
          return { id: `audit-${created.length}`, ...data };
        },
      },
    },
  };
}

test("writeAuditLog persists actor, action, entity, and optional payloads", async () => {
  const { client, created } = createAuditClient();
  const actorId = "00000000-0000-4000-8000-000000000003";

  await writeAuditLog(client, {
    actorId,
    action: AuditAction.EXAM_CREATED,
    entityType: AuditEntityType.EXAM,
    entityId: "00000000-0000-4000-8000-000000000101",
    newValues: { title: "Midterm", status: "DRAFT" },
    metadata: { source: "test" },
  });

  assert.equal(created.length, 1);
  assert.equal(created[0].actorId, actorId);
  assert.equal(created[0].action, "EXAM_CREATED");
  assert.equal(created[0].entityType, "EXAM");
  assert.equal(created[0].entityId, "00000000-0000-4000-8000-000000000101");
  assert.deepEqual(created[0].newValues, { title: "Midterm", status: "DRAFT" });
  assert.deepEqual(created[0].metadata, { source: "test" });
  assert.equal(created[0].oldValues, null);
});

test("writeAuditLog works with a transaction-shaped client", async () => {
  const { client, created } = createAuditClient();

  await writeAuditLog(client, {
    actorId: "00000000-0000-4000-8000-000000000003",
    action: AuditAction.RESULTS_PUBLISHED,
    entityType: AuditEntityType.EXAM,
    entityId: "exam-1",
    oldValues: { status: "READY_TO_PUBLISH" },
    newValues: { status: "PUBLISHED", publishedCount: 2 },
  });

  assert.equal(created.length, 1);
  assert.equal(created[0].action, "RESULTS_PUBLISHED");
  assert.deepEqual(created[0].oldValues, { status: "READY_TO_PUBLISH" });
});

test("writeAuditLog rejects incomplete entries", async () => {
  const { client, created } = createAuditClient();

  await assert.rejects(
    () =>
      writeAuditLog(client, {
        actorId: "actor",
        action: AuditAction.EXAM_CREATED,
        entityType: AuditEntityType.EXAM,
      }),
    /entityId/,
  );

  assert.equal(created.length, 0);
});

test("mapAuditLogEntry maps createdAt and actor fields for the Admin UI", () => {
  const entry = mapAuditLogEntry({
    id: "audit-1",
    createdAt: new Date("2026-05-01T12:00:00.000Z"),
    actorId: "actor-1",
    action: "EXAM_PUBLISHED",
    entityType: "EXAM",
    entityId: "exam-1",
    oldValues: { status: "DRAFT" },
    newValues: { status: "PUBLISHED", title: "Networks Quiz" },
    metadata: null,
    actor: { id: "actor-1", fullName: "Examiner One", role: "EXAMINER" },
  });

  assert.equal(entry.at, "2026-05-01T12:00:00.000Z");
  assert.equal(entry.actorName, "Examiner One");
  assert.equal(entry.actorRole, "EXAMINER");
  assert.equal(entry.target, "Networks Quiz");
  assert.equal(entry.detail, "Status DRAFT → PUBLISHED");
});

test("deriveAudit helpers avoid leaking sensitive fields", () => {
  assert.equal(
    deriveAuditTarget({
      entityType: "QUESTION",
      entityId: "q1",
      newValues: { type: "SINGLE_CHOICE", passwordHash: "secret" },
    }),
    "QUESTION q1",
  );

  const detail = deriveAuditDetail({
    entityType: "QUESTION",
    entityId: "q1",
    newValues: {
      type: "SINGLE_CHOICE",
      difficulty: "EASY",
      password: "nope",
      isCorrect: true,
      markingGuide: "secret guide",
    },
  });

  assert.match(detail, /Type: SINGLE_CHOICE/);
  assert.equal(detail.includes("nope"), false);
  assert.equal(detail.includes("secret guide"), false);
});
