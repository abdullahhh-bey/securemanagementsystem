import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import { test } from "node:test";
import { createAdminRouter } from "../src/routes/admin.routes.js";

const adminId = "00000000-0000-4000-8000-000000000001";
const secondAdminId = "00000000-0000-4000-8000-000000000002";
const examinerId = "00000000-0000-4000-8000-000000000003";

function createFixture({ secondAdmin = false } = {}) {
  const state = {
    users: [
      {
        id: adminId,
        email: "admin@example.test",
        fullName: "Admin One",
        role: "ADMIN",
        isActive: true,
        passwordHash: "argon2id$" + "a".repeat(32),
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        id: examinerId,
        email: "examiner@example.test",
        fullName: "Examiner One",
        role: "EXAMINER",
        isActive: true,
        passwordHash: "argon2id$" + "b".repeat(32),
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      },
    ],
    sessions: [{ userId: examinerId, revokedAt: null }],
    auditLogs: [],
    transactionOptions: [],
    listCalls: 0,
    hashCalls: 0,
  };

  if (secondAdmin) {
    state.users.push({
      id: secondAdminId,
      email: "admin2@example.test",
      fullName: "Admin Two",
      role: "ADMIN",
      isActive: true,
      passwordHash: "argon2id$" + "c".repeat(32),
      createdAt: new Date("2026-01-03T00:00:00.000Z"),
      updatedAt: new Date("2026-01-03T00:00:00.000Z"),
    });
  }

  function project(user, select) {
    if (!user || !select) return user;
    return Object.fromEntries(Object.entries(select).filter(([, include]) => include).map(([key]) => [key, user[key]]));
  }

  function matches(user, where = {}) {
    if (where.role && user.role !== where.role) return false;
    if (where.isActive !== undefined && user.isActive !== where.isActive) return false;
    if (typeof where.id === "string" && user.id !== where.id) return false;
    if (where.id?.not && user.id === where.id.not) return false;
    if (where.OR && !where.OR.some((condition) => {
      const [field, filter] = Object.entries(condition)[0];
      return user[field].toLowerCase().includes(filter.contains.toLowerCase());
    })) return false;
    return true;
  }

  const client = {
    user: {
      async count({ where } = {}) {
        return state.users.filter((user) => matches(user, where)).length;
      },
      async findMany(options = {}) {
        state.listCalls += 1;
        return state.users
          .filter((user) => matches(user, options.where))
          .sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id))
          .slice(options.skip ?? 0, (options.skip ?? 0) + (options.take ?? state.users.length))
          .map((user) => project(user, options.select));
      },
      async findUnique({ where, select } = {}) {
        const user = state.users.find((candidate) =>
          where.id ? candidate.id === where.id : candidate.email === where.email,
        );
        return project(user, select);
      },
      async findFirst({ where, select } = {}) {
        const user = state.users.find((candidate) => {
          if (candidate.email.toLowerCase() !== where.email.equals.toLowerCase()) return false;
          return !where.id?.not || candidate.id !== where.id.not;
        });
        return project(user, select);
      },
      async create({ data, select }) {
        if (state.users.some((user) => user.email === data.email)) {
          throw Object.assign(new Error("Unique constraint"), { code: "P2002" });
        }
        const now = new Date();
        const user = {
          id: "00000000-0000-4000-8000-000000000099",
          isActive: true,
          createdAt: now,
          updatedAt: now,
          ...data,
        };
        state.users.push(user);
        return project(user, select);
      },
      async update({ where, data, select }) {
        const user = state.users.find((candidate) => candidate.id === where.id);
        if (!user) throw Object.assign(new Error("Record not found"), { code: "P2025" });
        Object.assign(user, data, { updatedAt: new Date() });
        return project(user, select);
      },
    },
    userSession: {
      async updateMany({ where, data }) {
        let count = 0;
        for (const session of state.sessions) {
          if (session.userId === where.userId && session.revokedAt === where.revokedAt) {
            Object.assign(session, data);
            count += 1;
          }
        }
        return { count };
      },
    },
    auditLog: {
      async create({ data }) {
        state.auditLogs.push(data);
        return data;
      },
    },
    async $transaction(callback, options) {
      state.transactionOptions.push(options);
      return callback(client);
    },
  };

  return { prisma: client, state };
}

