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
```

## Database Schema
The PostgreSQL/Neon schema is defined in `backend/prisma/schema.prisma`. See [DATABASE_DESIGN.md](./DATABASE_DESIGN.md) for the ER diagram, model decisions, constraints, and safe migration guidance.

## Data Flows
The JavaScript frontend and backend remain bootstrapped independently; no API or database access code has been implemented. Database access will use Prisma from the backend after the API work is assigned.
