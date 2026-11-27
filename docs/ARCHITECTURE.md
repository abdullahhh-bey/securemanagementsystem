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
The admin API is implemented as an isolated router factory in the backend. It receives the Prisma client and auth middleware through dependency injection and is mounted by the server integration after the auth teammate's middleware contract is available. See [ADMIN_API.md](./ADMIN_API.md).

## Teacher Portal
- `frontend/src/layouts/ExaminerLayout.jsx` provides Dashboard, Students, Exams, and Create exam navigation.
- `frontend/src/pages/examiner/StudentsPage.jsx` uses local frontend mock data only; no backend API is connected. Exam enrollment remains scoped to each exam's existing UI workflow.
- `frontend/src/pages/examiner/ExamsListPage.jsx` lists the examiner's exams. Exam creation is a separate route at `/examiner/exams/new`.
- Question authoring and assignment changes are frontend-only: optional topics, one-answer Multiple Choices, per-question penalty fractions, and no group controls. The student exam-details view exposes only the negative-marking On/Off status.
- Authenticated user DTOs are normalized at the frontend API boundary; a root React error boundary renders a recovery screen for uncaught render errors.
