import defaultPrisma from "../../db/db.js";

/** Mirrors prisma AttemptEventType — keep in sync with schema.prisma. */
export const ATTEMPT_EVENT_TYPES = Object.freeze([
  "NETWORK_DISCONNECTED",
  "NETWORK_RESTORED",
  "ANSWER_SAVE_FAILED",
  "ANSWER_SAVE_SUCCEEDED",
  "TAB_HIDDEN",
  "WINDOW_BLURRED",
  "ATTEMPT_RESUMED",
]);

const ATTEMPT_EVENT_TYPE_SET = new Set(ATTEMPT_EVENT_TYPES);

/** Shape aligned with examiner incident mapping (`occurredAt` + optional `metadata`). */
export function toAttemptEventDto(event) {
  return {
    id: event.id,
    type: event.type,
    occurredAt: event.occurredAt,
    metadata: event.metadata ?? null,
  };
}

export function createCandidateEventHandlers(db = defaultPrisma) {
  // POST /api/candidate/attempts/:attemptId/events  { type, metadata? }
  const reportAttemptEvent = async (req, res) => {
    try {
      const candidateId = req.user.id;
      const { attemptId } = req.params;
      const { type, metadata } = req.body ?? {};

      if (typeof type !== "string" || !ATTEMPT_EVENT_TYPE_SET.has(type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid attempt event type.",
        });
      }

      if (metadata !== undefined && metadata !== null) {
        if (typeof metadata !== "object" || Array.isArray(metadata)) {
          return res.status(400).json({
            success: false,
            message: "Event metadata must be a JSON object when provided.",
          });
        }
      }

      const now = new Date();

      const result = await db.$transaction(async (tx) => {
        const attempt = await tx.examAttempt.findFirst({
          where: {
            id: attemptId,
            participantId: candidateId,
            mode: "OFFICIAL",
          },
          select: {
            id: true,
            status: true,
          },
        });

        if (!attempt) {
          return { error: "ATTEMPT_NOT_FOUND" };
        }

        if (attempt.status !== "IN_PROGRESS") {
          return { error: "ATTEMPT_NOT_ACTIVE" };
        }

        const event = await tx.attemptEvent.create({
          data: {
            attemptId,
            type,
            occurredAt: now,
            metadata: metadata ?? null,
          },
        });

        await tx.examAttempt.update({
          where: { id: attemptId },
          data: { lastActivityAt: now },
        });

        return { event };
      });

      if (result.error === "ATTEMPT_NOT_FOUND") {
        return res.status(404).json({
          success: false,
          message: "Attempt not found.",
        });
      }

      if (result.error === "ATTEMPT_NOT_ACTIVE") {
        return res.status(400).json({
          success: false,
          message: "This attempt is no longer in progress.",
        });
      }

      return res.status(201).json({
        success: true,
        event: toAttemptEventDto(result.event),
      });
    } catch (error) {
      console.error("Report attempt event error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to record attempt event.",
      });
    }
  };

  return { reportAttemptEvent };
}

const defaultHandlers = createCandidateEventHandlers();
export const reportAttemptEvent = defaultHandlers.reportAttemptEvent;
