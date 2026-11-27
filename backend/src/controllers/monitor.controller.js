import defaultPrisma from "../../db/db.js";
import { AuditAction, AuditEntityType } from "../utils/audit.js";

/**
 * Soft presence threshold for IN_PROGRESS attempts.
 * Based on lastActivityAt only — not true realtime presence.
 * 90s allows a few missed poll cycles (UI polls ~5s) before OFFLINE.
 */
export const MONITOR_INACTIVITY_MS = 90_000;

export function deriveMonitorConnection(attempt, now = new Date()) {
  if (attempt.status !== "IN_PROGRESS") {
    return "ENDED";
  }

  const lastSeen = new Date(attempt.lastActivityAt).getTime();
  if (Number.isNaN(lastSeen)) {
    return "OFFLINE";
  }

  return now.getTime() - lastSeen <= MONITOR_INACTIVITY_MS ? "ONLINE" : "OFFLINE";
}

function progressPercent(answered, total) {
  if (!total) return 0;
  return Math.round((answered / total) * 100);
}

function toMonitorAttemptDto(attempt, now, compensationMinutes = 0) {
  const total = attempt._count?.questions ?? 0;
  const answered = Array.isArray(attempt.questions) ? attempt.questions.length : 0;
  const incidentCount = attempt._count?.events ?? 0;
  const connection = deriveMonitorConnection(attempt, now);

  return {
    id: attempt.id,
    candidate: {
      id: attempt.participant?.id ?? "",
      name: attempt.participant?.fullName ?? "",
      email: attempt.participant?.email ?? "",
    },
    status: attempt.status,
    startedAt: attempt.startedAt,
    answered,
    total,
    progressPercent: progressPercent(answered, total),
    lastSeenAt:
      attempt.lastActivityAt ??
      attempt.submittedAt ??
      attempt.startedAt ??
      null,
    connection,
    incidentCount,
    personalDeadline: attempt.expiresAt ?? null,
    compensationMinutes,
  };
}

/** Matches mock compensation cap until grant APIs exist. */
export const MAX_COMPENSATION_MINUTES = 30;

export const DISRUPTION_POLICY =
  "The exam deadline is never extended silently. Every compensation is recorded with a reason, shown to the candidate and written to the audit log.";

const NETWORK_EVENT_TYPES = Object.freeze([
  "NETWORK_DISCONNECTED",
  "NETWORK_RESTORED",
]);

/**
 * Pair NETWORK_DISCONNECTED → NETWORK_RESTORED chronologically per attempt.
 * Unresolved disconnects become ongoing gaps (to: null).
 * Other event types must be filtered out before calling.
 */
export function pairNetworkGaps(events, now = new Date()) {
  const sorted = [...(events ?? [])].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );

  const gaps = [];
  let open = null;

  for (const event of sorted) {
    if (event.type === "NETWORK_DISCONNECTED") {
      if (!open) {
        open = event;
      }
      continue;
    }

    if (event.type === "NETWORK_RESTORED" && open) {
      const fromMs = new Date(open.occurredAt).getTime();
      const toMs = new Date(event.occurredAt).getTime();
      gaps.push({
        id: open.id,
        from: toIso(open.occurredAt),
        to: toIso(event.occurredAt),
        ongoing: false,
        seconds: Math.max(0, Math.round((toMs - fromMs) / 1000)),
      });
      open = null;
    }
  }

  if (open) {
    const fromMs = new Date(open.occurredAt).getTime();
    const endMs = now.getTime();
    gaps.push({
      id: open.id,
      from: toIso(open.occurredAt),
      to: null,
      ongoing: true,
      seconds: Math.max(0, Math.round((endMs - fromMs) / 1000)),
    });
  }

  return gaps;
}

export function compensationCapMinutes(durationMinutes) {
  const duration = Number(durationMinutes) || 0;
  return Math.min(MAX_COMPENSATION_MINUTES, Math.round(duration * 0.25));
}

