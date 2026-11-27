# Architecture

## Folder Tree
```text
frontend/
  src/
    assets/
    components/
    features/
    hooks/
    lib/
    pages/
    services/
    styles/
    types/
backend/
  prisma.config.js
  prisma/
    schema.prisma
    migrations/
      20261127065622_init/
        migration.sql
  db/
    migrations/
    seeds/
  src/
    config/
    controllers/
    middleware/
    models/
    routes/
    services/
    types/
    utils/
    validators/
  tests/
docs/
  ADMIN_API.md
```

## Database Schema
The PostgreSQL/Neon schema is defined in `backend/prisma/schema.prisma`. See [DATABASE_DESIGN.md](./DATABASE_DESIGN.md) for the ER diagram, model decisions, constraints, and safe migration guidance.

## Data Flows
The frontend sends authenticated requests to the Express API under `/api`, using HTTP-only session cookies. In local development, the Vite proxy forwards same-origin `/api` requests to the backend. The frontend has no mock-mode switch or mock API fixtures.

## Teacher Portal
- `frontend/src/layouts/ExaminerLayout.jsx` provides Dashboard, Students, Exams, and Create exam navigation.
- The Students directory reads active candidates from `GET /api/examiner/candidates`; exam enrollment and removal use the examiner enrollment endpoints.
- Exams, questions, grading, results, disputes, and attempt monitoring use the corresponding `/api/examiner` endpoints. Exam creation is a separate route at `/examiner/exams/new`.
- Examiner question analytics at `/api/examiner/exams/:examId/analytics/questions` aggregate persisted official final-attempt answers; sandbox/non-final attempts and ungraded answers are excluded from graded difficulty rates.
- Exam settings exposed in the UI are limited to persisted backend fields. Negative marking and standalone total-mark inputs are not offered because the backend does not persist them; total marks come from assigned question marks.
- Authenticated user DTOs are normalized at the frontend API boundary; a root React error boundary renders a recovery screen for uncaught render errors.

## Integration Boundaries
- Candidate and admin screens use their authenticated `/api/candidate` and `/api/admin` endpoints.
- Candidate display preferences persist through `/api/candidate/preferences`; attempt scratchpads use candidate-owned `/api/candidate/attempts/:attemptId/scratchpad` endpoints and are separate from submitted answers.
- Generated-report creation, file storage, and verification remain unsupported: `GeneratedReport` stores metadata, and the verification panel is presentation-only until a storage/checksum verification contract exists.
- Features without matching backend endpoints (such as generated-report downloads and password reset/change) are not presented as working API-backed flows.
