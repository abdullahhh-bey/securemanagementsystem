
import prisma from "../../db/db.js";
import { AuditAction, AuditEntityType, writeAuditLog } from "../utils/audit.js";

// GET RESULTS FOR AN EXAM
const getExamResults = async (req, res) => {
  try {
    const { examId } = req.params;

    const exam = await prisma.exam.findFirst({
      where: {
        id: examId,
        ownerId: req.user.id,
      },
      select: {
        id: true,
      },
    });

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found.",
      });
    }

    const results = await prisma.result.findMany({
      where: {
        attempt: {
          examId,
        },
      },
      include: {
        attempt: {
          include: {
            participant: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Get exam results error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve exam results.",
    });
  }
};

// PUBLISH ALL EVALUATED RESULTS FOR AN EXAM
const publishExamResults = async (req, res) => {
  try {
    const { examId } = req.params;

    const exam = await prisma.exam.findFirst({
      where: {
        id: examId,
        ownerId: req.user.id,
      },
      select: {
        id: true,
      },
    });

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found.",
      });
    }

    const readyResults = await prisma.result.findMany({
      where: {
        status: "READY_TO_PUBLISH",
        attempt: {
          examId,
        },
      },
      select: {
        id: true,
      },
    });

    if (readyResults.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No evaluated results are ready to publish.",
      });
    }

    const publishedAt = new Date();

    await prisma.$transaction(async (tx) => {
      for (const result of readyResults) {
        await tx.result.update({
          where: {
            id: result.id,
          },
          data: {
            status: "PUBLISHED",
            publishedById: req.user.id,
            publishedAt,
          },
        });
      }

      await writeAuditLog(tx, {
        actorId: req.user.id,
        action: AuditAction.RESULTS_PUBLISHED,
        entityType: AuditEntityType.EXAM,
        entityId: examId,
        oldValues: { status: "READY_TO_PUBLISH" },
        newValues: {
          status: "PUBLISHED",
          publishedCount: readyResults.length,
        },
      });
    });

    return res.status(200).json({
      success: true,
      message: "Exam results published successfully.",
      data: {
        publishedCount: readyResults.length,
      },
    });
  } catch (error) {
    console.error("Publish exam results error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to publish exam results.",
    });
  }
};

export {
  getExamResults,
  publishExamResults,
};
