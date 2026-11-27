/**
 * Shared AuditLog writer for Examiner (and other) mutations.
 * Accepts the root Prisma client or a transaction client (`tx`).
 */

export const AuditAction = Object.freeze({
  EXAM_CREATED: "EXAM_CREATED",
  EXAM_UPDATED: "EXAM_UPDATED",
  EXAM_DELETED: "EXAM_DELETED",
  EXAM_PUBLISHED: "EXAM_PUBLISHED",
  EXAM_QUESTION_ASSIGNED: "EXAM_QUESTION_ASSIGNED",
  EXAM_QUESTION_REMOVED: "EXAM_QUESTION_REMOVED",
  CANDIDATE_ENROLLED: "CANDIDATE_ENROLLED",
  CANDIDATE_WITHDRAWN: "CANDIDATE_WITHDRAWN",
  EXAM_EVALUATED: "EXAM_EVALUATED",
  RESULTS_PUBLISHED: "RESULTS_PUBLISHED",
  QUESTION_CREATED: "QUESTION_CREATED",
  QUESTION_VERSION_CREATED: "QUESTION_VERSION_CREATED",
  QUESTION_DELETED: "QUESTION_DELETED",
  CATEGORY_CREATED: "CATEGORY_CREATED",
  CATEGORY_UPDATED: "CATEGORY_UPDATED",
  CATEGORY_DELETED: "CATEGORY_DELETED",
  DISPUTE_REVIEW_STARTED: "DISPUTE_REVIEW_STARTED",
  DISPUTE_RESOLVED: "DISPUTE_RESOLVED",
  DISPUTE_REJECTED: "DISPUTE_REJECTED",
  ANNOUNCEMENT_SENT: "ANNOUNCEMENT_SENT",
  COMPENSATION_GRANTED: "COMPENSATION_GRANTED",
  GRADE_SAVED: "GRADE_SAVED",
});

export const AuditEntityType = Object.freeze({
  EXAM: "EXAM",
  EXAM_QUESTION: "EXAM_QUESTION",
  ENROLLMENT: "ENROLLMENT",
  QUESTION: "QUESTION",
  QUESTION_VERSION: "QUESTION_VERSION",
  CATEGORY: "QUESTION_CATEGORY",
  DISPUTE: "RESULT_DISPUTE",
  RESULT: "RESULT",
  ANNOUNCEMENT: "EXAM_ANNOUNCEMENT",
  ATTEMPT: "EXAM_ATTEMPT",
  ATTEMPT_ANSWER: "ATTEMPT_ANSWER",
});

/**
 * Persist one audit row. Call only after the business mutation succeeds
 * (or inside the same interactive transaction as that mutation).
 *
 * @param {{ auditLog: { create: Function } }} db
 * @param {{
 *   actorId: string,
 *   action: string,
 *   entityType: string,
 *   entityId: string | number,
 *   oldValues?: object | null,
 *   newValues?: object | null,
 *   metadata?: object | null,
 * }} entry
 */
export async function writeAuditLog(db, entry) {
  if (!db || typeof db.auditLog?.create !== "function") {
    throw new TypeError("writeAuditLog requires a Prisma client (or tx) with auditLog.create.");
  }

  const { actorId, action, entityType, entityId, oldValues = null, newValues = null, metadata = null } = entry ?? {};

  if (
    typeof actorId !== "string" ||
    !actorId ||
    typeof action !== "string" ||
    !action ||
    typeof entityType !== "string" ||
    !entityType ||
    entityId === undefined ||
    entityId === null ||
    entityId === ""
  ) {
    throw new TypeError("writeAuditLog requires actorId, action, entityType, and entityId.");
  }

  return db.auditLog.create({
    data: {
      actorId,
      action,
      entityType,
      entityId: String(entityId),
      oldValues,
      newValues,
      metadata,
    },
  });
}

