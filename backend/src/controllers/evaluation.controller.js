
import prisma from "../../db/db.js";

// AUTOMATICALLY EVALUATE ALL SUBMITTED ATTEMPTS
const evaluateExam = async (req, res) => {
  try {
    const { examId } = req.params;

    // Verify that the exam belongs to this examiner
    const exam = await prisma.exam.findFirst({
      where: {
        id: examId,
        ownerId: req.user.id,
      },
      include: {
        questions: {
          include: {
            questionVersion: true,
          },
        },
      },
    });

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found.",
      });
    }

    // Automatic evaluation supports choice-based questions only
    const hasWrittenQuestions = exam.questions.some(
      (question) => question.questionVersion.type === "WRITTEN"
    );

    if (hasWrittenQuestions) {
      return res.status(400).json({
        success: false,
        message:
          "This exam contains written questions and cannot be fully evaluated automatically.",
      });
    }

    // Retrieve submitted official attempts
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
        let totalMarks = 0;
        let obtainedMarks = 0;

        for (const attemptQuestion of attempt.questions) {
          const assignedMarks = Number(attemptQuestion.assignedMarks);

          totalMarks += assignedMarks;

          const answer = attemptQuestion.answer;

          const correctOptionIds =
            attemptQuestion.questionVersion.options
              .filter((option) => option.isCorrect)
              .map((option) => option.id)
              .sort();

          const selectedOptionIds =
            answer?.selectedOptions
              .map((selected) => selected.optionId)
              .sort() || [];

          const isCorrect =
            correctOptionIds.length > 0 &&
            correctOptionIds.length === selectedOptionIds.length &&
            correctOptionIds.every(
              (optionId, index) =>
                optionId === selectedOptionIds[index]
            );

          const awardedMarks = isCorrect ? assignedMarks : 0;

          if (isCorrect) {
            obtainedMarks += assignedMarks;
          }

          // Save marks for answered questions
          if (answer) {
            await tx.attemptAnswer.update({
              where: {
                id: answer.id,
              },
              data: {
                awardedMarks,
                gradingMethod: "AUTO",
                gradedById: req.user.id,
                gradedAt: new Date(),
              },
            });
          }
        }

        // Create or update the attempt result
        const result = await tx.result.upsert({
          where: {
            attemptId: attempt.id,
          },
          create: {
            attemptId: attempt.id,
            totalMarks,
            obtainedMarks,
            status: "READY_TO_PUBLISH",
            reviewedById: req.user.id,
            reviewedAt: new Date(),
          },
          update: {
            totalMarks,
            obtainedMarks,
            status: "READY_TO_PUBLISH",
            reviewedById: req.user.id,
            reviewedAt: new Date(),
          },
        });

        results.push({
          attemptId: attempt.id,
          obtainedMarks,
          totalMarks,
          resultId: result.id,
        });
      }

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
