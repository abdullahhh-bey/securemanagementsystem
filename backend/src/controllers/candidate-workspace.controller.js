import prisma from "../../db/db.js";

const DEFAULT_PREFERENCES = Object.freeze({
  textSize: "medium",
  contrast: "standard",
  lineSpacing: "standard",
});
const PREFERENCE_VALUES = Object.freeze({
  textSize: ["medium", "large", "extra-large"],
  contrast: ["standard", "high"],
  lineSpacing: ["standard", "relaxed"],
});
const SCRATCHPAD_MAX_LENGTH = 20000;

function validatePreferencePatch(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Provide a preference object." };
  }
  const keys = Object.keys(value);
  if (!keys.length) return { error: "Provide at least one display preference." };

  for (const key of keys) {
    if (!Object.hasOwn(PREFERENCE_VALUES, key)) {
      return { error: `Unknown display preference: ${key}.` };
    }
    if (!PREFERENCE_VALUES[key].includes(value[key])) {
      return { error: `Invalid value for ${key}.` };
    }
  }

  return { preferences: value };
}

function readStoredPreferences(value) {
  if (value == null) return { ...DEFAULT_PREFERENCES };
  const validated = validatePreferencePatch(value);
  if (validated.error) throw new Error(`Invalid stored candidate preferences: ${validated.error}`);
  return { ...DEFAULT_PREFERENCES, ...validated.preferences };
}

export function createCandidateWorkspaceHandlers(db = prisma) {
  const getPreferences = async (req, res) => {
    try {
      const row = await db.candidatePreference.findUnique({
        where: { userId: req.user.id },
        select: { preferences: true },
      });

      return res.status(200).json({
        success: true,
        preferences: readStoredPreferences(row?.preferences),
      });
    } catch (error) {
      console.error("Get candidate preferences error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to retrieve display preferences.",
      });
    }
  };

  const updatePreferences = async (req, res) => {
    const validated = validatePreferencePatch(req.body);
    if (validated.error) {
      return res.status(400).json({ success: false, message: validated.error });
    }

    try {
      const existing = await db.candidatePreference.findUnique({
        where: { userId: req.user.id },
        select: { preferences: true },
      });
      const preferences = {
        ...readStoredPreferences(existing?.preferences),
        ...validated.preferences,
      };
      const saved = await db.candidatePreference.upsert({
        where: { userId: req.user.id },
        create: { userId: req.user.id, preferences },
        update: { preferences },
        select: { preferences: true },
      });

      return res.status(200).json({
        success: true,
        preferences: readStoredPreferences(saved.preferences),
      });
    } catch (error) {
      console.error("Update candidate preferences error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to save display preferences.",
      });
    }
  };

  const getScratchpad = async (req, res) => {
    try {
      const attempt = await db.examAttempt.findFirst({
        where: {
          id: req.params.attemptId,
          participantId: req.user.id,
          mode: "OFFICIAL",
        },
        select: { id: true },
      });

      if (!attempt) {
        return res.status(404).json({
          success: false,
          message: "Attempt not found.",
        });
      }

      const scratchpad = await db.attemptScratchpad.findUnique({
        where: { attemptId: attempt.id },
        select: { content: true, updatedAt: true },
      });

      return res.status(200).json({
        success: true,
        scratchpad: {
          content: scratchpad?.content ?? "",
          updatedAt: scratchpad?.updatedAt ?? null,
        },
      });
    } catch (error) {
      console.error("Get attempt scratchpad error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to retrieve scratchpad.",
      });
    }
  };

  const saveScratchpad = async (req, res) => {
    const { content } = req.body ?? {};
    if (typeof content !== "string" || content.length > SCRATCHPAD_MAX_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Scratchpad content must be text no longer than ${SCRATCHPAD_MAX_LENGTH} characters.`,
      });
    }

    try {
      const result = await db.$transaction(async (tx) => {
        const attempt = await tx.examAttempt.findFirst({
          where: {
            id: req.params.attemptId,
            participantId: req.user.id,
            mode: "OFFICIAL",
          },
          select: { id: true, status: true },
        });
        if (!attempt) return { error: "NOT_FOUND" };
        if (attempt.status !== "IN_PROGRESS") return { error: "NOT_ACTIVE" };

        const scratchpad = await tx.attemptScratchpad.upsert({
          where: { attemptId: attempt.id },
          create: { attemptId: attempt.id, content },
          update: { content },
          select: { content: true, updatedAt: true },
        });
        return { scratchpad };
      });

      if (result.error === "NOT_FOUND") {
        return res.status(404).json({
          success: false,
          message: "Attempt not found.",
        });
      }
      if (result.error === "NOT_ACTIVE") {
        return res.status(409).json({
          success: false,
          message: "Scratchpad changes are only allowed while the attempt is in progress.",
        });
      }

      return res.status(200).json({
        success: true,
        scratchpad: result.scratchpad,
      });
    } catch (error) {
      console.error("Save attempt scratchpad error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to save scratchpad.",
      });
    }
  };

  return { getPreferences, updatePreferences, getScratchpad, saveScratchpad };
}

const handlers = createCandidateWorkspaceHandlers();
export const getCandidatePreferences = handlers.getPreferences;
export const updateCandidatePreferences = handlers.updatePreferences;
export const getAttemptScratchpad = handlers.getScratchpad;
export const saveAttemptScratchpad = handlers.saveScratchpad;
