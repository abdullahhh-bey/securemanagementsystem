
import prisma from "../../db/db.js";
import { AuditAction, AuditEntityType, writeAuditLog } from "../utils/audit.js";

// CREATE QUESTION
const createQuestion = async (req, res) => {
  try {
    const {
      categoryId,
      questionText,
      difficulty,
      type,
      defaultMarks,
      markingGuide,
      options,
    } = req.body;

    // Validate required fields
    if (
      typeof questionText !== "string" ||
      !questionText.trim() ||
      !["EASY", "MEDIUM", "HARD"].includes(difficulty) ||
      !["SINGLE_CHOICE", "MULTIPLE_SELECT", "WRITTEN"].includes(type) ||
      typeof defaultMarks !== "number" ||
      !Number.isFinite(defaultMarks) ||
      defaultMarks <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid question text, difficulty, type, and marks.",
      });
    }

    // Validate category if provided
    if (categoryId) {
      const category = await prisma.questionCategory.findUnique({
        where: { id: categoryId },
      });

      if (!category) {
        return res.status(404).json({
          success: false,
          message: "Question category not found.",
        });
      }
    }

    // Validate options
    let questionOptions = [];

    if (type === "WRITTEN") {
      if (options !== undefined && (!Array.isArray(options) || options.length > 0)) {
        return res.status(400).json({
          success: false,
          message: "Written questions cannot have multiple-choice options.",
        });
      }
    } else {
      if (!Array.isArray(options) || options.length < 2) {
        return res.status(400).json({
          success: false,
          message: "At least two options are required for choice-based questions.",
        });
      }

      if (
        options.some(
          (option) =>
            typeof option.optionText !== "string" ||
            !option.optionText.trim() ||
            typeof option.isCorrect !== "boolean"
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Every option must have valid text and a correct-answer status.",
        });
      }

      const correctOptions = options.filter((option) => option.isCorrect);

      if (correctOptions.length === 0) {
        return res.status(400).json({
          success: false,
          message: "At least one correct option is required.",
        });
      }

      if (type === "SINGLE_CHOICE" && correctOptions.length !== 1) {
        return res.status(400).json({
          success: false,
          message: "Single-choice questions must have exactly one correct option.",
        });
      }

      questionOptions = options.map((option, index) => ({
        position: index + 1,
        optionText: option.optionText.trim(),
        isCorrect: option.isCorrect,
      }));
    }

    // Create question and its first version
    const question = await prisma.question.create({
      data: {
        authorId: req.user.id,
        categoryId: categoryId || null,
        versions: {
          create: {
            createdById: req.user.id,
            versionNumber: 1,
            questionText: questionText.trim(),
            difficulty,
            type,
            defaultMarks,
            markingGuide: markingGuide ?? null,
            options: {
              create: questionOptions,
            },
          },
        },
      },
      include: {
        versions: {
          include: {
            options: {
              orderBy: { position: "asc" },
            },
          },
        },
      },
    });

    await writeAuditLog(prisma, {
      actorId: req.user.id,
      action: AuditAction.QUESTION_CREATED,
      entityType: AuditEntityType.QUESTION,
      entityId: question.id,
      newValues: {
        categoryId: question.categoryId,
        type,
        difficulty,
        defaultMarks,
        optionCount: questionOptions.length,
        versionNumber: 1,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Question created successfully.",
      data: question,
    });
  } catch (error) {
    console.error("Create question error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create question.",
    });
  }
};

// GET ALL QUESTIONS
const getQuestions = async (req, res) => {
  try {
    const { categoryId } = req.query;

    const questions = await prisma.question.findMany({
      where: {
        authorId: req.user.id,
        isActive: true,
        ...(categoryId ? { categoryId } : {}),
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        category: true,
        versions: {
          orderBy: {
            versionNumber: "desc",
          },
          include: {
            options: {
              orderBy: {
                position: "asc",
              },
            },
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      count: questions.length,
      data: questions,
    });
  } catch (error) {
    console.error("Get questions error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve questions.",
    });
  }
};

// GET QUESTION BY ID
const getQuestionById = async (req, res) => {
  try {
    const { questionId } = req.params;

    const question = await prisma.question.findFirst({
      where: {
        id: questionId,
        authorId: req.user.id,
        isActive: true,
      },
      include: {
        category: true,
        versions: {
          orderBy: {
            versionNumber: "desc",
          },
          include: {
            options: {
              orderBy: {
                position: "asc",
              },
            },
          },
        },
      },
    });

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: question,
    });
  } catch (error) {
    console.error("Get question error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve question.",
    });
  }
};


