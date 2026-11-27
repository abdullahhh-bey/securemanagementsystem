import {
  AttemptMode,
  EnrollmentStatus,
  ExamStatus,
  ResultStatus,
  UserRole,
} from "@prisma/client";
import { mapAuditLogEntry } from "../utils/audit.js";

const publicUserSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

/**
 * Aggregate results pipeline for Admin Exam Overview.
 * Mirrors frontend mock intent (NOT_READY / UNGRADED / GRADED / PUBLISHED)
 * using Prisma ExamStatus + ResultStatus only.
 *
 * - Not COMPLETED → NOT_READY
 * - Any PENDING_REVIEW → UNGRADED
 * - Every result PUBLISHED (and at least one) → PUBLISHED
 * - READY_TO_PUBLISH / WITHHELD / mixed with some PUBLISHED → GRADED
 * - COMPLETED with no result rows yet → UNGRADED (nothing evaluated)
 */
function deriveResultsState(examStatus, resultStatuses) {
  if (examStatus !== ExamStatus.COMPLETED) return "NOT_READY";

  if (resultStatuses.length === 0) return "UNGRADED";

  if (resultStatuses.every((status) => status === ResultStatus.PUBLISHED)) {
    return "PUBLISHED";
  }

  if (resultStatuses.some((status) => status === ResultStatus.PENDING_REVIEW)) {
    return "UNGRADED";
  }

  // READY_TO_PUBLISH, WITHHELD, or a mix that is not fully published.
  return "GRADED";
}

function mapAdminExam(exam) {
  const resultStatuses = (exam.attempts ?? [])
    .map((attempt) => attempt.result?.status)
    .filter(Boolean);

  return {
    id: exam.id,
    title: exam.title,
    status: exam.status,
    owner: {
      id: exam.owner.id,
      name: exam.owner.fullName,
    },
    startAt: exam.startsAt,
    endAt: exam.endsAt,
    candidateCount: exam._count.enrollments,
    questionCount: exam._count.questions,
    resultsState: deriveResultsState(exam.status, resultStatuses),
  };
}

class AdminApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function notFound() {
  return new AdminApiError(404, "USER_NOT_FOUND", "User not found.");
}

