
import prisma from "../../db/db.js";

// ASSIGN QUESTION TO EXAM
const assignQuestion = async (req, res) => {
  try {
    const { examId } = req.params;
    const { questionVersionId, assignedMarks } = req.body;

    if (!questionVersionId) {
      return res.status(400).json({
        success: false,
        message: "Question version ID is required.",
      });
    }

    if (
      assignedMarks !== undefined &&
      (
        typeof assignedMarks !== "number" ||
        !Number.isFinite(assignedMarks) ||
        assignedMarks <= 0
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Assigned marks must be a positive number.",
      });
    }

    // Find examiner's exam
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

    if (exam.status !== "DRAFT") {
      return res.status(400).json({
        success: false,
        message: "Questions can only be assigned to draft exams.",
      });
    }

    // Verify question belongs to this examiner
    const questionVersion = await prisma.questionVersion.findFirst({
      where: {
        id: questionVersionId,
        question: {
          authorId: req.user.id,
          isActive: true,
        },
      },
    });

    if (!questionVersion) {
      return res.status(404).json({
        success: false,
        message: "Question version not found.",
      });
    }

    // Prevent duplicate assignment
    const existingAssignment = await prisma.examQuestion.findFirst({
      where: {
        examId,
        questionVersionId,
      },
    });

    if (existingAssignment) {
      return res.status(409).json({
        success: false,
        message: "This question is already assigned to the exam.",
      });
    }

    // Determine next question position
    const questionCount = await prisma.examQuestion.count({
      where: { examId },
    });

    const assignedQuestion = await prisma.examQuestion.create({
      data: {
        examId,
        questionVersionId,
        position: questionCount + 1,
        assignedMarks: assignedMarks ?? questionVersion.defaultMarks,
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
    });

    return res.status(201).json({
      success: true,
      message: "Question assigned to exam successfully.",
      data: assignedQuestion,
    });
  } catch (error) {
    console.error("Assign question error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to assign question to exam.",
    });
  }
};

// REMOVE QUESTION FROM EXAM
const removeQuestion = async (req, res) => {
  try {
    const { examId, examQuestionId } = req.params;

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

    if (exam.status !== "DRAFT") {
      return res.status(400).json({
        success: false,
        message: "Questions can only be removed from draft exams.",
      });
    }

    const assignedQuestion = await prisma.examQuestion.findFirst({
      where: {
        id: examQuestionId,
        examId,
      },
    });

    if (!assignedQuestion) {
      return res.status(404).json({
        success: false,
        message: "Assigned question not found.",
      });
    }

    await prisma.examQuestion.delete({
      where: {
        id: examQuestionId,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Question removed from exam successfully.",
    });
  } catch (error) {
    console.error("Remove question error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to remove question from exam.",
    });
  }
};

export { assignQuestion, removeQuestion };
