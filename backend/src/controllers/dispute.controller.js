
import prisma from "../../db/db.js";
import { AuditAction, AuditEntityType, writeAuditLog } from "../utils/audit.js";

// GET ALL DISPUTES FOR THE EXAMINER'S EXAMS
const getExaminerDisputes = async (req, res) => {
  try {
    const disputes = await prisma.resultDispute.findMany({
      where: {
        result: {
          attempt: {
            exam: {
              ownerId: req.user.id,
            },
          },
        },
      },
      include: {
        result: {
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
                exam: {
                  select: {
                    id: true,
                    title: true,
                  },
                },
              },
            },
          },
        },
        openedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      data: disputes,
    });
  } catch (error) {
    console.error("Get examiner disputes error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve disputes.",
    });
  }
};

// UPDATE DISPUTE STATUS
const updateDispute = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { status, resolution } = req.body;

    const allowedStatuses = [
      "UNDER_REVIEW",
      "RESOLVED",
      "REJECTED",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid dispute status.",
      });
    }

    if (
      (status === "RESOLVED" || status === "REJECTED") &&
      (typeof resolution !== "string" || !resolution.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "A resolution explanation is required.",
      });
    }

    const dispute = await prisma.resultDispute.findFirst({
      where: {
        id: disputeId,
        result: {
          attempt: {
            exam: {
              ownerId: req.user.id,
            },
          },
        },
      },
    });

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: "Dispute not found.",
      });
    }

    if (
      dispute.status === "RESOLVED" ||
      dispute.status === "REJECTED"
    ) {
      return res.status(400).json({
        success: false,
        message: "This dispute has already been closed.",
      });
    }

    const isClosed =
      status === "RESOLVED" || status === "REJECTED";

    const updatedDispute = await prisma.resultDispute.update({
      where: {
        id: disputeId,
      },
      data: {
        status,
        resolution: isClosed ? resolution.trim() : null,
        resolvedById: isClosed ? req.user.id : null,
        resolvedAt: isClosed ? new Date() : null,
      },
    });

    const disputeAction =
      status === "UNDER_REVIEW"
        ? AuditAction.DISPUTE_REVIEW_STARTED
        : status === "RESOLVED"
          ? AuditAction.DISPUTE_RESOLVED
          : AuditAction.DISPUTE_REJECTED;

    await writeAuditLog(prisma, {
      actorId: req.user.id,
      action: disputeAction,
      entityType: AuditEntityType.DISPUTE,
      entityId: updatedDispute.id,
      oldValues: { status: dispute.status },
      newValues: {
        status: updatedDispute.status,
        hasResolution: Boolean(updatedDispute.resolution),
      },
      metadata: {
        resultId: dispute.resultId,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Dispute updated successfully.",
      data: updatedDispute,
    });
  } catch (error) {
    console.error("Update dispute error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update dispute.",
    });
  }
};

export {
  getExaminerDisputes,
  updateDispute,
};
