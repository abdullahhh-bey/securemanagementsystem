
import prisma from "../../db/db.js";

// GET ALL ATTEMPTS FOR AN EXAM
const getExamAttempts = async (req, res) => {
  try {
    const { examId } = req.params;

    const exam = await prisma.exam.findFirst({
      where: {
        id: examId,
        ownerId: req.user.id,
      },
    });

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found.",
      });
    }

    const attempts = await prisma.examAttempt.findMany({
      where: { examId },
      include: {
        participant: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        result: true,
      },
      orderBy: {
        startedAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      data: attempts,
    });
  } catch (error) {
    console.error("Get exam attempts error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve exam attempts.",
    });
  }
};

// GET DETAILS OF A SPECIFIC ATTEMPT
const getAttemptById = async (req, res) => {
  try {
    const { examId, attemptId } = req.params;

    const attempt = await prisma.examAttempt.findFirst({
      where: {
        id: attemptId,
        examId,
        exam: {
          ownerId: req.user.id,
        },
      },
      include: {
        participant: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
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
            answer: {
              include: {
                selectedOptions: true,
              },
            },
          },
        },
        events: {
          orderBy: {
            occurredAt: "desc",
          },
        },
        result: true,
      },
    });

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Attempt not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: attempt,
    });
  } catch (error) {
    console.error("Get attempt details error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve attempt details.",
    });
  }
};

// GET EVENTS RECORDED DURING AN ATTEMPT
const getAttemptEvents = async (req, res) => {
  try {
    const { examId, attemptId } = req.params;

    const attempt = await prisma.examAttempt.findFirst({
      where: {
        id: attemptId,
        examId,
        exam: {
          ownerId: req.user.id,
        },
      },
      select: {
        id: true,
      },
    });

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Attempt not found.",
      });
    }

    const events = await prisma.attemptEvent.findMany({
      where: { attemptId },
      orderBy: {
        occurredAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      data: events,
    });
  } catch (error) {
    console.error("Get attempt events error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve attempt events.",
    });
  }
};

export {
  getExamAttempts,
  getAttemptById,
  getAttemptEvents,
};