// CREATE NEW QUESTION VERSION
const createQuestionVersion = async (req, res) => {
  try {
    const { questionId } = req.params;

    const {
      questionText,
      difficulty,
      type,
      defaultMarks,
      markingGuide,
      options,
    } = req.body;

    // Find examiner's question
    const question = await prisma.question.findFirst({
      where: {
        id: questionId,
        authorId: req.user.id,
        isActive: true,
      },
      include: {
        versions: {
          select: {
            versionNumber: true,
          },
          orderBy: {
            versionNumber: "desc",
          },
          take: 1,
        },
      },
    });

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found.",
      });
    }

    if (
      typeof questionText !== "string" ||
      !questionText.trim() ||
      !["EASY", "MEDIUM", "HARD"].includes(difficulty) ||
      !["SINGLE_CHOICE", "MULTIPLE_SELECT", "WRITTEN"].includes(type) ||
      typeof defaultMarks !== "number" ||
      !Number.isFinite(defaultMarks) ||
      defaultMarks <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid question text, difficulty, type, and marks.",
      });
    }

    let questionOptions = [];

    if (type === "WRITTEN") {
      if (options !== undefined && (!Array.isArray(options) || options.length > 0)) {
        return res.status(400).json({
          success: false,
          message: "Written questions cannot have multiple-choice options.",
        });
      }
    } else {
      if (!Array.isArray(options) || options.length < 2) {
        return res.status(400).json({
          success: false,
          message: "At least two options are required.",
        });
      }

      if (
        options.some(
          (option) =>
            typeof option.optionText !== "string" ||
            !option.optionText.trim() ||
            typeof option.isCorrect !== "boolean"
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Every option must have valid text and a correct-answer status.",
        });
      }

      const correctOptions = options.filter((option) => option.isCorrect);

      if (correctOptions.length === 0) {
        return res.status(400).json({
          success: false,
          message: "At least one correct option is required.",
        });
      }

      if (type === "SINGLE_CHOICE" && correctOptions.length !== 1) {
        return res.status(400).json({
          success: false,
          message: "Single-choice questions must have exactly one correct option.",
        });
      }

      questionOptions = options.map((option, index) => ({
        position: index + 1,
        optionText: option.optionText.trim(),
        isCorrect: option.isCorrect,
      }));
    }

    const nextVersionNumber =
      (question.versions[0]?.versionNumber ?? 0) + 1;

    const version = await prisma.questionVersion.create({
      data: {
        questionId,
        createdById: req.user.id,
        versionNumber: nextVersionNumber,
        questionText: questionText.trim(),
        difficulty,
        type,
        defaultMarks,
        markingGuide: markingGuide ?? null,
        options: {
          create: questionOptions,
        },
      },
      include: {
        options: {
          orderBy: {
            position: "asc",
          },
        },
      },
    });

    await writeAuditLog(prisma, {
      actorId: req.user.id,
      action: AuditAction.QUESTION_VERSION_CREATED,
      entityType: AuditEntityType.QUESTION_VERSION,
      entityId: version.id,
      newValues: {
        questionId,
        versionNumber: version.versionNumber,
        type,
        difficulty,
        defaultMarks,
        optionCount: questionOptions.length,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Question version created successfully.",
      data: version,
    });
  } catch (error) {
    console.error("Create question version error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create question version.",
    });
  }
};


/**
 * Deletion strategy:
 * - Hard-delete question + versions + options only when no ExamQuestion /
 *   AttemptQuestion references exist (preserves historical exam/attempt data).
 * - Otherwise soft-delete via Question.isActive = false so bank listing hides
 *   it while version history and exam assignments remain intact.
 */
export function createQuestionDeletionHandlers(db = prisma) {
  const deleteQuestion = async (req, res) => {
    try {
      const { questionId } = req.params;

      const question = await db.question.findFirst({
        where: {
          id: questionId,
          authorId: req.user.id,
          isActive: true,
        },
        select: {
          id: true,
          categoryId: true,
          versions: {
            select: {
              id: true,
              versionNumber: true,
              _count: {
                select: {
                  examQuestions: true,
                  attemptQuestions: true,
                },
              },
            },
          },
        },
      });

      if (!question) {
        return res.status(404).json({
          success: false,
          message: "Question not found.",
        });
      }

      const versionIds = question.versions.map((version) => version.id);
      const examAssignmentCount = question.versions.reduce(
        (sum, version) => sum + (version._count?.examQuestions ?? 0),
        0,
      );
      const attemptReferenceCount = question.versions.reduce(
        (sum, version) => sum + (version._count?.attemptQuestions ?? 0),
        0,
      );
      const isReferenced = examAssignmentCount > 0 || attemptReferenceCount > 0;

      if (isReferenced) {
        await db.$transaction(async (tx) => {
          await tx.question.update({
            where: { id: questionId },
            data: { isActive: false },
          });

          await writeAuditLog(tx, {
            actorId: req.user.id,
            action: AuditAction.QUESTION_DELETED,
            entityType: AuditEntityType.QUESTION,
            entityId: questionId,
            newValues: {
              mode: "soft",
              examAssignmentCount,
              attemptReferenceCount,
              versionCount: question.versions.length,
              categoryId: question.categoryId,
            },
          });
        });

        return res.status(200).json({
          success: true,
          message:
            "Question deactivated. It remains on existing exams and historical attempts.",
          deletion: {
            mode: "soft",
            questionId,
          },
        });
      }

      await db.$transaction(async (tx) => {
        if (versionIds.length > 0) {
          await tx.questionOption.deleteMany({
            where: {
              questionVersionId: { in: versionIds },
            },
          });
          await tx.questionVersion.deleteMany({
            where: {
              questionId,
            },
          });
        }

        await tx.question.delete({
          where: { id: questionId },
        });

        await writeAuditLog(tx, {
          actorId: req.user.id,
          action: AuditAction.QUESTION_DELETED,
          entityType: AuditEntityType.QUESTION,
          entityId: questionId,
          newValues: {
            mode: "hard",
            versionCount: question.versions.length,
            categoryId: question.categoryId,
          },
        });
      });

      return res.status(200).json({
        success: true,
        message: "Question deleted successfully.",
        deletion: {
          mode: "hard",
          questionId,
        },
      });
    } catch (error) {
      console.error("Delete question error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to delete question.",
      });
    }
  };

  return { deleteQuestion };
}

const deletionHandlers = createQuestionDeletionHandlers();
export const deleteQuestion = deletionHandlers.deleteQuestion;

export {
  createQuestion,
  getQuestions,
  getQuestionById,
  createQuestionVersion,
};
