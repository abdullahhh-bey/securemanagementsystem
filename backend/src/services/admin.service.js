import { UserRole } from "@prisma/client";

const publicUserSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

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

  return { createUser, getUser, listUsers, updateProfile, updateRole, updateStatus };
}

export { AdminApiError, createAdminService };