export function toIso(value) {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function originalDeadlineIso(attempt, exam) {
  const started = new Date(attempt.startedAt).getTime();
  const durationMs = (Number(exam.durationMinutes) || 0) * 60_000;
  const windowEnd = new Date(exam.endsAt).getTime();
  if (Number.isNaN(started)) return toIso(attempt.expiresAt);
  const original = Math.min(started + durationMs, windowEnd);
  return toIso(original);
}

/** Map AuditLog compensation rows → MonitorTab grant DTO fragments. */
export function mapCompensationGrant(log) {
  const values =
    log.newValues && typeof log.newValues === "object" && !Array.isArray(log.newValues)
      ? log.newValues
      : {};
  return {
    id: log.id,
    minutes: Number(values.minutes) || 0,
    reason: typeof values.reason === "string" ? values.reason : "",
    grantedBy: log.actor?.fullName ?? "Examiner",
    at: toIso(log.createdAt),
    attemptId: String(log.entityId),
    candidateId: typeof values.candidateId === "string" ? values.candidateId : null,
  };
}

/**
 * Load COMPENSATION_GRANTED audit rows for the given attempt IDs.
 * @returns {Promise<Map<string, ReturnType<typeof mapCompensationGrant>[]>>}
 */
export async function loadCompensationGrantsByAttempt(db, attemptIds) {
  const ids = [...new Set((attemptIds ?? []).filter(Boolean))];
  const byAttempt = new Map(ids.map((id) => [id, []]));
  if (!ids.length || typeof db.auditLog?.findMany !== "function") {
    return byAttempt;
  }

  const logs = await db.auditLog.findMany({
    where: {
      action: AuditAction.COMPENSATION_GRANTED,
      entityType: AuditEntityType.ATTEMPT,
      entityId: { in: ids },
    },
    include: {
      actor: {
        select: {
          fullName: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  for (const log of logs) {
    const grant = mapCompensationGrant(log);
    const list = byAttempt.get(grant.attemptId);
    if (list) list.push(grant);
  }

  return byAttempt;
}

export function toDisruptionAttemptDto(attempt, exam, now, grants = []) {
  const gaps = pairNetworkGaps(attempt.events, now);
  const totalGapSeconds = gaps.reduce((sum, gap) => sum + gap.seconds, 0);
  const longestGapSeconds = gaps.length
    ? Math.max(...gaps.map((gap) => gap.seconds))
    : 0;
  const capMinutes = compensationCapMinutes(exam.durationMinutes);
  const usedMinutes = grants.reduce((sum, grant) => sum + (Number(grant.minutes) || 0), 0);
  const personalDeadline = toIso(attempt.expiresAt);

  return {
    attemptId: attempt.id,
    candidate: {
      id: attempt.participant?.id ?? "",
      name: attempt.participant?.fullName ?? "",
      email: attempt.participant?.email ?? "",
    },
    status: attempt.status,
    gaps,
    totalGapSeconds,
    longestGapSeconds,
    cap: {
      capMinutes,
      usedMinutes,
      remainingMinutes: Math.max(0, capMinutes - usedMinutes),
    },
    originalDeadline: originalDeadlineIso(attempt, exam),
    personalDeadline,
    compensationMinutes: usedMinutes,
    compensations: grants.map((grant) => ({
      id: grant.id,
      minutes: grant.minutes,
      reason: grant.reason,
      grantedBy: grant.grantedBy,
      at: grant.at,
    })),
  };
}

export function createMonitorHandlers(db = defaultPrisma) {
  // GET /api/examiner/exams/:examId/monitor
  const getExamMonitor = async (req, res) => {
    try {
      const { examId } = req.params;
      const now = new Date();

      const exam = await db.exam.findFirst({
        where: {
          id: examId,
          ownerId: req.user.id,
        },
        select: { id: true },
      });

      if (!exam) {
        return res.status(404).json({
          success: false,
          message: "Exam not found.",
        });
      }

      const [enrolled, attempts] = await Promise.all([
        db.examEnrollment.count({
          where: {
            examId,
            status: "ENROLLED",
          },
        }),
        db.examAttempt.findMany({
          where: {
            examId,
            mode: "OFFICIAL",
          },
          select: {
            id: true,
            status: true,
            startedAt: true,
            expiresAt: true,
            submittedAt: true,
            lastActivityAt: true,
            participant: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
            // Only ANSWERED AttemptAnswer rows — genuine progress.
            questions: {
              where: {
                answer: {
                  status: "ANSWERED",
                },
              },
              select: { id: true },
            },
            _count: {
              select: {
                questions: true,
                events: true,
              },
            },
          },
          orderBy: {
            startedAt: "desc",
          },
        }),
      ]);

      const grantsByAttempt = await loadCompensationGrantsByAttempt(
        db,
        attempts.map((attempt) => attempt.id),
      );

      const rows = attempts
        .map((attempt) => {
          const grants = grantsByAttempt.get(attempt.id) ?? [];
          const compensationMinutes = grants.reduce(
            (sum, grant) => sum + (Number(grant.minutes) || 0),
            0,
          );
          return toMonitorAttemptDto(attempt, now, compensationMinutes);
        })
        .sort((a, b) => a.candidate.name.localeCompare(b.candidate.name));

      const inProgress = rows.filter((row) => row.status === "IN_PROGRESS");

      return res.status(200).json({
        success: true,
        serverTime: now.toISOString(),
        summary: {
          enrolled,
          started: rows.length,
          notStarted: Math.max(0, enrolled - rows.length),
          online: inProgress.filter((row) => row.connection === "ONLINE").length,
          offline: inProgress.filter((row) => row.connection === "OFFLINE").length,
          incidents: rows.reduce((sum, row) => sum + row.incidentCount, 0),
        },
        attempts: rows,
      });
    } catch (error) {
      console.error("Get exam monitor error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to retrieve live monitoring data.",
      });
    }
  };

  // GET /api/examiner/exams/:examId/disruptions
  const listExamDisruptions = async (req, res) => {
    try {
      const { examId } = req.params;
      const now = new Date();

      const exam = await db.exam.findFirst({
        where: {
          id: examId,
          ownerId: req.user.id,
        },
        select: {
          id: true,
          durationMinutes: true,
          endsAt: true,
        },
      });

      if (!exam) {
        return res.status(404).json({
          success: false,
          message: "Exam not found.",
        });
      }

      const attempts = await db.examAttempt.findMany({
        where: {
          examId,
          mode: "OFFICIAL",
        },
        select: {
          id: true,
          status: true,
          startedAt: true,
          expiresAt: true,
          participant: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          events: {
            where: {
              type: { in: [...NETWORK_EVENT_TYPES] },
            },
            select: {
              id: true,
              type: true,
              occurredAt: true,
            },
            orderBy: {
              occurredAt: "asc",
            },
          },
        },
        orderBy: {
          startedAt: "desc",
        },
      });

      const grantsByAttempt = await loadCompensationGrantsByAttempt(
        db,
        attempts.map((attempt) => attempt.id),
      );

      const rows = attempts
        .map((attempt) =>
          toDisruptionAttemptDto(
            attempt,
            exam,
            now,
            grantsByAttempt.get(attempt.id) ?? [],
          ),
        )
        .sort((a, b) => b.totalGapSeconds - a.totalGapSeconds);

      return res.status(200).json({
        success: true,
        policy: DISRUPTION_POLICY,
        attempts: rows,
      });
    } catch (error) {
      console.error("List exam disruptions error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to retrieve disruption history.",
      });
    }
  };

  return { getExamMonitor, listExamDisruptions };
}

const defaultHandlers = createMonitorHandlers();
export const getExamMonitor = defaultHandlers.getExamMonitor;
export const listExamDisruptions = defaultHandlers.listExamDisruptions;
