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
