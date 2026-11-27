import { z } from "zod";
import { UserRole } from "@prisma/client";

const roles = Object.values(UserRole);

const userIdParams = z.object({
  id: z.string().uuid(),
}).strict();

const userListQuery = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().min(1).max(160).optional(),
  role: z.enum(roles).optional(),
  isActive: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
}).strict();

const createUserBody = z.object({
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  fullName: z.string().trim().min(1).max(160),
  role: z.enum(roles),
  password: z.string().min(12).max(128),
}).strict();

const updateProfileBody = z.object({
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()).optional(),
  fullName: z.string().trim().min(1).max(160).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "Provide at least one profile field to update.",
});

const updateRoleBody = z.object({
  role: z.enum(roles),
}).strict();

const updateStatusBody = z.object({
  isActive: z.boolean(),
}).strict();

const optionalIsoDateTime = z
  .string()
  .trim()
  .min(1)
  .optional()
  .refine((value) => value === undefined || !Number.isNaN(Date.parse(value)), {
    message: "Invalid date.",
  });

const auditLogQuery = z.object({
  actorId: z.string().uuid().optional(),
  action: z.string().trim().min(1).max(100).optional(),
  from: optionalIsoDateTime,
  to: optionalIsoDateTime,
}).strict();

export {
  auditLogQuery,
  createUserBody,
  updateProfileBody,
  updateRoleBody,
  updateStatusBody,
  userIdParams,
  userListQuery,
};