const SENSITIVE_AUDIT_KEYS = new Set([
  "password",
  "passwordHash",
  "token",
  "accessToken",
  "refreshToken",
  "isCorrect",
  "markingGuide",
  "options",
  "correctOptions",
]);

function sanitizeAuditValue(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeAuditValue(item));
  if (typeof value !== "object") return value;

  const cleaned = {};
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_AUDIT_KEYS.has(key)) continue;
    cleaned[key] = sanitizeAuditValue(entry);
  }
  return cleaned;
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

/** Human-readable target for Admin Audit UI. */
export function deriveAuditTarget(row) {
  const newValues = asObject(row.newValues) ?? {};
  const oldValues = asObject(row.oldValues) ?? {};

  for (const candidate of [
    newValues.title,
    oldValues.title,
    newValues.name,
    oldValues.name,
    newValues.fullName,
    oldValues.fullName,
    newValues.email,
    oldValues.email,
  ]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }

  return `${row.entityType} ${row.entityId}`;
}

/** Short non-sensitive detail line for Admin Audit UI. */
export function deriveAuditDetail(row) {
  const newValues = sanitizeAuditValue(asObject(row.newValues)) ?? {};
  const oldValues = sanitizeAuditValue(asObject(row.oldValues)) ?? {};
  const metadata = sanitizeAuditValue(asObject(row.metadata)) ?? {};
  const parts = [];

  if (oldValues.status !== undefined && newValues.status !== undefined && oldValues.status !== newValues.status) {
    parts.push(`Status ${oldValues.status} → ${newValues.status}`);
  } else if (newValues.status !== undefined) {
    parts.push(`Status: ${newValues.status}`);
  }

  if (newValues.publishedCount !== undefined) {
    parts.push(`${newValues.publishedCount} result${newValues.publishedCount === 1 ? "" : "s"} published`);
  }
  if (newValues.evaluatedAttempts !== undefined) {
    parts.push(`${newValues.evaluatedAttempts} attempt${newValues.evaluatedAttempts === 1 ? "" : "s"} evaluated`);
  }
  if (newValues.role !== undefined) parts.push(`Role: ${newValues.role}`);
  if (newValues.isActive === true) parts.push("Account activated");
  if (newValues.isActive === false) parts.push("Account deactivated");
  if (newValues.type !== undefined) parts.push(`Type: ${newValues.type}`);
  if (newValues.difficulty !== undefined) parts.push(`Difficulty: ${newValues.difficulty}`);
  if (newValues.versionNumber !== undefined) parts.push(`Version ${newValues.versionNumber}`);
  if (newValues.optionCount !== undefined) parts.push(`${newValues.optionCount} options`);
  if (newValues.hasResolution) parts.push("Resolution recorded");
  if (newValues.candidateId) parts.push(`Candidate ${newValues.candidateId}`);
  if (newValues.examId && row.entityType !== "EXAM") parts.push(`Exam ${newValues.examId}`);
  if (newValues.messageLength !== undefined) {
    parts.push(`${newValues.messageLength}-character announcement`);
  }
  if (newValues.minutes !== undefined) {
    parts.push(`${newValues.minutes} compensation minute${newValues.minutes === 1 ? "" : "s"}`);
  }
  if (newValues.score !== undefined && newValues.maxMarks !== undefined) {
    parts.push(`Scored ${newValues.score}/${newValues.maxMarks}`);
  }
  if (metadata.resultId) parts.push(`Result ${metadata.resultId}`);

  return parts.join(". ");
}

/** Map a Prisma AuditLog row (+ actor) to the frontend audit entry DTO. */
export function mapAuditLogEntry(row) {
  return {
    id: row.id,
    at: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    actorId: row.actorId ?? null,
    actorName: row.actor?.fullName ?? "System",
    actorRole: row.actor?.role ?? "SYSTEM",
    action: row.action,
    target: deriveAuditTarget(row),
    detail: deriveAuditDetail(row),
  };
}
