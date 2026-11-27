import defaultPrisma from "../../db/db.js";
import { AuditAction, AuditEntityType, writeAuditLog } from "../utils/audit.js";

const SUBMITTED_STATUSES = Object.freeze(["SUBMITTED", "AUTO_SUBMITTED"]);

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toIso(value) {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function writtenNeedsManualGrade(attemptQuestion) {
  if (attemptQuestion.questionVersion?.type !== "WRITTEN") return false;
  const answer = attemptQuestion.answer;
  if (!answer) return false;
  const text =
    typeof answer.textResponse === "string" ? answer.textResponse.trim() : "";
  return Boolean(text);
}

function isWrittenGraded(answer) {
  return answer != null && answer.awardedMarks != null;
}

export function deriveGradingState({
  examStatus,
  hasPublishedResults,
  pendingWrittenCount,
}) {
  if (examStatus !== "COMPLETED") return "NOT_READY";
  if (hasPublishedResults) return "PUBLISHED";
  if (pendingWrittenCount > 0) return "UNGRADED";
  return "GRADED";
}

/**
 * Sum awarded marks across an attempt and set Result status.
 * Does not overwrite PUBLISHED results.
 */
export async function recalculateAttemptResult(
  tx,
  { attemptId, examinerId, now = new Date() },
) {
  const questions = await tx.attemptQuestion.findMany({
    where: { attemptId },
    include: {
      questionVersion: {
        select: { type: true },
      },
      answer: {
        select: {
          awardedMarks: true,
          textResponse: true,
          status: true,
        },
      },
    },
  });

  let totalMarks = 0;
  let obtainedMarks = 0;
  let pendingWritten = 0;

  for (const attemptQuestion of questions) {
    const assigned = toNumber(attemptQuestion.assignedMarks);
    totalMarks += assigned;
    const answer = attemptQuestion.answer;
    const type = attemptQuestion.questionVersion.type;

    if (type === "WRITTEN") {
      if (writtenNeedsManualGrade(attemptQuestion)) {
        if (!isWrittenGraded(answer)) {
          pendingWritten += 1;
        } else {
          obtainedMarks += toNumber(answer.awardedMarks);
        }
      }
      continue;
    }

    if (answer?.awardedMarks != null) {
      obtainedMarks += toNumber(answer.awardedMarks);
    }
  }

  const existing = await tx.result.findUnique({
    where: { attemptId },
    select: { id: true, status: true },
  });

  if (existing?.status === "PUBLISHED" || existing?.status === "WITHHELD") {
    return {
      result: existing,
      totalMarks,
      obtainedMarks,
      pendingWritten,
      status: existing.status,
    };
  }

  const status =
    pendingWritten > 0 ? "PENDING_REVIEW" : "READY_TO_PUBLISH";

  const result = await tx.result.upsert({
    where: { attemptId },
    create: {
      attemptId,
      totalMarks,
      obtainedMarks,
      status,
      reviewedById: examinerId,
      reviewedAt: now,
    },
    update: {
      totalMarks,
      obtainedMarks,
      status,
      reviewedById: examinerId,
      reviewedAt: now,
    },
  });

  return { result, totalMarks, obtainedMarks, pendingWritten, status };
}

function toQueueItemDto({ attemptQuestion, attemptId, submissionLabel }) {
  const version = attemptQuestion.questionVersion;
  const question = version.question;
  const answer = attemptQuestion.answer;
  const questionId = question?.id ?? version.questionId;
  const graded = isWrittenGraded(answer);

  return {
    key: `${attemptId}:${questionId}`,
    attemptId,
    submissionLabel,
    question: {
      id: questionId,
      text: version.questionText,
      topic: question?.category?.name ?? "",
      maxMarks: toNumber(attemptQuestion.assignedMarks),
      modelAnswer: version.markingGuide ?? "",
    },
    answerText: answer?.textResponse ?? "",
    score: graded ? toNumber(answer.awardedMarks) : null,
    feedback: answer?.feedback ?? "",
    gradedAt: graded ? toIso(answer.gradedAt) : null,
  };
}

export function createGradingHandlers(db = defaultPrisma) {
  // GET /api/examiner/exams/:examId/grading
  const getExamGradingQueue = async (req, res) => {
    try {
      const { examId } = req.params;

      const exam = await db.exam.findFirst({
        where: {
          id: examId,
          ownerId: req.user.id,
        },
        select: {
          id: true,
          status: true,
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
          status: { in: [...SUBMITTED_STATUSES] },
        },
        select: {
          id: true,
          submittedAt: true,
          result: {
            select: { status: true },
          },
          questions: {
            where: {
              questionVersion: { type: "WRITTEN" },
            },
            orderBy: { position: "asc" },
            include: {
              answer: true,
              questionVersion: {
                include: {
                  question: {
                    include: {
                      category: {
                        select: { id: true, name: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          submittedAt: "asc",
        },
      });

      const items = [];
      let pendingWrittenCount = 0;

      attempts.forEach((attempt, index) => {
        const submissionLabel = `Submission ${index + 1}`;
        for (const attemptQuestion of attempt.questions) {
          if (!writtenNeedsManualGrade(attemptQuestion)) continue;
          const item = toQueueItemDto({
            attemptQuestion,
            attemptId: attempt.id,
            submissionLabel,
          });
          items.push(item);
          if (item.score === null) pendingWrittenCount += 1;
        }
      });

      const hasPublishedResults = attempts.some(
        (attempt) => attempt.result?.status === "PUBLISHED",
      );

      const state = deriveGradingState({
        examStatus: exam.status,
        hasPublishedResults,
        pendingWrittenCount,
      });

      return res.status(200).json({
        success: true,
        state,
        progress: {
          graded: items.filter((item) => item.score !== null).length,
          total: items.length,
        },
        items,
      });
    } catch (error) {
      console.error("Get exam grading queue error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to retrieve grading queue.",
      });
    }
  };

  // PUT /api/examiner/exams/:examId/attempts/:attemptId/answers/:questionId/grade
  const saveWrittenGrade = async (req, res) => {
    try {
      const { examId, attemptId, questionId } = req.params;
      const { score, feedback } = req.body ?? {};
      const now = new Date();

      const exam = await db.exam.findFirst({
        where: {
          id: examId,
          ownerId: req.user.id,
        },
        select: {
          id: true,
          title: true,
          status: true,
        },
      });

      if (!exam) {
        return res.status(404).json({
          success: false,
          message: "Exam not found.",
        });
      }

      const details = {};
      const numericScore = Number(score);
      if (
        score === "" ||
        score === null ||
        score === undefined ||
        Number.isNaN(numericScore)
      ) {
        details.score = "Enter a score.";
      }

      const result = await db.$transaction(async (tx) => {
        const attempt = await tx.examAttempt.findFirst({
          where: {
            id: attemptId,
            examId,
            mode: "OFFICIAL",
            status: { in: [...SUBMITTED_STATUSES] },
          },
          select: {
            id: true,
            submittedAt: true,
            result: {
              select: { status: true },
            },
          },
        });

        if (!attempt) {
          return { error: "ATTEMPT_NOT_FOUND" };
        }

        if (attempt.result?.status === "PUBLISHED") {
          return { error: "RESULTS_PUBLISHED" };
        }

        const attemptQuestion = await tx.attemptQuestion.findFirst({
          where: {
            attemptId,
            questionVersion: {
              questionId,
              type: "WRITTEN",
            },
          },
          include: {
            answer: true,
            questionVersion: {
              include: {
                question: {
                  include: {
                    category: {
                      select: { id: true, name: true },
                    },
                  },
                },
              },
            },
          },
        });

        if (!attemptQuestion || !writtenNeedsManualGrade(attemptQuestion)) {
          return { error: "ANSWER_NOT_FOUND" };
        }

        const maxMarks = toNumber(attemptQuestion.assignedMarks);

        if (details.score) {
          return { error: "VALIDATION", details };
        }

        if (numericScore < 0 || numericScore > maxMarks) {
          return {
            error: "VALIDATION",
            details: {
              score: `The score must be between 0 and ${maxMarks}.`,
            },
          };
        }

        const feedbackText =
          typeof feedback === "string" ? feedback.trim() : "";

        // Upsert answer row if somehow missing (should exist for answered written).
        let answerId = attemptQuestion.answer?.id;
        if (!answerId) {
          const created = await tx.attemptAnswer.create({
            data: {
              attemptQuestionId: attemptQuestion.id,
              textResponse: attemptQuestion.answer?.textResponse ?? "",
              status: "ANSWERED",
              awardedMarks: numericScore,
              gradingMethod: "MANUAL",
              feedback: feedbackText || null,
              gradedById: req.user.id,
              gradedAt: now,
            },
          });
          answerId = created.id;
        } else {
          await tx.attemptAnswer.update({
            where: { id: answerId },
            data: {
              awardedMarks: numericScore,
              gradingMethod: "MANUAL",
              feedback: feedbackText || null,
              gradedById: req.user.id,
              gradedAt: now,
            },
          });
        }

        const recalculated = await recalculateAttemptResult(tx, {
          attemptId,
          examinerId: req.user.id,
          now,
        });

        await writeAuditLog(tx, {
          actorId: req.user.id,
          action: AuditAction.GRADE_SAVED,
          entityType: AuditEntityType.ATTEMPT_ANSWER,
          entityId: answerId,
          newValues: {
            examId,
            examTitle: exam.title,
            attemptId,
            questionId,
            score: numericScore,
            maxMarks,
            hasFeedback: Boolean(feedbackText),
            resultStatus: recalculated.status,
            obtainedMarks: recalculated.obtainedMarks,
          },
        });

        const refreshed = await tx.attemptQuestion.findFirst({
          where: { id: attemptQuestion.id },
          include: {
            answer: true,
            questionVersion: {
              include: {
                question: {
                  include: {
                    category: {
                      select: { id: true, name: true },
                    },
                  },
                },
              },
            },
          },
        });

        const siblings = await tx.examAttempt.findMany({
          where: {
            examId,
            mode: "OFFICIAL",
            status: { in: [...SUBMITTED_STATUSES] },
          },
          select: { id: true },
          orderBy: { submittedAt: "asc" },
        });
        const submissionIndex = siblings.findIndex((row) => row.id === attemptId);

        return {
          item: toQueueItemDto({
            attemptQuestion: refreshed,
            attemptId,
            submissionLabel: `Submission ${submissionIndex + 1}`,
          }),
          recalculated,
        };
      });

      if (result.error === "ATTEMPT_NOT_FOUND") {
        return res.status(400).json({
          success: false,
          message: "Only submitted attempts can be graded.",
        });
      }

      if (result.error === "RESULTS_PUBLISHED") {
        return res.status(409).json({
          success: false,
          message:
            "Results are already published. Changes now go through a dispute resolution, which creates a new score version.",
        });
      }

      if (result.error === "ANSWER_NOT_FOUND") {
        return res.status(404).json({
          success: false,
          message: "That answer was not found.",
        });
      }

      if (result.error === "VALIDATION") {
        return res.status(422).json({
          success: false,
          message: "The grade could not be saved.",
          details: result.details,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Grade saved.",
        item: result.item,
      });
    } catch (error) {
      console.error("Save written grade error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to save grade.",
      });
    }
  };

  return { getExamGradingQueue, saveWrittenGrade };
}

const defaultHandlers = createGradingHandlers();
export const getExamGradingQueue = defaultHandlers.getExamGradingQueue;
export const saveWrittenGrade = defaultHandlers.saveWrittenGrade;
