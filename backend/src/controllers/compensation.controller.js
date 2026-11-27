import defaultPrisma from "../../db/db.js";
import { AuditAction, AuditEntityType, writeAuditLog } from "../utils/audit.js";
import {
  DISRUPTION_POLICY,
  MAX_COMPENSATION_MINUTES,
  compensationCapMinutes,
  loadCompensationGrantsByAttempt,
  pairNetworkGaps,
  toDisruptionAttemptDto,
  toIso,
} from "./monitor.controller.js";

function validationError(res, details) {
  return res.status(422).json({
    success: false,
    message: "The compensation could not be recorded.",
    details,
  });
}

export function createCompensationHandlers(db = defaultPrisma) {
  // GET /api/examiner/exams/:examId/compensations
  const listExamCompensations = async (req, res) => {
    try {
      const { examId } = req.params;

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

      const attempts = await db.examAttempt.findMany({
        where: {
          examId,
          mode: "OFFICIAL",
        },
        select: {
          id: true,
          participant: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      });

      const attemptById = new Map(attempts.map((row) => [row.id, row]));
      const grantsByAttempt = await loadCompensationGrantsByAttempt(
        db,
        attempts.map((row) => row.id),
      );

      const compensations = [];
      for (const [attemptId, grants] of grantsByAttempt.entries()) {
        const attempt = attemptById.get(attemptId);
        const candidate = {
          id: attempt?.participant?.id ?? "",
          name: attempt?.participant?.fullName ?? "",
          email: attempt?.participant?.email ?? "",
        };
        for (const grant of grants) {
          compensations.push({
            id: grant.id,
            attemptId,
            candidate,
            minutes: grant.minutes,
            reason: grant.reason,
            grantedBy: grant.grantedBy,
            at: grant.at,
          });
        }
      }

      compensations.sort(
        (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
      );

      return res.status(200).json({
        success: true,
        compensations,
      });
    } catch (error) {
      console.error("List exam compensations error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to retrieve compensation history.",
      });
    }
  };

  // POST /api/examiner/exams/:examId/attempts/:attemptId/compensation
  const grantAttemptCompensation = async (req, res) => {
    try {
      const { examId, attemptId } = req.params;
      const { minutes, reason } = req.body ?? {};
      const now = new Date();

      const exam = await db.exam.findFirst({
        where: {
          id: examId,
          ownerId: req.user.id,
        },
        select: {
          id: true,
          title: true,
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

      const details = {};
      const amount = Number(minutes);
      const reasonText = typeof reason === "string" ? reason.trim() : "";

      if (!Number.isInteger(amount) || amount < 1) {
        details.minutes = "Enter a whole number of minutes, at least 1.";
      }
      if (reasonText.length < 15) {
        details.reason =
          "Write a reason of at least 15 characters. It is stored in the audit trail.";
      }

      if (Object.keys(details).length > 0) {
        return validationError(res, details);
      }

      const result = await db.$transaction(async (tx) => {
        const attempt = await tx.examAttempt.findFirst({
          where: {
            id: attemptId,
            examId,
            mode: "OFFICIAL",
          },
          select: {
            id: true,
            status: true,
            startedAt: true,
            expiresAt: true,
            participantId: true,
            participant: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
            events: {
              where: {
                type: {
                  in: ["NETWORK_DISCONNECTED", "NETWORK_RESTORED"],
                },
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
        });

        if (!attempt) {
          return { error: "ATTEMPT_NOT_FOUND" };
        }

        if (attempt.status !== "IN_PROGRESS") {
          return { error: "ATTEMPT_NOT_ELIGIBLE" };
        }

        const grantsByAttempt = await loadCompensationGrantsByAttempt(tx, [
          attemptId,
        ]);
        const priorGrants = grantsByAttempt.get(attemptId) ?? [];
        const usedMinutes = priorGrants.reduce(
          (sum, grant) => sum + grant.minutes,
          0,
        );
        const capMinutes = compensationCapMinutes(exam.durationMinutes);
        const remainingMinutes = Math.max(0, capMinutes - usedMinutes);

        if (amount > remainingMinutes) {
          return {
            error: "CAP_EXCEEDED",
            details: {
              minutes: `The cap is ${capMinutes} minutes per candidate and ${remainingMinutes} remain.`,
            },
          };
        }

        const previousExpiresAt = attempt.expiresAt;
        const newExpiresAt = new Date(
          new Date(previousExpiresAt).getTime() + amount * 60_000,
        );

        const updated = await tx.examAttempt.update({
          where: { id: attemptId },
          data: {
            expiresAt: newExpiresAt,
            lastActivityAt: now,
          },
          select: {
            id: true,
            status: true,
            startedAt: true,
            expiresAt: true,
          },
        });

        const audit = await writeAuditLog(tx, {
          actorId: req.user.id,
          action: AuditAction.COMPENSATION_GRANTED,
          entityType: AuditEntityType.ATTEMPT,
          entityId: attemptId,
          oldValues: {
            expiresAt: toIso(previousExpiresAt),
          },
          newValues: {
            examId,
            examTitle: exam.title,
            attemptId,
            candidateId: attempt.participantId,
            candidateName: attempt.participant?.fullName ?? "",
            minutes: amount,
            reason: reasonText,
            expiresAt: toIso(newExpiresAt),
            usedMinutes: usedMinutes + amount,
            remainingMinutes: Math.max(0, capMinutes - usedMinutes - amount),
          },
          metadata: {
            capMinutes,
            maxCompensationMinutes: MAX_COMPENSATION_MINUTES,
          },
        });

        const grants = [
          {
            id: audit.id,
            minutes: amount,
            reason: reasonText,
            grantedBy: req.user.fullName ?? "Examiner",
            at: toIso(audit.createdAt ?? now),
          },
          ...priorGrants,
        ];

        const dto = toDisruptionAttemptDto(
          {
            ...updated,
            participant: attempt.participant,
            events: attempt.events,
          },
          exam,
          now,
          grants,
        );

        return { dto };
      });

      if (result.error === "ATTEMPT_NOT_FOUND") {
        return res.status(404).json({
          success: false,
          message: "Attempt not found.",
        });
      }

      if (result.error === "ATTEMPT_NOT_ELIGIBLE") {
        return res.status(400).json({
          success: false,
          message: "Compensation can only be granted while the attempt is in progress.",
        });
      }

      if (result.error === "CAP_EXCEEDED") {
        return validationError(res, result.details);
      }

      return res.status(200).json({
        success: true,
        message: "Compensation recorded.",
        policy: DISRUPTION_POLICY,
        attempt: result.dto,
      });
    } catch (error) {
      console.error("Grant attempt compensation error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to record compensation.",
      });
    }
  };

  return { listExamCompensations, grantAttemptCompensation };
}

const defaultHandlers = createCompensationHandlers();
export const listExamCompensations = defaultHandlers.listExamCompensations;
export const grantAttemptCompensation = defaultHandlers.grantAttemptCompensation;
