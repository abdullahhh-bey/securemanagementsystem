# Project Skeleton

## Setup

1. Install Node.js 20 or newer and npm.
2. Copy `.env.example` to `backend/.env` and fill in the Neon pooled `DATABASE_URL` and direct `DIRECT_URL`. Keep `.env` files out of version control.
3. Run `npm install` from the repository root.
4. Start the frontend with `npm run dev:frontend` and the backend with `npm run dev:backend` in separate terminals.
5. Run `npm run build` to build the frontend and syntax-check the backend. Run `npm run db:validate` to validate the Prisma schema.

The application requirements, features, and database schema will be defined after the problem statement is provided.
