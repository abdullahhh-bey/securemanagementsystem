import prisma from "../../db/db.js";

const FINAL_ATTEMPT_STATUSES = Object.freeze(["SUBMITTED", "AUTO_SUBMITTED"]);

function percent(numerator, denominator) {
  return denominator ? Math.round((numerator / denominator) * 10000) / 100 : 0;
}

function createQuestionStats(question) {
  const options = question.options ?? [];
  return {
    questionId: question.questionId,
    questionVersionId: question.questionVersionId,
    versionNumber: question.versionNumber,
    position: question.position,
    label: `Q${question.position} · v${question.versionNumber}`,
    text: question.questionText,
    type: question.type,
    attempts: 0,
    skipped: 0,
    ungraded: 0,
    gradedResponses: 0,
    correct: 0,
    partial: 0,
    incorrect: 0,
    awardedMarks: 0,
    availableMarks: 0,
    answeredChoiceResponses: 0,
    optionStats: new Map(
      options.map((option) => [
        option.id,
        { id: option.id, text: option.optionText, isCorrect: option.isCorrect, selectedCount: 0 },
      ]),
    ),
  };
}

function toQuestionDto(stats) {
  const averageScorePercent = stats.availableMarks
    ? percent(stats.awardedMarks, stats.availableMarks)
    : null;
  const observedDifficulty =
    averageScorePercent == null
      ? null
      : averageScorePercent >= 70
        ? "EASY"
        : averageScorePercent >= 40
          ? "MEDIUM"
          : "HARD";

  return {
    questionId: stats.questionId,
    questionVersionId: stats.questionVersionId,
    versionNumber: stats.versionNumber,
    position: stats.position,
    label: stats.label,
    text: stats.text,
    type: stats.type,
    attempts: stats.attempts,
    skipped: stats.skipped,
    ungraded: stats.ungraded,
    gradedResponses: stats.gradedResponses,
    correct: stats.correct,
    partial: stats.partial,
    incorrect: stats.incorrect,
    skippedRate: percent(stats.skipped, stats.attempts),
    incorrectRate: percent(stats.incorrect, stats.gradedResponses),
    correctRate: percent(stats.correct, stats.gradedResponses),
    partialRate: percent(stats.partial, stats.gradedResponses),
    averageScorePercent,
    observedDifficulty,
    responsePatterns: {
      answeredChoiceResponses: stats.answeredChoiceResponses,
      options: [...stats.optionStats.values()].map((option) => ({
        ...option,
        selectedRate: percent(option.selectedCount, stats.answeredChoiceResponses),
      })),
    },
  };
}

export function createQuestionAnalyticsHandlers(db = prisma) {
  const getQuestionAnalytics = async (req, res) => {
    try {
      const { examId } = req.params;
      const exam = await db.exam.findFirst({
        where: { id: examId, ownerId: req.user.id },
        select: { id: true },
      });
      if (!exam) {
        return res.status(404).json({ success: false, message: "Exam not found." });
      }

      const attempts = await db.examAttempt.findMany({
        where: {
          examId,
          mode: "OFFICIAL",
          status: { in: [...FINAL_ATTEMPT_STATUSES] },
        },
        orderBy: { submittedAt: "asc" },
        include: {
          questions: {
            orderBy: { position: "asc" },
            include: {
              questionVersion: {
                include: {
                  options: {
                    orderBy: { position: "asc" },
                    select: { id: true, optionText: true, isCorrect: true },
                  },
                },
              },
              answer: {
                include: {
                  selectedOptions: { select: { optionId: true } },
                },
              },
            },
          },
        },
      });

      const statsByQuestion = new Map();
      for (const attempt of attempts) {
        for (const item of attempt.questions) {
          const version = item.questionVersion;
          const questionVersionId = version.id;
          let stats = statsByQuestion.get(questionVersionId);
          if (!stats) {
            stats = createQuestionStats({
              questionId: version.questionId,
              questionVersionId,
              versionNumber: version.versionNumber,
              position: item.position,
              questionText: version.questionText,
              type: version.type,
              options: version.options,
            });
            statsByQuestion.set(questionVersionId, stats);
          }

          stats.attempts += 1;
          const answer = item.answer;
          if (!answer || answer.status !== "ANSWERED") {
            stats.skipped += 1;
            continue;
          }

          if (version.type !== "WRITTEN") {
            stats.answeredChoiceResponses += 1;
            for (const selection of answer.selectedOptions ?? []) {
              const option = stats.optionStats.get(selection.optionId);
              if (option) option.selectedCount += 1;
            }
          }

          if (answer.awardedMarks == null) {
            stats.ungraded += 1;
            continue;
          }

          const awarded = Number(answer.awardedMarks);
          const available = Number(item.assignedMarks);
          if (!Number.isFinite(awarded) || !Number.isFinite(available) || available <= 0) {
            throw new Error(`Invalid marks stored for attempt question ${item.id}.`);
          }

          stats.gradedResponses += 1;
          stats.awardedMarks += awarded;
          stats.availableMarks += available;
          if (awarded <= 0) stats.incorrect += 1;
          else if (awarded >= available) stats.correct += 1;
          else stats.partial += 1;
        }
      }

      const questions = [...statsByQuestion.values()]
        .sort((a, b) => a.position - b.position)
        .map(toQuestionDto);

      return res.status(200).json({
        success: true,
        finalAttemptCount: attempts.length,
        questions,
      });
    } catch (error) {
      console.error("Question analytics error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to retrieve question analytics.",
      });
    }
  };

  return { getQuestionAnalytics };
}

const handlers = createQuestionAnalyticsHandlers();
export const getQuestionAnalytics = handlers.getQuestionAnalytics;
