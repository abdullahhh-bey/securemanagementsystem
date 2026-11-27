import prisma from "../../db/db.js";
import { AuditAction, AuditEntityType, writeAuditLog } from "../utils/audit.js";

// GET ALL CANDIDATES
const getCandidates = async (req, res) => {
  try {
    const candidates = await prisma.user.findMany({
      where: {
        role: "CANDIDATE",
        isActive: true,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
      },
      orderBy: {
        fullName: "asc",
      },
    });

    return res.status(200).json({
      success: true,
      data: candidates,
    });
  } catch (error) {
    console.error("Get candidates error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve candidates.",
    });
  }
};

// GET CANDIDATES ENROLLED IN AN EXAM
const getExamEnrollments = async (req, res) => {
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

    const enrollments = await prisma.examEnrollment.findMany({
      where: {
        examId,
        status: "ENROLLED",
      },
      include: {
        candidate: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: {
        enrolledAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      data: enrollments,
    });
  } catch (error) {
    console.error("Get exam enrollments error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve exam enrollments.",
    });
  }
};

// ENROLL CANDIDATE IN AN EXAM
const enrollCandidate = async (req, res) => {
  try {
    const { examId } = req.params;
    const { candidateId } = req.body;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: "Candidate ID is required.",
      });
    }

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

    const candidate = await prisma.user.findFirst({
      where: {
        id: candidateId,
        role: "CANDIDATE",
        isActive: true,
      },
    });

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Active candidate not found.",
      });
    }

    const existingEnrollment = await prisma.examEnrollment.findFirst({
      where: {
        examId,
        candidateId,
      },
    });

    if (existingEnrollment?.status === "ENROLLED") {
      return res.status(409).json({
        success: false,
        message: "Candidate is already enrolled in this exam.",
      });
    }

    let enrollment;

    if (existingEnrollment) {
      enrollment = await prisma.examEnrollment.update({
        where: {
          id: existingEnrollment.id,
        },
        data: {
          status: "ENROLLED",
          enrolledById: req.user.id,
          enrolledAt: new Date(),
          withdrawnAt: null,
        },
      });
    } else {
      enrollment = await prisma.examEnrollment.create({
        data: {
          examId,
          candidateId,
          enrolledById: req.user.id,
          status: "ENROLLED",
        },
      });
    }

    await writeAuditLog(prisma, {
      actorId: req.user.id,
      action: AuditAction.CANDIDATE_ENROLLED,
      entityType: AuditEntityType.ENROLLMENT,
      entityId: enrollment.id,
      oldValues: existingEnrollment
        ? { status: existingEnrollment.status }
        : null,
      newValues: {
        examId,
        candidateId,
        status: enrollment.status,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Candidate enrolled successfully.",
      data: enrollment,
    });
  } catch (error) {
    console.error("Enroll candidate error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to enroll candidate.",
    });
  }
};

// WITHDRAW CANDIDATE FROM AN EXAM
const withdrawCandidate = async (req, res) => {
  try {
    const { examId, enrollmentId } = req.params;

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

    const enrollment = await prisma.examEnrollment.findFirst({
      where: {
        id: enrollmentId,
        examId,
        status: "ENROLLED",
      },
    });

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: "Active enrollment not found.",
      });
    }

    const updatedEnrollment = await prisma.examEnrollment.update({
      where: {
        id: enrollmentId,
      },
      data: {
        status: "WITHDRAWN",
        withdrawnAt: new Date(),
      },
    });

    await writeAuditLog(prisma, {
      actorId: req.user.id,
      action: AuditAction.CANDIDATE_WITHDRAWN,
      entityType: AuditEntityType.ENROLLMENT,
      entityId: updatedEnrollment.id,
      oldValues: { status: enrollment.status },
      newValues: {
        examId,
        candidateId: enrollment.candidateId,
        status: updatedEnrollment.status,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Candidate withdrawn successfully.",
      data: updatedEnrollment,
    });
  } catch (error) {
    console.error("Withdraw candidate error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to withdraw candidate.",
    });
  }
};

export {
  getCandidates,
  getExamEnrollments,
  enrollCandidate,
  withdrawCandidate,
};