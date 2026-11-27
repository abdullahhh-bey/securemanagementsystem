
import prisma from "../../db/db.js";

// Determine whether the candidate can access the exam.
const getAccessStatus = (exam) => {
    const now = new Date();

    if (
        exam.status === "COMPLETED" ||
        now >= exam.endsAt
    ) {
        return "CLOSED";
    }

    if (now < exam.startsAt) {
        return "UPCOMING";
    }

    return "AVAILABLE";
};

// List exams assigned to the logged-in candidate.
export const getCandidateExams = async (req, res) => {
    try {
        const candidateId = req.user.id;

        const enrollments = await prisma.examEnrollment.findMany({
            where: {
                candidateId,
                status: "ENROLLED",
                exam: {
                    status: {
                        in: ["PUBLISHED", "ONGOING", "COMPLETED"],
                    },
                },
            },
            include: {
                exam: {
                    include: {
                        _count: {
                            select: {
                                questions: true,
                            },
                        },
                        questions: {
                            select: {
                                assignedMarks: true,
                            },
                        },
                        attempts: {
                            where: {
                                participantId: candidateId,
                                mode: "OFFICIAL",
                            },
                            orderBy: {
                                attemptNumber: "desc",
                            },
                            select: {
                                id: true,
                                attemptNumber: true,
                                status: true,
                                startedAt: true,
                                expiresAt: true,
                                submittedAt: true,
                                result: {
                                    select: {
                                        status: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: {
                enrolledAt: "desc",
            },
        });

        const exams = enrollments.map(({ exam, enrolledAt }) => ({
            ...exam,
            enrolledAt,
            accessStatus: getAccessStatus(exam),
            resultsPublished: exam.attempts.some(
                (attempt) => attempt.result?.status === "PUBLISHED"
            ),
        }));

        return res.status(200).json({
            success: true,
            exams,
        });
    } catch (error) {
        console.error("Get candidate exams error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve assigned exams.",
        });
    }
};

// Get details of one exam assigned to the logged-in candidate.
export const getCandidateExam = async (req, res) => {
    try {
        const candidateId = req.user.id;
        const { id } = req.params;

        const enrollment = await prisma.examEnrollment.findFirst({
            where: {
                examId: id,
                candidateId,
                status: "ENROLLED",
                exam: {
                    status: {
                        in: ["PUBLISHED", "ONGOING", "COMPLETED"],
                    },
                },
            },
            include: {
                exam: {
                    include: {
                        _count: {
                            select: {
                                questions: true,
                            },
                        },
                        questions: {
                            select: {
                                assignedMarks: true,
                            },
                        },
                        attempts: {
                            where: {
                                participantId: candidateId,
                                mode: "OFFICIAL",
                            },
                            orderBy: {
                                attemptNumber: "desc",
                            },
                            select: {
                                id: true,
                                attemptNumber: true,
                                status: true,
                                startedAt: true,
                                expiresAt: true,
                                submittedAt: true,
                                result: {
                                    select: {
                                        status: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!enrollment) {
            return res.status(404).json({
                success: false,
                message: "Exam not found or you are not enrolled in it.",
            });
        }

        const exam = enrollment.exam;

        return res.status(200).json({
            success: true,
            exam: {
                ...exam,
                enrolledAt: enrollment.enrolledAt,
                accessStatus: getAccessStatus(exam),
                resultsPublished: exam.attempts.some(
                    (attempt) => attempt.result?.status === "PUBLISHED"
                ),
            },
        });
    } catch (error) {
        console.error("Get candidate exam error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve exam details.",
        });
    }
};


const shuffleArray = (items) => {
    const shuffled = [...items];

    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
};

// Start a new official attempt or resume an existing one.
export const startCandidateAttempt = async (req, res) => {
    try {
        const candidateId = req.user.id;
        const { examId } = req.params;
        const now = new Date();

        const attempt = await prisma.$transaction(
            async (tx) => {
                // Verify active enrollment and exam availability.
                const enrollment = await tx.examEnrollment.findFirst({
                    where: {
                        examId,
                        candidateId,
                        status: "ENROLLED",
                        exam: {
                            status: {
                                in: ["PUBLISHED", "ONGOING"],
                            },
                        },
                    },
                    include: {
                        exam: {
                            include: {
                                questions: {
                                    include: {
                                        questionVersion: {
                                            include: {
                                                options: {
                                                    select: {
                                                        id: true,
                                                        position: true,
                                                    },
                                                    orderBy: {
                                                        position: "asc",
                                                    },
                                                },
                                            },
                                        },
                                    },
                                    orderBy: {
                                        position: "asc",
                                    },
                                },
                            },
                        },
                    },
                });

                if (!enrollment) {
                    throw new Error("EXAM_NOT_FOUND");
                }

                const exam = enrollment.exam;

                if (now < exam.startsAt || now >= exam.endsAt) {
                    throw new Error("EXAM_NOT_AVAILABLE");
                }

                // Find an existing in-progress official attempt.
                const existingAttempt = await tx.examAttempt.findFirst({
                    where: {
                        examId,
                        participantId: candidateId,
                        mode: "OFFICIAL",
                        status: "IN_PROGRESS",
                    },
                    include: {
                        questions: true,
                    },
                });

                if (existingAttempt) {
                    if (existingAttempt.expiresAt > now) {
                        return existingAttempt;
                    }

                    // Expire an attempt whose time has run out.
                    await tx.examAttempt.update({
                        where: {
                            id: existingAttempt.id,
                        },
                        data: {
                            status: "AUTO_SUBMITTED",
                            submittedAt: now,
                            lastActivityAt: now,
                        },
                    });
                }

                // Count all official attempts, including expired/submitted ones.
                const previousAttempts = await tx.examAttempt.count({
                    where: {
                        examId,
                        participantId: candidateId,
                        mode: "OFFICIAL",
                    },
                });

                if (previousAttempts >= exam.maxAttempts) {
                    throw new Error("MAX_ATTEMPTS_REACHED");
                }

                if (exam.questions.length === 0) {
                    throw new Error("EXAM_HAS_NO_QUESTIONS");
                }

                // Apply exam question randomization.
                const examQuestions = exam.randomizeQuestions
                    ? shuffleArray(exam.questions)
                    : exam.questions;

                // Prepare the attempt's question snapshot.
                const attemptQuestions = examQuestions.map((question, index) => {
                    const options = question.questionVersion.options;

                    const optionOrder = exam.randomizeOptions
                        ? shuffleArray(options).map((option) => option.id)
                        : options.map((option) => option.id);

                    return {
                        questionVersionId: question.questionVersionId,
                        position: index + 1,
                        assignedMarks: question.assignedMarks,
                        optionOrder,
                    };
                });

                const expiresAt = new Date(
                    Math.min(
                        now.getTime() + exam.durationMinutes * 60 * 1000,
                        exam.endsAt.getTime()
                    )
                );

                // Create the official attempt and its question snapshot.
                return tx.examAttempt.create({
                    data: {
                        examId,
                        participantId: candidateId,
                        attemptNumber: previousAttempts + 1,
                        mode: "OFFICIAL",
                        status: "IN_PROGRESS",
                        durationMinutes: exam.durationMinutes,
                        startedAt: now,
                        expiresAt,
                        questions: {
                            create: attemptQuestions,
                        },
                    },
                    include: {
                        questions: true,
                    },
                });
            },
            {
                isolationLevel: "Serializable",
            }
        );

        return res.status(200).json({
            success: true,
            message: "Exam attempt started or resumed successfully.",
            attempt,
        });
    } catch (error) {
        if (error.message === "EXAM_NOT_FOUND") {
            return res.status(404).json({
                success: false,
                message: "Exam not found or you are not enrolled.",
            });
        }

        if (error.message === "EXAM_NOT_AVAILABLE") {
            return res.status(400).json({
                success: false,
                message: "This exam is not currently available.",
            });
        }

        if (error.message === "MAX_ATTEMPTS_REACHED") {
            return res.status(400).json({
                success: false,
                message: "You have reached the maximum number of attempts.",
            });
        }

        if (error.message === "EXAM_HAS_NO_QUESTIONS") {
            return res.status(400).json({
                success: false,
                message: "This exam has no assigned questions.",
            });
        }

        console.error("Start candidate attempt error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to start exam attempt.",
        });
    }
};

// Get the exam workspace for an existing candidate attempt.
export const getCandidateAttemptWorkspace = async (req, res) => {
    try {
        const candidateId = req.user.id;
        const { attemptId } = req.params;
        const now = new Date();

        const attempt = await prisma.examAttempt.findFirst({
            where: {
                id: attemptId,
                participantId: candidateId,
                mode: "OFFICIAL",
            },
            include: {
                exam: {
                    select: {
                        id: true,
                        title: true,
                        instructions: true,
                        startsAt: true,
                        endsAt: true,
                    },
                },
                questions: {
                    orderBy: { position: "asc" },
                    include: {
                        questionVersion: {
                            select: {
                                id: true,
                                questionText: true,
                                difficulty: true,
                                type: true,
                                options: {
                                    select: {
                                        id: true,
                                        position: true,
                                        optionText: true,
                                    },
                                },
                            },
                        },
                        answer: {
                            select: {
                                textResponse: true,
                                status: true,
                                isMarkedForReview: true,
                                selectedOptions: {
                                    select: {
                                        optionId: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!attempt) {
            return res.status(404).json({
                success: false,
                message: "Exam attempt not found.",
            });
        }

        // Automatically finalize an attempt whose time has expired.
        let currentStatus = attempt.status;

        if (
            currentStatus === "IN_PROGRESS" &&
            attempt.expiresAt <= now
        ) {
            await prisma.examAttempt.update({
                where: { id: attempt.id },
                data: {
                    status: "AUTO_SUBMITTED",
                    submittedAt: now,
                    lastActivityAt: now,
                },
            });

            currentStatus = "AUTO_SUBMITTED";
        }

        const questions = attempt.questions.map((item) => {
            const optionsById = new Map(
                item.questionVersion.options.map((option) => [
                    option.id,
                    option,
                ])
            );

            const orderedOptions = item.optionOrder
                .map((optionId) => optionsById.get(optionId))
                .filter(Boolean);

            return {
                id: item.id,
                position: item.position,
                assignedMarks: item.assignedMarks,
                question: {
                    id: item.questionVersion.id,
                    text: item.questionVersion.questionText,
                    difficulty: item.questionVersion.difficulty,
                    type: item.questionVersion.type,
                },
                options: orderedOptions,
                answer: item.answer
                    ? {
                        textResponse: item.answer.textResponse,
                        status: item.answer.status,
                        isMarkedForReview: item.answer.isMarkedForReview,
                        selectedOptionIds: item.answer.selectedOptions.map(
                            (option) => option.optionId
                        ),
                    }
                    : null,
            };
        });

        return res.status(200).json({
            success: true,
            workspace: {
                attemptId: attempt.id,
                attemptNumber: attempt.attemptNumber,
                status: currentStatus,
                startedAt: attempt.startedAt,
                expiresAt: attempt.expiresAt,
                serverTime: now,
                exam: attempt.exam,
                questions,
            },
        });
    } catch (error) {
        console.error("Get candidate workspace error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load exam workspace.",
        });
    }
};

// Save an answer and optionally mark the question for review.
export const saveCandidateAnswer = async (req, res) => {
    try {
        const candidateId = req.user.id;
        const { attemptId, attemptQuestionId } = req.params;

        const {
            selectedOptionIds,
            textResponse,
            isMarkedForReview,
        } = req.body;

        const result = await prisma.$transaction(async (tx) => {
            const attempt = await tx.examAttempt.findFirst({
                where: {
                    id: attemptId,
                    participantId: candidateId,
                    mode: "OFFICIAL",
                },
            });

            if (!attempt) return { error: "ATTEMPT_NOT_FOUND" };

            if (attempt.status !== "IN_PROGRESS") {
                return { error: "ATTEMPT_NOT_IN_PROGRESS" };
            }

            const now = new Date();

            if (attempt.expiresAt <= now) {
                await tx.examAttempt.update({
                    where: { id: attemptId },
                    data: {
                        status: "AUTO_SUBMITTED",
                        submittedAt: now,
                        lastActivityAt: now,
                    },
                });

                return { error: "ATTEMPT_EXPIRED" };
            }

            const question = await tx.attemptQuestion.findFirst({
                where: {
                    id: attemptQuestionId,
                    attemptId,
                },
                include: {
                    questionVersion: {
                        include: {
                            options: {
                                select: { id: true },
                            },
                        },
                    },
                    answer: {
                        include: {
                            selectedOptions: {
                                select: { optionId: true },
                            },
                        },
                    },
                },
            });

            if (!question) return { error: "QUESTION_NOT_FOUND" };

            const type = question.questionVersion.type;
            const existingAnswer = question.answer;

            const finalOptionIds =
                selectedOptionIds !== undefined
                    ? selectedOptionIds
                    : existingAnswer?.selectedOptions.map((item) => item.optionId) ?? [];

            const finalTextResponse =
                textResponse !== undefined
                    ? textResponse
                    : existingAnswer?.textResponse ?? null;

            const finalReviewStatus =
                isMarkedForReview !== undefined
                    ? isMarkedForReview
                    : existingAnswer?.isMarkedForReview ?? false;

            if (
                !Array.isArray(finalOptionIds) ||
                !finalOptionIds.every((id) => typeof id === "string") ||
                new Set(finalOptionIds).size !== finalOptionIds.length
            ) {
                return { error: "INVALID_OPTIONS" };
            }

            if (typeof finalReviewStatus !== "boolean") {
                return { error: "INVALID_REVIEW_STATUS" };
            }

            if (type === "SINGLE_CHOICE" && finalOptionIds.length > 1) {
                return { error: "ONLY_ONE_OPTION_ALLOWED" };
            }

            if (type === "WRITTEN" && finalOptionIds.length > 0) {
                return { error: "WRITTEN_QUESTION_OPTIONS_NOT_ALLOWED" };
            }

            if (
                type !== "WRITTEN" &&
                finalTextResponse !== null &&
                finalTextResponse !== ""
            ) {
                return { error: "TEXT_NOT_ALLOWED" };
            }

            if (
                finalTextResponse !== null &&
                typeof finalTextResponse !== "string"
            ) {
                return { error: "INVALID_TEXT_RESPONSE" };
            }

            const validOptionIds = question.questionVersion.options.map(
                (option) => option.id
            );

            if (!finalOptionIds.every((id) => validOptionIds.includes(id))) {
                return { error: "INVALID_OPTIONS" };
            }

            const hasAnswer =
                type === "WRITTEN"
                    ? Boolean(finalTextResponse?.trim())
                    : finalOptionIds.length > 0;

            const answerData = {
                textResponse: type === "WRITTEN" ? finalTextResponse : null,
                status: hasAnswer ? "ANSWERED" : "UNANSWERED",
                isMarkedForReview: finalReviewStatus,
            };

            const answer = await tx.attemptAnswer.upsert({
                where: {
                    attemptQuestionId,
                },
                create: {
                    attemptQuestionId,
                    ...answerData,
                    selectedOptions: {
                        create: finalOptionIds.map((optionId) => ({ optionId })),
                    },
                },
                update: {
                    ...answerData,
                    selectedOptions: {
                        deleteMany: {},
                        create: finalOptionIds.map((optionId) => ({ optionId })),
                    },
                },
                include: {
                    selectedOptions: {
                        select: { optionId: true },
                    },
                },
            });

            await tx.examAttempt.update({
                where: { id: attemptId },
                data: { lastActivityAt: now },
            });

            return { answer };
        });

        if (result.error) {
            const errors = {
                ATTEMPT_NOT_FOUND: [404, "Attempt not found."],
                ATTEMPT_NOT_IN_PROGRESS: [400, "This attempt is not in progress."],
                ATTEMPT_EXPIRED: [400, "Time expired. Your attempt was automatically submitted."],
                QUESTION_NOT_FOUND: [404, "Question not found in this attempt."],
                INVALID_OPTIONS: [400, "One or more selected options are invalid."],
                INVALID_REVIEW_STATUS: [400, "Review status must be true or false."],
                ONLY_ONE_OPTION_ALLOWED: [400, "Select only one option for this question."],
                WRITTEN_QUESTION_OPTIONS_NOT_ALLOWED: [400, "Written questions do not accept options."],
                TEXT_NOT_ALLOWED: [400, "Text responses are only allowed for written questions."],
                INVALID_TEXT_RESPONSE: [400, "Text response must be a string or null."],
            };

            const [status, message] = errors[result.error];

            return res.status(status).json({
                success: false,
                message,
            });
        }

        return res.status(200).json({
            success: true,
            message: "Answer saved successfully.",
            answer: {
                textResponse: result.answer.textResponse,
                status: result.answer.status,
                isMarkedForReview: result.answer.isMarkedForReview,
                selectedOptionIds: result.answer.selectedOptions.map(
                    (item) => item.optionId
                ),
            },
        });
    } catch (error) {
        console.error("Save candidate answer error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to save answer.",
        });
    }
};

// Submit an exam attempt manually or automatically after expiry.
export const submitCandidateAttempt = async (req, res) => {
    try {
        const candidateId = req.user.id;
        const { attemptId } = req.params;
        const now = new Date();

        const result = await prisma.$transaction(async (tx) => {
            const attempt = await tx.examAttempt.findFirst({
                where: {
                    id: attemptId,
                    participantId: candidateId,
                    mode: "OFFICIAL",
                },
                include: {
                    questions: {
                        include: {
                            answer: {
                                select: {
                                    status: true,
                                    isMarkedForReview: true,
                                },
                            },
                        },
                    },
                },
            });

            if (!attempt) return { error: "ATTEMPT_NOT_FOUND" };

            if (attempt.status !== "IN_PROGRESS") {
                return { error: "ATTEMPT_ALREADY_SUBMITTED" };
            }

            const autoSubmitted = attempt.expiresAt <= now;

            const answeredQuestions = attempt.questions.filter(
                (question) => question.answer?.status === "ANSWERED"
            ).length;

            const totalQuestions = attempt.questions.length;

            const updatedAttempt = await tx.examAttempt.update({
                where: { id: attemptId },
                data: {
                    status: autoSubmitted ? "AUTO_SUBMITTED" : "SUBMITTED",
                    submittedAt: now,
                    lastActivityAt: now,
                },
            });

            return {
                attempt: updatedAttempt,
                autoSubmitted,
                totalQuestions,
                answeredQuestions,
                unansweredQuestions: totalQuestions - answeredQuestions,
            };
        });

        if (result.error) {
            const errors = {
                ATTEMPT_NOT_FOUND: [404, "Attempt not found."],
                ATTEMPT_ALREADY_SUBMITTED: [400, "This attempt has already been submitted or finalized."],
            };

            const [status, message] = errors[result.error];

            return res.status(status).json({
                success: false,
                message,
            });
        }

        return res.status(200).json({
            success: true,
            message: result.autoSubmitted
                ? "Time expired. Your exam was automatically submitted."
                : "Exam submitted successfully.",
            attempt: {
                id: result.attempt.id,
                status: result.attempt.status,
                submittedAt: result.attempt.submittedAt,
            },
            summary: {
                totalQuestions: result.totalQuestions,
                answeredQuestions: result.answeredQuestions,
                unansweredQuestions: result.unansweredQuestions,
            },
        });
    } catch (error) {
        console.error("Submit candidate attempt error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to submit exam.",
        });
    }
};

// Get published results belonging to the logged-in candidate.
export const getCandidateResults = async (req, res) => {
    try {
        const results = await prisma.result.findMany({
            where: {
                status: "PUBLISHED",
                attempt: {
                    participantId: req.user.id,
                    mode: "OFFICIAL",
                },
            },
            include: {
                attempt: {
                    select: {
                        id: true,
                        attemptNumber: true,
                        submittedAt: true,
                        exam: {
                            select: {
                                id: true,
                                title: true,
                            },
                        },
                    },
                },
                disputes: {
                    where: {
                        openedById: req.user.id,
                    },
                    select: {
                        id: true,
                        explanation: true,
                        status: true,
                        resolution: true,
                        createdAt: true,
                    },
                },
            },
            orderBy: {
                publishedAt: "desc",
            },
        });

        return res.status(200).json({
            success: true,
            results,
        });
    } catch (error) {
        console.error("Get candidate results error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve results.",
        });
    }
};

// List announcements published for exams assigned to the logged-in candidate.
export const getCandidateAnnouncements = async (req, res) => {
    try {
        const announcements = await prisma.examAnnouncement.findMany({
            where: {
                publishedAt: { not: null },
                exam: {
                    enrollments: {
                        some: {
                            candidateId: req.user.id,
                            status: "ENROLLED",
                        },
                    },
                },
            },
            include: {
                exam: {
                    select: {
                        id: true,
                        title: true,
                    },
                },
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
            announcements,
        });
    } catch (error) {
        console.error("Get candidate announcements error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve announcements.",
        });
    }
};

// Submit a dispute against the candidate's own published result.
export const createCandidateDispute = async (req, res) => {
    try {
        const candidateId = req.user.id;
        const { resultId } = req.params;
        const { explanation } = req.body;

        if (
            typeof explanation !== "string" ||
            explanation.trim().length < 20
        ) {
            return res.status(400).json({
                success: false,
                message: "Please explain your concern in at least 20 characters.",
            });
        }

        const result = await prisma.result.findFirst({
            where: {
                id: resultId,
                status: "PUBLISHED",
                attempt: {
                    participantId: candidateId,
                    mode: "OFFICIAL",
                },
            },
        });

        if (!result) {
            return res.status(404).json({
                success: false,
                message: "Published result not found.",
            });
        }

        const dispute = await prisma.resultDispute.create({
            data: {
                resultId,
                openedById: candidateId,
                explanation: explanation.trim(),
                status: "OPEN",
            },
        });

        return res.status(201).json({
            success: true,
            message: "Result dispute submitted successfully.",
            dispute,
        });
    } catch (error) {
        if (error.code === "P2002") {
            return res.status(409).json({
                success: false,
                message: "You have already submitted a dispute for this result.",
            });
        }

        console.error("Create candidate dispute error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to submit dispute.",
        });
    }
};

// Track disputes submitted by the logged-in candidate.
export const getCandidateDisputes = async (req, res) => {
    try {
        const disputes = await prisma.resultDispute.findMany({
            where: {
                openedById: req.user.id,
            },
            include: {
                result: {
                    select: {
                        id: true,
                        totalMarks: true,
                        obtainedMarks: true,
                        status: true,
                        attempt: {
                            select: {
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
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        return res.status(200).json({
            success: true,
            disputes,
        });
    } catch (error) {
        console.error("Get candidate disputes error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve disputes.",
        });
    }
};