import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import { test } from "node:test";
import { createAnnouncementHandlers } from "../src/controllers/announcement.controller.js";
import { AuditAction, AuditEntityType } from "../src/utils/audit.js";

const ownerId = "00000000-0000-4000-8000-000000000010";
const otherExaminerId = "00000000-0000-4000-8000-000000000011";
const examId = "00000000-0000-4000-8000-000000000020";

function createFixture({ status = "PUBLISHED" } = {}) {
  const state = {
    exams: [
      {
        id: examId,
        ownerId,
        title: "Networks Midterm",
        status,
      },
    ],
    announcements: [],
    auditLogs: [],
  };

  const users = {
    [ownerId]: { id: ownerId, fullName: "Examiner One" },
    [otherExaminerId]: { id: otherExaminerId, fullName: "Other Examiner" },
  };

  const db = {
    exam: {
      async findFirst({ where, select }) {
        const exam = state.exams.find(
          (row) => row.id === where.id && row.ownerId === where.ownerId,
        );
        if (!exam) return null;
        if (!select) return exam;
        return Object.fromEntries(
          Object.keys(select).map((key) => [key, exam[key]]),
        );
      },
    },
    examAnnouncement: {
      async findMany({ where, include, orderBy }) {
        let rows = state.announcements.filter((row) => row.examId === where.examId);
        if (where.publishedAt?.not === null) {
          rows = rows.filter((row) => row.publishedAt != null);
        }
        rows = [...rows].sort((a, b) => {
          const aTime = new Date(a.publishedAt ?? a.createdAt).getTime();
          const bTime = new Date(b.publishedAt ?? b.createdAt).getTime();
          return bTime - aTime;
        });
        return rows.map((row) => ({
          ...row,
          author: include?.author
            ? users[row.authorId] ?? { id: row.authorId, fullName: "Exam team" }
            : undefined,
        }));
      },
      async create({ data, include }) {
        const row = {
          id: `ann-${state.announcements.length + 1}`,
          ...data,
          createdAt: data.publishedAt ?? new Date(),
          updatedAt: data.publishedAt ?? new Date(),
        };
        state.announcements.push(row);
        return {
          ...row,
          author: include?.author
            ? users[row.authorId] ?? { id: row.authorId, fullName: "Exam team" }
            : undefined,
        };
      },
    },
    auditLog: {
      async create({ data }) {
        const entry = { id: `audit-${state.auditLogs.length + 1}`, ...data };
        state.auditLogs.push(entry);
        return entry;
      },
    },
  };

  return { db, state };
}

function createApp({ db, userId = ownerId, role = "EXAMINER" }) {
  const { listExamAnnouncements, createExamAnnouncement } =
    createAnnouncementHandlers(db);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: userId, role };
    next();
  });
  app.get("/exams/:examId/announcements", listExamAnnouncements);
  app.post("/exams/:examId/announcements", createExamAnnouncement);
  return app;
}

async function listen(app) {
  const server = app.listen(0);
  await once(server, "listening");
  const { port } = server.address();
  return {
    server,
    url: `http://127.0.0.1:${port}`,
  };
}

test("lists announcements for an owned exam, newest first", async () => {
  const { db, state } = createFixture();
  const older = new Date("2026-03-01T10:00:00.000Z");
  const newer = new Date("2026-03-01T12:00:00.000Z");
  state.announcements.push(
    {
      id: "ann-old",
      examId,
      authorId: ownerId,
      title: "Announcement",
      message: "Earlier note",
      publishedAt: older,
      createdAt: older,
    },
    {
      id: "ann-new",
      examId,
      authorId: ownerId,
      title: "Announcement",
      message: "Latest note",
      publishedAt: newer,
      createdAt: newer,
    },
  );

  const app = createApp({ db });
  const { server, url } = await listen(app);

  try {
    const response = await fetch(`${url}/exams/${examId}/announcements`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.announcements.length, 2);
    assert.equal(body.announcements[0].message, "Latest note");
    assert.equal(body.announcements[0].sentBy, "Examiner One");
    assert.ok(body.announcements[0].sentAt);
  } finally {
    server.close();
  }
});

test("creates an announcement when the exam is published", async () => {
  const { db, state } = createFixture({ status: "PUBLISHED" });
  const app = createApp({ db });
  const { server, url } = await listen(app);

  try {
    const response = await fetch(`${url}/exams/${examId}/announcements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "  Please stay seated until time is called.  " }),
    });
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.announcement.message, "Please stay seated until time is called.");
    assert.equal(body.announcement.sentBy, "Examiner One");
    assert.equal(state.announcements.length, 1);
    assert.equal(state.auditLogs.length, 1);
    assert.equal(state.auditLogs[0].action, AuditAction.ANNOUNCEMENT_SENT);
    assert.equal(state.auditLogs[0].entityType, AuditEntityType.ANNOUNCEMENT);
    assert.equal(
      state.auditLogs[0].newValues.messageLength,
      "Please stay seated until time is called.".length,
    );
    assert.equal(state.auditLogs[0].newValues.message, undefined);
  } finally {
    server.close();
  }
});

test("rejects empty and oversized announcement messages", async () => {
  const { db } = createFixture();
  const app = createApp({ db });
  const { server, url } = await listen(app);

  try {
    const empty = await fetch(`${url}/exams/${examId}/announcements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "   " }),
    });
    assert.equal(empty.status, 400);

    const tooLong = await fetch(`${url}/exams/${examId}/announcements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "x".repeat(501) }),
    });
    assert.equal(tooLong.status, 400);
  } finally {
    server.close();
  }
});

test("returns 409 when the exam is not active for announcements", async () => {
  const { db, state } = createFixture({ status: "DRAFT" });
  const app = createApp({ db });
  const { server, url } = await listen(app);

  try {
    const response = await fetch(`${url}/exams/${examId}/announcements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "This should not be stored." }),
    });
    assert.equal(response.status, 409);
    assert.equal(state.announcements.length, 0);
    assert.equal(state.auditLogs.length, 0);
  } finally {
    server.close();
  }
});

test("returns 404 for another examiner's exam", async () => {
  const { db, state } = createFixture({ status: "ONGOING" });
  const app = createApp({ db, userId: otherExaminerId });
  const { server, url } = await listen(app);

  try {
    const list = await fetch(`${url}/exams/${examId}/announcements`);
    assert.equal(list.status, 404);

    const create = await fetch(`${url}/exams/${examId}/announcements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Unauthorized attempt." }),
    });
    assert.equal(create.status, 404);
    assert.equal(state.announcements.length, 0);
    assert.equal(state.auditLogs.length, 0);
  } finally {
    server.close();
  }
});
