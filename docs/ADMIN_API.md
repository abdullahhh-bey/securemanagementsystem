# Admin API

## Scope

The admin API manages user accounts only. Authentication/session endpoints belong to the auth implementation; exam, question, enrollment, grading, and result endpoints belong to the teacher API.

The router is deliberately isolated from `src/index.js` and shared auth files to minimize merge conflicts. It is not mounted until the auth teammate supplies and wires the middleware contract below.

## Routes

Mount `createAdminRouter` at `/api/admin`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/users` | Paginated user list; optional `q`, `role`, `isActive`, `page`, `pageSize` filters. |
| `GET` | `/users/:id` | Get a user by UUID. |
| `POST` | `/users` | Create an account with `email`, `fullName`, `role`, and an initial password. |
| `PATCH` | `/users/:id` | Update `email` and/or `fullName`. |
| `PATCH` | `/users/:id/role` | Assign one of the fixed roles. |
| `PATCH` | `/users/:id/status` | Activate or deactivate an account. |

Profile and role/status updates are separate so callers cannot accidentally change protected fields. Accounts are deactivated, not hard-deleted. User responses never include password hashes or sessions.

## Auth Integration Contract

`createAdminRouter` requires `prisma`, `authenticate`, `requireAdmin`, `getActorId`, and `hashPassword`. The auth teammate should mount it after wiring their existing auth implementation, for example:

```js
app.use("/api/admin", createAdminRouter({
  prisma,
  authenticate,
  requireAdmin,
  getActorId: (req) => req.auth.userId,
  hashPassword,
}));
```

Use the auth module's actual request identity property and password hasher. `requireAdmin` must reject every role except `ADMIN`; do not replace it with a client-controlled role header or body field. If auth's password policy differs, align the create-user validator with that policy before integration. No duplicate auth implementation is included.

## Validation and Integrity

- Zod validates and rejects unknown body/query fields, invalid UUIDs, malformed email, roles, status values, and invalid pagination.
- Emails are trimmed and lowercased; names are trimmed and bounded.
- New account passwords must be 12-128 characters and are passed directly to the injected hasher. The password itself is never persisted, returned, or included in audit values.
- Role changes and deactivation revoke outstanding sessions. Changes are audited in the same Prisma transaction.
- The last active administrator cannot be demoted or deactivated; an administrator cannot deactivate or demote themselves.
- Role/status mutations use serializable transactions; serialization conflicts return `409` so the client can safely retry.
- Request bodies are limited to 16 KB. Unexpected database errors are logged without exposing SQL or credentials and return a generic `500`.

## Responses

Successful responses use `{ "data": ... }`. List responses also include pagination metadata. Validation errors return `400`; unauthenticated/unauthorized behavior is owned by auth middleware; missing users return `404`; duplicate email, last-admin protection, and concurrency conflicts return `409`.

## Tests

Run `npm test --workspace backend`. Tests use injected authentication and a fake Prisma client, so they do not need Neon credentials or modify the database.
