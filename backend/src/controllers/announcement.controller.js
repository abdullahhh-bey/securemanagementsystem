import defaultPrisma from "../../db/db.js";
import { AuditAction, AuditEntityType, writeAuditLog } from "../utils/audit.js";

const ACTIVE_EXAM_STATUSES = new Set(["PUBLISHED", "ONGOING"]);

function toAnnouncementDto(announcement) {
  return {
    id: announcement.id,
    message: announcement.message,
    sentAt: announcement.publishedAt ?? announcement.createdAt,
    sentBy: announcement.author?.fullName ?? "Exam team",
  };
}

export function createAnnouncementHandlers(db = defaultPrisma) {
  async function findOwnedExam(examId, ownerId) {
    return db.exam.findFirst({
      where: {
        id: examId,
        ownerId,
      },
      select: {
        id: true,
        title: true,
        status: true,
      },
    });
  }

  // GET /api/examiner/exams/:examId/announcements
  const listExamAnnouncements = async (req, res) => {
    try {
      const { examId } = req.params;

      const exam = await findOwnedExam(examId, req.user.id);
      if (!exam) {
        return res.status(404).json({
          success: false,
          message: "Exam not found.",
        });
      }

      const announcements = await db.examAnnouncement.findMany({
        where: {
          examId,
          publishedAt: { not: null },
        },
        include: {
          author: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
        orderBy: [
          { publishedAt: "desc" },
          { createdAt: "desc" },
        ],
      });

      return res.status(200).json({
        success: true,
        announcements: announcements.map(toAnnouncementDto),
      });
    } catch (error) {
      console.error("List exam announcements error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to retrieve announcements.",
      });
    }
  };

  // POST /api/examiner/exams/:examId/announcements  { message }
  const createExamAnnouncement = async (req, res) => {
    try {
      const { examId } = req.params;
      const { message } = req.body ?? {};

      if (typeof message !== "string") {
        return res.status(400).json({
          success: false,
          message: "Write a message first.",
        });
      }

      const text = message.trim();
      if (!text) {
        return res.status(400).json({
          success: false,
          message: "Write a message first.",
        });
      }

      if (text.length > 500) {
        return res.status(400).json({
          success: false,
          message: "Keep announcements under 500 characters.",
        });
      }

      const exam = await findOwnedExam(examId, req.user.id);
      if (!exam) {
        return res.status(404).json({
          success: false,
          message: "Exam not found.",
        });
      }

      if (!ACTIVE_EXAM_STATUSES.has(exam.status)) {
        return res.status(409).json({
          success: false,
          message:
            "Announcements can be sent once the exam is published and until it ends.",
        });
      }

      const now = new Date();
      const announcement = await db.examAnnouncement.create({
        data: {
          examId,
          authorId: req.user.id,
          title: "Announcement",
          message: text,
          publishedAt: now,
        },
        include: {
          author: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      });

      await writeAuditLog(db, {
        actorId: req.user.id,
        action: AuditAction.ANNOUNCEMENT_SENT,
        entityType: AuditEntityType.ANNOUNCEMENT,
        entityId: announcement.id,
        newValues: {
          examId,
          examTitle: exam.title,
          messageLength: text.length,
        },
      });

      return res.status(201).json({
        success: true,
        message: "Announcement sent successfully.",
        announcement: toAnnouncementDto(announcement),
      });
    } catch (error) {
      console.error("Create exam announcement error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to send announcement.",
      });
    }
  };

  return { listExamAnnouncements, createExamAnnouncement };
}

const defaultHandlers = createAnnouncementHandlers();
export const listExamAnnouncements = defaultHandlers.listExamAnnouncements;
export const createExamAnnouncement = defaultHandlers.createExamAnnouncement;
