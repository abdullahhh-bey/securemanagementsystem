
import prisma from "../../db/db.js";
import { AuditAction, AuditEntityType, writeAuditLog } from "../utils/audit.js";
import { recalculateAttemptResult } from "./grading.controller.js";

function scoreChoiceQuestion(attemptQuestion) {
  const assignedMarks = Number(attemptQuestion.assignedMarks) || 0;
  const answer = attemptQuestion.answer;
  const correctOptionIds = (attemptQuestion.questionVersion.options ?? [])
    .filter((option) => option.isCorrect)
    .map((option) => option.id)
    .sort();

  const selectedOptionIds =
    answer?.selectedOptions?.map((selected) => selected.optionId).sort() || [];

  const isCorrect =
    correctOptionIds.length > 0 &&
    correctOptionIds.length === selectedOptionIds.length &&
    correctOptionIds.every(
      (optionId, index) => optionId === selectedOptionIds[index],
    );

  return {
    assignedMarks,
    awardedMarks: isCorrect ? assignedMarks : 0,
    answer,
  };
}

// AUTOMATICALLY EVALUATE CHOICE QUESTIONS ON SUBMITTED ATTEMPTS
// Written answers are left for manual grading and are never overwritten here.
const evaluateExam = async (req, res) => {
  try {
    const { examId } = req.params;
    const now = new Date();

    const exam = await prisma.exam.findFirst({
      where: {
        id: examId,
        ownerId: req.user.id,
      },
      select: {
        id: true,
        title: true,
      },
    });

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found.",
      });
    }

    const attempts = await prisma.examAttempt.findMany({
      where: {
        examId,
        mode: "OFFICIAL",
        status: {
          in: ["SUBMITTED", "AUTO_SUBMITTED"],
        },
      },
      include: {
        questions: {
          include: {
            questionVersion: {
              include: {
                options: true,
              },
            },
            answer: {
              include: {
                selectedOptions: true,
              },
            },
          },
        },
      },
    });

    if (attempts.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No submitted attempts are available for evaluation.",
      });
    }

    const evaluatedResults = await prisma.$transaction(async (tx) => {
      const results = [];

      for (const attempt of attempts) {
        for (const attemptQuestion of attempt.questions) {
          const type = attemptQuestion.questionVersion.type;

          // Never touch written answers — manual grading owns those marks.
          if (type === "WRITTEN") {
            continue;
          }

          const { awardedMarks, answer } = scoreChoiceQuestion(attemptQuestion);

          if (!answer) {
            continue;
          }

          // Preserve any unexpected manual override on choice answers.
          if (answer.gradingMethod === "MANUAL") {
            continue;
          }

          await tx.attemptAnswer.update({
            where: {
              id: answer.id,
            },
            data: {
              awardedMarks,
              gradingMethod: "AUTO",
              gradedById: req.user.id,
              gradedAt: now,
            },
          });
        }

        const recalculated = await recalculateAttemptResult(tx, {
          attemptId: attempt.id,
          examinerId: req.user.id,
          now,
        });

        results.push({
          attemptId: attempt.id,
          obtainedMarks: recalculated.obtainedMarks,
          totalMarks: recalculated.totalMarks,
          resultId: recalculated.result.id,
          status: recalculated.status,
        });
      }

      await writeAuditLog(tx, {
        actorId: req.user.id,
        action: AuditAction.EXAM_EVALUATED,
        entityType: AuditEntityType.EXAM,
        entityId: examId,
        newValues: {
          evaluatedAttempts: results.length,
          examTitle: exam.title,
        },
      });

      return results;
    });

    return res.status(200).json({
      success: true,
      message: "Exam evaluated successfully.",
      data: {
        evaluatedAttempts: evaluatedResults.length,
        results: evaluatedResults,
      },
    });
  } catch (error) {
    console.error("Automatic evaluation error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to evaluate exam.",
    });
  }
};

export { evaluateExam };
