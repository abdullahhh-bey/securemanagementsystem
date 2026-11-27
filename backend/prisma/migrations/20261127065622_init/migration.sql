-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'EXAMINER', 'CANDIDATE');

-- CreateEnum
CREATE TYPE "QuestionDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_SELECT', 'WRITTEN');

-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ONGOING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ENROLLED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "AttemptMode" AS ENUM ('OFFICIAL', 'SANDBOX');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED', 'EXPIRED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "AnswerStatus" AS ENUM ('UNANSWERED', 'ANSWERED');

-- CreateEnum
CREATE TYPE "GradingMethod" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('PENDING_REVIEW', 'READY_TO_PUBLISH', 'PUBLISHED', 'WITHHELD');

-- CreateEnum
CREATE TYPE "AttemptEventType" AS ENUM ('NETWORK_DISCONNECTED', 'NETWORK_RESTORED', 'ANSWER_SAVE_FAILED', 'ANSWER_SAVE_SUCCEEDED', 'TAB_HIDDEN', 'WINDOW_BLURRED', 'ATTEMPT_RESUMED');

-- CreateEnum
CREATE TYPE "EventReviewStatus" AS ENUM ('UNREVIEWED', 'REVIEWED', 'ACTION_REQUIRED');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ImportType" AS ENUM ('CANDIDATES', 'QUESTIONS');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'PARTIALLY_FAILED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "fullName" VARCHAR(160) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CANDIDATE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "revokedAt" TIMESTAMPTZ(6),
    "lastUsedAt" TIMESTAMPTZ(6),
    "userAgent" VARCHAR(512),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "question_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "categoryId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_versions" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "questionText" TEXT NOT NULL,
    "difficulty" "QuestionDifficulty" NOT NULL,
    "type" "QuestionType" NOT NULL,
    "defaultMarks" DECIMAL(8,2) NOT NULL,
    "markingGuide" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" UUID NOT NULL,
    "questionVersionId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "optionText" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exams" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "startsAt" TIMESTAMPTZ(6) NOT NULL,
    "endsAt" TIMESTAMPTZ(6) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "randomizeQuestions" BOOLEAN NOT NULL DEFAULT false,
    "randomizeOptions" BOOLEAN NOT NULL DEFAULT false,
    "status" "ExamStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_questions" (
    "id" UUID NOT NULL,
    "examId" UUID NOT NULL,
    "questionVersionId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "assignedMarks" DECIMAL(8,2) NOT NULL,

    CONSTRAINT "exam_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_enrollments" (
    "id" UUID NOT NULL,
    "examId" UUID NOT NULL,
    "candidateId" UUID NOT NULL,
    "enrolledById" UUID NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ENROLLED',
    "enrolledAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMPTZ(6),

    CONSTRAINT "exam_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_attempts" (
    "id" UUID NOT NULL,
    "examId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "mode" "AttemptMode" NOT NULL DEFAULT 'OFFICIAL',
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "durationMinutes" INTEGER NOT NULL,
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "submittedAt" TIMESTAMPTZ(6),
    "lastActivityAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "exam_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt_questions" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "questionVersionId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "assignedMarks" DECIMAL(8,2) NOT NULL,
    "optionOrder" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attempt_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt_answers" (
    "id" UUID NOT NULL,
    "attemptQuestionId" UUID NOT NULL,
    "textResponse" TEXT,
    "status" "AnswerStatus" NOT NULL DEFAULT 'UNANSWERED',
    "isMarkedForReview" BOOLEAN NOT NULL DEFAULT false,
    "awardedMarks" DECIMAL(8,2),
    "gradingMethod" "GradingMethod",
    "feedback" TEXT,
    "gradedById" UUID,
    "gradedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "attempt_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt_answer_options" (
    "answerId" UUID NOT NULL,
    "optionId" UUID NOT NULL,
    "selectedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attempt_answer_options_pkey" PRIMARY KEY ("answerId","optionId")
);

-- CreateTable
CREATE TABLE "exam_announcements" (
    "id" UUID NOT NULL,
    "examId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "publishedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "exam_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt_events" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "type" "AttemptEventType" NOT NULL,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "reviewStatus" "EventReviewStatus" NOT NULL DEFAULT 'UNREVIEWED',
    "reviewNote" TEXT,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMPTZ(6),

    CONSTRAINT "attempt_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "results" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "totalMarks" DECIMAL(8,2) NOT NULL,
    "obtainedMarks" DECIMAL(8,2),
    "status" "ResultStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMPTZ(6),
    "publishedById" UUID,
    "publishedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "result_disputes" (
    "id" UUID NOT NULL,
    "resultId" UUID NOT NULL,
    "openedById" UUID NOT NULL,
    "explanation" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedById" UUID,
    "resolvedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "result_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_reports" (
    "id" UUID NOT NULL,
    "resultId" UUID NOT NULL,
    "generatedById" UUID NOT NULL,
    "verificationCode" UUID NOT NULL,
    "storageKey" VARCHAR(1024) NOT NULL,
    "checksum" VARCHAR(128) NOT NULL,
    "generatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generated_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "type" "ImportType" NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'QUEUED',
    "sourceFileName" VARCHAR(255),
    "storageKey" VARCHAR(1024),
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "succeededRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_errors" (
    "id" UUID NOT NULL,
    "importJobId" UUID NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "fieldName" VARCHAR(100),
    "errorCode" VARCHAR(100),
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_preferences" (
    "userId" UUID NOT NULL,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "candidate_preferences_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "attempt_scratchpads" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "attempt_scratchpads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entityType" VARCHAR(100) NOT NULL,
    "entityId" VARCHAR(64) NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_isActive_idx" ON "users"("role", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_tokenHash_key" ON "user_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "user_sessions_userId_expiresAt_idx" ON "user_sessions"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "user_sessions_expiresAt_idx" ON "user_sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "question_categories_name_key" ON "question_categories"("name");

-- CreateIndex
CREATE INDEX "questions_authorId_isActive_idx" ON "questions"("authorId", "isActive");

-- CreateIndex
CREATE INDEX "questions_categoryId_idx" ON "questions"("categoryId");

-- CreateIndex
CREATE INDEX "question_versions_questionId_createdAt_idx" ON "question_versions"("questionId", "createdAt");

-- CreateIndex
CREATE INDEX "question_versions_difficulty_type_idx" ON "question_versions"("difficulty", "type");

-- CreateIndex
CREATE UNIQUE INDEX "question_versions_questionId_versionNumber_key" ON "question_versions"("questionId", "versionNumber");

-- CreateIndex
CREATE INDEX "question_options_questionVersionId_isCorrect_idx" ON "question_options"("questionVersionId", "isCorrect");

-- CreateIndex
CREATE UNIQUE INDEX "question_options_questionVersionId_position_key" ON "question_options"("questionVersionId", "position");

-- CreateIndex
CREATE INDEX "exams_ownerId_status_idx" ON "exams"("ownerId", "status");

-- CreateIndex
CREATE INDEX "exams_status_startsAt_endsAt_idx" ON "exams"("status", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "exam_questions_questionVersionId_idx" ON "exam_questions"("questionVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_questions_examId_position_key" ON "exam_questions"("examId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "exam_questions_examId_questionVersionId_key" ON "exam_questions"("examId", "questionVersionId");

-- CreateIndex
CREATE INDEX "exam_enrollments_candidateId_status_idx" ON "exam_enrollments"("candidateId", "status");

-- CreateIndex
CREATE INDEX "exam_enrollments_examId_status_idx" ON "exam_enrollments"("examId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "exam_enrollments_examId_candidateId_key" ON "exam_enrollments"("examId", "candidateId");

-- CreateIndex
CREATE INDEX "exam_attempts_examId_status_mode_idx" ON "exam_attempts"("examId", "status", "mode");

-- CreateIndex
CREATE INDEX "exam_attempts_participantId_status_idx" ON "exam_attempts"("participantId", "status");

-- CreateIndex
CREATE INDEX "exam_attempts_status_expiresAt_idx" ON "exam_attempts"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "exam_attempts_examId_participantId_mode_attemptNumber_key" ON "exam_attempts"("examId", "participantId", "mode", "attemptNumber");

-- CreateIndex
CREATE INDEX "attempt_questions_questionVersionId_idx" ON "attempt_questions"("questionVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_questions_attemptId_position_key" ON "attempt_questions"("attemptId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_questions_attemptId_questionVersionId_key" ON "attempt_questions"("attemptId", "questionVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_answers_attemptQuestionId_key" ON "attempt_answers"("attemptQuestionId");

-- CreateIndex
CREATE INDEX "attempt_answers_status_isMarkedForReview_idx" ON "attempt_answers"("status", "isMarkedForReview");

-- CreateIndex
CREATE INDEX "attempt_answers_gradedById_idx" ON "attempt_answers"("gradedById");

-- CreateIndex
CREATE INDEX "attempt_answer_options_optionId_idx" ON "attempt_answer_options"("optionId");

-- CreateIndex
CREATE INDEX "exam_announcements_examId_publishedAt_idx" ON "exam_announcements"("examId", "publishedAt");

-- CreateIndex
CREATE INDEX "attempt_events_attemptId_occurredAt_idx" ON "attempt_events"("attemptId", "occurredAt");

-- CreateIndex
CREATE INDEX "attempt_events_type_occurredAt_idx" ON "attempt_events"("type", "occurredAt");

-- CreateIndex
CREATE INDEX "attempt_events_reviewStatus_occurredAt_idx" ON "attempt_events"("reviewStatus", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "results_attemptId_key" ON "results"("attemptId");

-- CreateIndex
CREATE INDEX "results_status_publishedAt_idx" ON "results"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "results_reviewedById_idx" ON "results"("reviewedById");

-- CreateIndex
CREATE INDEX "result_disputes_status_createdAt_idx" ON "result_disputes"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "result_disputes_resultId_openedById_key" ON "result_disputes"("resultId", "openedById");

-- CreateIndex
CREATE UNIQUE INDEX "generated_reports_verificationCode_key" ON "generated_reports"("verificationCode");

-- CreateIndex
CREATE INDEX "generated_reports_resultId_generatedAt_idx" ON "generated_reports"("resultId", "generatedAt");

-- CreateIndex
CREATE INDEX "import_jobs_createdById_createdAt_idx" ON "import_jobs"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "import_jobs_status_createdAt_idx" ON "import_jobs"("status", "createdAt");

-- CreateIndex
CREATE INDEX "import_errors_importJobId_rowNumber_idx" ON "import_errors"("importJobId", "rowNumber");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_scratchpads_attemptId_key" ON "attempt_scratchpads"("attemptId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_createdAt_idx" ON "audit_logs"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "question_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_versions" ADD CONSTRAINT "question_versions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_versions" ADD CONSTRAINT "question_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "question_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "question_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_enrollments" ADD CONSTRAINT "exam_enrollments_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_enrollments" ADD CONSTRAINT "exam_enrollments_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_enrollments" ADD CONSTRAINT "exam_enrollments_enrolledById_fkey" FOREIGN KEY ("enrolledById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_questions" ADD CONSTRAINT "attempt_questions_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_questions" ADD CONSTRAINT "attempt_questions_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "question_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_attemptQuestionId_fkey" FOREIGN KEY ("attemptQuestionId") REFERENCES "attempt_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_answer_options" ADD CONSTRAINT "attempt_answer_options_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "attempt_answers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_answer_options" ADD CONSTRAINT "attempt_answer_options_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "question_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_announcements" ADD CONSTRAINT "exam_announcements_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_announcements" ADD CONSTRAINT "exam_announcements_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_events" ADD CONSTRAINT "attempt_events_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_events" ADD CONSTRAINT "attempt_events_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "exam_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_disputes" ADD CONSTRAINT "result_disputes_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_disputes" ADD CONSTRAINT "result_disputes_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_disputes" ADD CONSTRAINT "result_disputes_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_errors" ADD CONSTRAINT "import_errors_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_preferences" ADD CONSTRAINT "candidate_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_scratchpads" ADD CONSTRAINT "attempt_scratchpads_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
