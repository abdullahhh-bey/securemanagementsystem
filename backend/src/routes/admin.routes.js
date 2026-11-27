import express from "express";
import { z } from "zod";
import { createAdminController } from "../controllers/admin.controller.js";
import { AdminApiError, createAdminService } from "../services/admin.service.js";
import {
  createUserBody,
  updateProfileBody,
  updateRoleBody,
  updateStatusBody,
  userIdParams,
  userListQuery,
} from "../validators/admin.validators.js";

const actorIdSchema = z.string().uuid();

function validate(location, schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req[location]);
    if (!result.success) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed.",
          details: result.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      });
    }

    req[`validated${location[0].toUpperCase()}${location.slice(1)}`] = result.data;
    next();
  };
}

function handleAdminError(error, req, res, next, logger) {
  if (res.headersSent) return next(error);

  if (error instanceof AdminApiError) {
    return res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    });
  }

  if (error instanceof z.ZodError) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Request validation failed." },
    });
  }

  if (error?.code === "P2002") {
    return res.status(409).json({
      error: { code: "EMAIL_ALREADY_EXISTS", message: "A user with that email already exists." },
    });
  }

  if (error?.code === "P2025") {
    return res.status(404).json({
      error: { code: "USER_NOT_FOUND", message: "User not found." },
    });
  }

  if (error?.code === "P2034") {
    return res.status(409).json({
      error: { code: "CONCURRENT_UPDATE", message: "The record changed concurrently. Retry the request." },
    });
  }

  if (error?.type === "entity.too.large") {
    return res.status(413).json({
      error: { code: "REQUEST_TOO_LARGE", message: "Request body exceeds the allowed size." },
    });
  }

  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({
      error: { code: "INVALID_JSON", message: "Request body must contain valid JSON." },
    });
  }

  logger.error("Unhandled admin API error", {
    name: error?.name,
    code: error?.code,
  });
  return res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
  });
}

function createAdminRouter({ prisma, authenticate, requireAdmin, getActorId, hashPassword, logger = console }) {
  if (!prisma || typeof prisma.$transaction !== "function") {
    throw new TypeError("createAdminRouter requires a Prisma client.");
  }
  for (const [name, dependency] of Object.entries({ authenticate, requireAdmin, getActorId, hashPassword })) {
    if (typeof dependency !== "function") {
      throw new TypeError(`createAdminRouter requires ${name} to be a function.`);
    }
  }

  const router = express.Router();
  const service = createAdminService({ prisma, hashPassword });
  const resolveActorId = (req) => {
    const result = actorIdSchema.safeParse(getActorId(req));
    if (!result.success) {
      throw new AdminApiError(401, "AUTHENTICATION_REQUIRED", "Authenticated administrator identity is unavailable.");
    }
    return result.data;
  };
  const controller = createAdminController(service, resolveActorId);

  router.use(authenticate, requireAdmin, express.json({ limit: "16kb" }));

  router.get("/users", validate("query", userListQuery), controller.listUsers);
  router.get("/users/:id", validate("params", userIdParams), controller.getUser);
  router.post("/users", validate("body", createUserBody), controller.createUser);
  router.patch(
    "/users/:id",
    validate("params", userIdParams),
    validate("body", updateProfileBody),
    controller.updateProfile,
  );
  router.patch(
    "/users/:id/role",
    validate("params", userIdParams),
    validate("body", updateRoleBody),
    controller.updateRole,
  );
  router.patch(
    "/users/:id/status",
    validate("params", userIdParams),
    validate("body", updateStatusBody),
    controller.updateStatus,
  );

  router.use((error, req, res, next) => handleAdminError(error, req, res, next, logger));
  return router;
}

export { createAdminRouter };