function createApp(fixture) {
  const app = express();
  const router = createAdminRouter({
    prisma: fixture.prisma,
    authenticate(req, res, next) {
      if (!req.get("authorization")) {
        return res.status(401).json({ error: { code: "UNAUTHENTICATED" } });
      }
      req.authenticatedUserId = req.get("authorization").slice("Bearer ".length);
      next();
    },
    requireAdmin(req, res, next) {
      if (req.get("x-test-role") !== "ADMIN") {
        return res.status(403).json({ error: { code: "FORBIDDEN" } });
      }
      next();
    },
    getActorId: (req) => req.authenticatedUserId,
    async hashPassword(password) {
      fixture.state.hashCalls += 1;
      return `argon2id$${password.padEnd(32, "x")}`;
    },
    logger: { error() {} },
  });
  app.use("/api/admin", router);
  return app;
}

async function withServer(fixture, run) {
  const server = createApp(fixture).listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  try {
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

async function send(baseUrl, path, {
  method = "GET",
  body,
  authenticated = true,
  role = "ADMIN",
  actorId = adminId,
} = {}) {
  const headers = {};
  if (authenticated) headers.authorization = `Bearer ${actorId}`;
  if (role) headers["x-test-role"] = role;
  if (body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${baseUrl}/api/admin${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { response, payload: await response.json() };
}

test("admin routes reject unauthenticated and non-admin requests", async () => {
  const fixture = createFixture();
  await withServer(fixture, async (url) => {
    const unauthenticated = await send(url, "/users", { authenticated: false });
    assert.equal(unauthenticated.response.status, 401);

    const forbidden = await send(url, "/users", { role: "EXAMINER" });
    assert.equal(forbidden.response.status, 403);
    assert.equal(fixture.state.listCalls, 0);
  });
});

test("user listing validates filters, paginates, and omits password hashes", async () => {
  const fixture = createFixture();
  await withServer(fixture, async (url) => {
    const result = await send(url, "/users?role=EXAMINER&isActive=true&page=1&pageSize=1");
    assert.equal(result.response.status, 200);
    assert.equal(result.payload.pagination.total, 1);
    assert.equal(result.payload.data[0].email, "examiner@example.test");
    assert.equal("passwordHash" in result.payload.data[0], false);

    const invalid = await send(url, "/users?page=0");
    assert.equal(invalid.response.status, 400);
    assert.equal(invalid.payload.error.code, "VALIDATION_ERROR");
  });
});

test("user creation normalizes email, hashes password, and audits without secrets", async () => {
  const fixture = createFixture();
  await withServer(fixture, async (url) => {
    const invalid = await send(url, "/users", {
      method: "POST",
      body: { email: "new@example.test", fullName: "New User", role: "CANDIDATE", password: "short" },
    });
    assert.equal(invalid.response.status, 400);
    assert.equal(fixture.state.hashCalls, 0);

    const created = await send(url, "/users", {
      method: "POST",
      body: {
        email: "NEW@example.test",
        fullName: " New Candidate ",
        role: "CANDIDATE",
        password: "a-secure-test-password",
      },
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.payload.data.email, "new@example.test");
    assert.equal(created.payload.data.fullName, "New Candidate");
    assert.equal("passwordHash" in created.payload.data, false);
    assert.equal(fixture.state.users.at(-1).passwordHash.startsWith("argon2id$"), true);
    assert.equal(JSON.stringify(fixture.state.auditLogs).includes("a-secure-test-password"), false);
    assert.equal(fixture.state.auditLogs.at(-1).actorId, adminId);

    const duplicate = await send(url, "/users", {
      method: "POST",
      body: {
        email: "EXAMINER@example.test",
        fullName: "Duplicate",
        role: "CANDIDATE",
        password: "a-secure-test-password",
      },
    });
    assert.equal(duplicate.response.status, 409);
    assert.equal(duplicate.payload.error.code, "EMAIL_ALREADY_EXISTS");
  });
});

test("profile updates reject protected fields and missing users", async () => {
  const fixture = createFixture();
  await withServer(fixture, async (url) => {
    const forbiddenField = await send(url, `/users/${examinerId}`, {
      method: "PATCH",
      body: { role: "ADMIN" },
    });
    assert.equal(forbiddenField.response.status, 400);

    const invalidId = await send(url, "/users/not-a-uuid");
    assert.equal(invalidId.response.status, 400);

    const missing = await send(url, "/users/00000000-0000-4000-8000-000000000099");
    assert.equal(missing.response.status, 404);

    const updated = await send(url, `/users/${examinerId}`, {
      method: "PATCH",
      body: { fullName: "Updated Examiner" },
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.payload.data.fullName, "Updated Examiner");
    assert.equal(fixture.state.auditLogs.at(-1).action, "USER_PROFILE_UPDATED");
  });
});

test("role changes revoke sessions and write an audit event", async () => {
  const fixture = createFixture();
  await withServer(fixture, async (url) => {
    const result = await send(url, `/users/${examinerId}/role`, {
      method: "PATCH",
      body: { role: "CANDIDATE" },
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.payload.data.role, "CANDIDATE");
    assert.ok(fixture.state.sessions[0].revokedAt instanceof Date);
    assert.equal(fixture.state.auditLogs.at(-1).action, "USER_ROLE_CHANGED");
  });
});

test("last active admin cannot be demoted or deactivated, and admins cannot disable themselves", async () => {
  const fixture = createFixture();
  await withServer(fixture, async (url) => {
    const demotion = await send(url, `/users/${adminId}/role`, {
      method: "PATCH",
      body: { role: "CANDIDATE" },
      actorId: examinerId,
    });
    assert.equal(demotion.response.status, 409);
    assert.equal(demotion.payload.error.code, "LAST_ACTIVE_ADMIN");

    const lastAdminDeactivation = await send(url, `/users/${adminId}/status`, {
      method: "PATCH",
      body: { isActive: false },
      actorId: examinerId,
    });
    assert.equal(lastAdminDeactivation.response.status, 409);
    assert.equal(lastAdminDeactivation.payload.error.code, "LAST_ACTIVE_ADMIN");

    const selfDeactivation = await send(url, `/users/${adminId}/status`, {
      method: "PATCH",
      body: { isActive: false },
    });
    assert.equal(selfDeactivation.response.status, 409);
    assert.equal(selfDeactivation.payload.error.code, "SELF_DEACTIVATION");
  });
});

test("deactivating another user revokes sessions and permits activation", async () => {
  const fixture = createFixture();
  await withServer(fixture, async (url) => {
    const deactivated = await send(url, `/users/${examinerId}/status`, {
      method: "PATCH",
      body: { isActive: false },
    });
    assert.equal(deactivated.response.status, 200);
    assert.equal(deactivated.payload.data.isActive, false);
    assert.ok(fixture.state.sessions[0].revokedAt instanceof Date);

    const activated = await send(url, `/users/${examinerId}/status`, {
      method: "PATCH",
      body: { isActive: true },
    });
    assert.equal(activated.response.status, 200);
    assert.equal(activated.payload.data.isActive, true);
  });
});

test("an active admin can demote another admin only when another admin remains", async () => {
  const fixture = createFixture({ secondAdmin: true });
  await withServer(fixture, async (url) => {
    const result = await send(url, `/users/${secondAdminId}/role`, {
      method: "PATCH",
      body: { role: "EXAMINER" },
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.payload.data.role, "EXAMINER");
    assert.ok(fixture.state.transactionOptions.every((option) => option?.isolationLevel === "Serializable"));
  });
});