async function ensureEmailAvailable(tx, email, excludedUserId) {
  const existing = await tx.user.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      ...(excludedUserId ? { id: { not: excludedUserId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    throw new AdminApiError(409, "EMAIL_ALREADY_EXISTS", "A user with that email already exists.");
  }
}

function auditData(actorId, action, userId, oldValues, newValues) {
  return {
    actorId,
    action,
    entityType: "USER",
    entityId: userId,
    oldValues,
    newValues,
  };
}

async function findUserOrThrow(tx, id) {
  const user = await tx.user.findUnique({
    where: { id },
    select: publicUserSelect,
  });
  if (!user) throw notFound();
  return user;
}

async function ensureAnotherActiveAdmin(tx, user) {
  if (user.role !== UserRole.ADMIN || !user.isActive) return;

  const count = await tx.user.count({
    where: {
      role: UserRole.ADMIN,
      isActive: true,
      id: { not: user.id },
    },
  });

  if (count === 0) {
    throw new AdminApiError(
      409,
      "LAST_ACTIVE_ADMIN",
      "The last active administrator cannot be demoted or deactivated.",
    );
  }
}

function createAdminService({ prisma, hashPassword }) {
  async function listUsers(filters) {
    const where = {
      ...(filters.role ? { role: filters.role } : {}),
      ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
      ...(filters.q
        ? {
            OR: [
              { fullName: { contains: filters.q, mode: "insensitive" } },
              { email: { contains: filters.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const skip = (filters.page - 1) * filters.pageSize;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: publicUserSelect,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip,
        take: filters.pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data: users,
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        totalPages: Math.ceil(total / filters.pageSize),
      },
    };
  }

  async function getUser(id) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: publicUserSelect,
    });
    if (!user) throw notFound();
    return user;
  }

  async function createUser(input, actorId) {
    const passwordHash = await hashPassword(input.password);
    if (typeof passwordHash !== "string" || passwordHash.length < 20 || passwordHash === input.password) {
      throw new Error("The configured password hasher did not return a password hash.");
    }

    return prisma.$transaction(async (tx) => {
      await ensureEmailAvailable(tx, input.email);
      const user = await tx.user.create({
        data: {
          email: input.email,
          fullName: input.fullName,
          role: input.role,
          passwordHash,
        },
        select: publicUserSelect,
      });

      await tx.auditLog.create({
        data: auditData(
          actorId,
          "USER_CREATED",
          user.id,
          null,
          { email: user.email, fullName: user.fullName, role: user.role, isActive: user.isActive },
        ),
      });

      return user;
    });
  }

  async function updateProfile(id, input, actorId) {
    return prisma.$transaction(async (tx) => {
      const current = await findUserOrThrow(tx, id);
      const data = {};
      if (input.email !== undefined && input.email !== current.email) data.email = input.email;
      if (input.fullName !== undefined && input.fullName !== current.fullName) data.fullName = input.fullName;
      if (Object.keys(data).length === 0) return current;
      if (data.email) await ensureEmailAvailable(tx, data.email, id);

      const updated = await tx.user.update({
        where: { id },
        data,
        select: publicUserSelect,
      });

      await tx.auditLog.create({
        data: auditData(
          actorId,
          "USER_PROFILE_UPDATED",
          id,
          { email: current.email, fullName: current.fullName },
          { email: updated.email, fullName: updated.fullName },
        ),
      });
      return updated;
    }, { isolationLevel: "Serializable" });
  }

  async function updateRole(id, role, actorId) {
    return prisma.$transaction(async (tx) => {
      const current = await findUserOrThrow(tx, id);
      if (current.role === role) return current;

      if (current.id === actorId && role !== UserRole.ADMIN) {
        throw new AdminApiError(409, "SELF_ROLE_CHANGE", "Administrators cannot remove their own administrator role.");
      }

      if (current.role === UserRole.ADMIN && role !== UserRole.ADMIN) {
        await ensureAnotherActiveAdmin(tx, current);
      }

      const updated = await tx.user.update({
        where: { id },
        data: { role },
        select: publicUserSelect,
      });
      const now = new Date();
      await tx.userSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.auditLog.create({
        data: auditData(actorId, "USER_ROLE_CHANGED", id, { role: current.role }, { role: updated.role }),
      });
      return updated;
    }, { isolationLevel: "Serializable" });
  }

  async function updateStatus(id, isActive, actorId) {
    return prisma.$transaction(async (tx) => {
      const current = await findUserOrThrow(tx, id);
      if (current.isActive === isActive) return current;

      if (current.id === actorId && !isActive) {
        throw new AdminApiError(409, "SELF_DEACTIVATION", "Administrators cannot deactivate their own account.");
      }

      if (!isActive) await ensureAnotherActiveAdmin(tx, current);

      const updated = await tx.user.update({
        where: { id },
        data: { isActive },
        select: publicUserSelect,
      });

      if (!isActive) {
        await tx.userSession.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      await tx.auditLog.create({
        data: auditData(actorId, "USER_STATUS_CHANGED", id, { isActive: current.isActive }, { isActive }),
      });
      return updated;
    }, { isolationLevel: "Serializable" });
  }

  async function listExams() {
    const exams = await prisma.exam.findMany({
      orderBy: [{ startsAt: "desc" }, { id: "asc" }],
      select: {
        id: true,
        title: true,
        status: true,
        startsAt: true,
        endsAt: true,
        owner: {
          select: {
            id: true,
            fullName: true,
          },
        },
        _count: {
          select: {
            questions: true,
            enrollments: {
              where: { status: EnrollmentStatus.ENROLLED },
            },
          },
        },
        attempts: {
          where: { mode: AttemptMode.OFFICIAL },
          select: {
            result: {
              select: {
                status: true,
              },
            },
          },
        },
      },
    });

    return exams.map(mapAdminExam);
  }

  async function listAuditLog(filters = {}) {
    const where = {
      ...(filters.actorId ? { actorId: filters.actorId } : {}),
      ...(filters.action ? { action: filters.action } : {}),
    };

    if (filters.from || filters.to) {
      where.createdAt = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      };
    }

    const [rows, filterSource] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: {
          actor: {
            select: {
              id: true,
              fullName: true,
              role: true,
            },
          },
        },
      }),
      prisma.auditLog.findMany({
        select: {
          action: true,
          actorId: true,
          actor: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      }),
    ]);

    const actors = [
      ...new Map(
        filterSource
          .filter((row) => row.actorId && row.actor)
          .map((row) => [
            row.actorId,
            {
              id: row.actorId,
              name: row.actor.fullName,
            },
          ]),
      ).values(),
    ].sort((a, b) => a.name.localeCompare(b.name));

    const actions = [...new Set(filterSource.map((row) => row.action))].sort();

    return {
      total: rows.length,
      entries: rows.map(mapAuditLogEntry),
      actors,
      actions,
    };
  }

  return {
    createUser,
    getUser,
    listUsers,
    listExams,
    listAuditLog,
    updateProfile,
    updateRole,
    updateStatus,
  };
}

export { AdminApiError, createAdminService, deriveResultsState };
