
import prisma from "../../db/db.js";

// CREATE EXAM
const createExam = async (req, res) => {
  try {
    const {
      title,
      description,
      instructions,
      startsAt,
      endsAt,
      durationMinutes,
      maxAttempts,
      randomizeQuestions,
      randomizeOptions,
    } = req.body;

    // Validate required fields
    if (
      typeof title !== "string" ||
      !title.trim() ||
      !startsAt ||
      !endsAt ||
      !Number.isInteger(durationMinutes) ||
      durationMinutes <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Title, start date, end date, and valid duration are required.",
      });
    }

    const startDate = new Date(startsAt);
    const endDate = new Date(endsAt);

    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      endDate <= startDate
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid exam dates. End date must be after start date.",
      });
    }

    if (
      maxAttempts !== undefined &&
      (!Number.isInteger(maxAttempts) || maxAttempts < 1)
    ) {
      return res.status(400).json({
        success: false,
        message: "Maximum attempts must be a positive integer.",
      });
    }

    const exam = await prisma.exam.create({
      data: {
        ownerId: req.user.id,
        title: title.trim(),
        description: description ?? null,
        instructions: instructions ?? null,
        startsAt: startDate,
        endsAt: endDate,
        durationMinutes,
        maxAttempts: maxAttempts ?? 1,
        randomizeQuestions: randomizeQuestions ?? false,
        randomizeOptions: randomizeOptions ?? false,
        status: "DRAFT",
      },
    });

    return res.status(201).json({
      success: true,
      message: "Exam created successfully.",
      data: exam,
    });
  } catch (error) {
    console.error("Create exam error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create exam.",
    });
  }
};

// GET ALL EXAMS CREATED BY EXAMINER
const getExams = async (req, res) => {
  try {
    const exams = await prisma.exam.findMany({
      where: {
        ownerId: req.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        _count: {
          select: {
            questions: true,
            enrollments: true,
            attempts: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      count: exams.length,
      data: exams,
    });
  } catch (error) {
    console.error("Get exams error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve exams.",
    });
  }
};

// GET SINGLE EXAM
const getExamById = async (req, res) => {
  try {
    const { examId } = req.params;

    const exam = await prisma.exam.findFirst({
      where: {
        id: examId,
        ownerId: req.user.id,
      },
      include: {
        questions: {
          orderBy: {
            position: "asc",
          },
          include: {
            questionVersion: {
              include: {
                options: {
                  orderBy: {
                    position: "asc",
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            enrollments: true,
            attempts: true,
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

    return res.status(200).json({
      success: true,
      data: exam,
    });
  } catch (error) {
    console.error("Get exam by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve exam.",
    });
  }
};


// UPDATE EXAM
const updateExam = async (req, res) => {
  try {
    const { examId } = req.params;

    const existingExam = await prisma.exam.findFirst({
      where: {
        id: examId,
        ownerId: req.user.id,
      },
    });

    if (!existingExam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found.",
      });
    }

    // Only draft exams can be edited
    if (existingExam.status !== "DRAFT") {
      return res.status(400).json({
        success: false,
        message: "Only draft exams can be updated.",
      });
    }

    const {
      title,
      description,
      instructions,
      startsAt,
      endsAt,
      durationMinutes,
      maxAttempts,
      randomizeQuestions,
      randomizeOptions,
    } = req.body;

    const data = {};

    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) {
        return res.status(400).json({
          success: false,
          message: "Exam title cannot be empty.",
        });
      }
      data.title = title.trim();
    }

    if (description !== undefined) {
      if (description !== null && typeof description !== "string") {
        return res.status(400).json({
          success: false,
          message: "Description must be a string or null.",
        });
      }
      data.description = description;
    }

    if (instructions !== undefined) {
      if (instructions !== null && typeof instructions !== "string") {
        return res.status(400).json({
          success: false,
          message: "Instructions must be a string or null.",
        });
      }
      data.instructions = instructions;
    }

    if (startsAt !== undefined) {
      const date = new Date(startsAt);

      if (Number.isNaN(date.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid exam start date.",
        });
      }

      data.startsAt = date;
    }

    if (endsAt !== undefined) {
      const date = new Date(endsAt);

      if (Number.isNaN(date.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid exam end date.",
        });
      }

      data.endsAt = date;
    }

    const finalStart = data.startsAt ?? existingExam.startsAt;
    const finalEnd = data.endsAt ?? existingExam.endsAt;

    if (finalEnd <= finalStart) {
      return res.status(400).json({
        success: false,
        message: "Exam end date must be after its start date.",
      });
    }

    if (durationMinutes !== undefined) {
      if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
        return res.status(400).json({
          success: false,
          message: "Duration must be a positive integer.",
        });
      }
      data.durationMinutes = durationMinutes;
    }

    if (maxAttempts !== undefined) {
      if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
        return res.status(400).json({
          success: false,
          message: "Maximum attempts must be a positive integer.",
        });
      }
      data.maxAttempts = maxAttempts;
    }

    if (randomizeQuestions !== undefined) {
      if (typeof randomizeQuestions !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "randomizeQuestions must be a boolean.",
        });
      }
      data.randomizeQuestions = randomizeQuestions;
    }

    if (randomizeOptions !== undefined) {
      if (typeof randomizeOptions !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "randomizeOptions must be a boolean.",
        });
      }
      data.randomizeOptions = randomizeOptions;
    }

    const updatedExam = await prisma.exam.update({
      where: { id: examId },
      data,
    });

    return res.status(200).json({
      success: true,
      message: "Exam updated successfully.",
      data: updatedExam,
    });
  } catch (error) {
    console.error("Update exam error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update exam.",
    });
  }
};

// DELETE EXAM
const deleteExam = async (req, res) => {
  try {
    const { examId } = req.params;

    const exam = await prisma.exam.findFirst({
      where: {
        id: examId,
        ownerId: req.user.id,
      },
      include: {
        _count: {
          select: {
            enrollments: true,
            attempts: true,
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

    if (exam.status !== "DRAFT") {
      return res.status(400).json({
        success: false,
        message: "Only draft exams can be deleted.",
      });
    }

    if (exam._count.enrollments > 0 || exam._count.attempts > 0) {
      return res.status(409).json({
        success: false,
        message: "This exam has enrollments or attempts and cannot be deleted.",
      });
    }

    await prisma.exam.delete({
      where: { id: examId },
    });

    return res.status(200).json({
      success: true,
      message: "Exam deleted successfully.",
    });
  } catch (error) {
    console.error("Delete exam error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete exam.",
    });
  }
};

// PUBLISH EXAM
const publishExam = async (req, res) => {
  try {
    const { examId } = req.params;

    const exam = await prisma.exam.findFirst({
      where: {
        id: examId,
        ownerId: req.user.id,
      },
      include: {
        _count: {
          select: {
            questions: true,
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

    if (exam.status !== "DRAFT") {
      return res.status(400).json({
        success: false,
        message: "Only draft exams can be published.",
      });
    }

    if (exam._count.questions === 0) {
      return res.status(400).json({
        success: false,
        message: "Add at least one question before publishing the exam.",
      });
    }

    if (exam.endsAt <= exam.startsAt) {
      return res.status(400).json({
        success: false,
        message: "Exam end date must be after its start date.",
      });
    }

    const publishedExam = await prisma.exam.update({
      where: { id: examId },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Exam published successfully.",
      data: publishedExam,
    });
  } catch (error) {
    console.error("Publish exam error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to publish exam.",
    });
  }
};

export {
  createExam,
  getExams,
  getExamById,
  updateExam,
  deleteExam,
  publishExam,
};