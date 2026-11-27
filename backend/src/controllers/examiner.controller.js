
import prisma from "../../db/db.js";

// GET EXAMINER DASHBOARD
const getExaminerDashboard = async (req, res) => {
  try {
    const examinerId = req.user.id;

    // Fetch examiner information and dashboard statistics
    const [
      examiner,
      totalExams,
      publishedExams,
      draftExams,
      totalQuestions,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: examinerId },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      }),

      prisma.exam.count({
        where: { ownerId: examinerId },
      }),

      prisma.exam.count({
        where: {
          ownerId: examinerId,
          status: "PUBLISHED",
        },
      }),

      prisma.exam.count({
        where: {
          ownerId: examinerId,
          status: "DRAFT",
        },
      }),

      prisma.question.count({
        where: { authorId: examinerId },
      }),
    ]);

    if (!examiner || examiner.role !== "EXAMINER") {
      return res.status(404).json({
        success: false,
        message: "Examiner not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Examiner dashboard retrieved successfully.",
      data: {
        examiner,
        statistics: {
          totalExams,
          publishedExams,
          draftExams,
          totalQuestions,
        },
      },
    });
  } catch (error) {
    console.error("Examiner dashboard error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve examiner dashboard.",
    });
  }
};

export { getExaminerDashboard };
