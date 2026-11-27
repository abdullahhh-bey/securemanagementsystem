# Backend

Node.js, Express, and JavaScript API. Routes, controllers, services, models, middleware, validation, configuration, utilities, types, tests, and database files are organized by layer.

## Candidate portal API

Candidate routes are mounted at `/api/candidate` and require an authenticated `CANDIDATE` session:

- `GET /exams` and `GET /exams/:id` list enrolled exams and their access state.
- `POST /exams/:examId/attempts`, `GET /attempts/:attemptId/workspace`, `PUT /attempts/:attemptId/questions/:attemptQuestionId/answer`, and `POST /attempts/:attemptId/submit` manage official attempts.
- `GET /preferences` and `PATCH /preferences` read and update validated candidate display preferences (`textSize`, `contrast`, and `lineSpacing`).
- `GET /attempts/:attemptId/scratchpad` and `PUT /attempts/:attemptId/scratchpad` read and save private notes for an owned official attempt. Writes are limited to in-progress attempts and 20,000 characters; scratchpad content is separate from answers and grading.
- `GET /results` lists published results; `GET /disputes` and `POST /results/:resultId/disputes` track one dispute per published result.
- `GET /announcements` lists published announcements for enrolled exams.

Candidate result disputes and announcements use the `ResultDispute` and `ExamAnnouncement` models in `prisma/schema.prisma`.

## Examiner question analytics

Examiner exam routes are mounted at `/api/examiner/exams` and require an authenticated `EXAMINER` session:

- `GET /:examId/analytics/questions` returns question-level response patterns calculated from persisted `AttemptAnswer` and `AttemptAnswerOption` records.
- Only official attempts in `SUBMITTED` or `AUTO_SUBMITTED` states are included. In-progress, sandbox, expired, and abandoned attempts are excluded.
- Blank/unanswered items count as skipped. Answered items without awarded marks (including pending written answers) are reported as ungraded and excluded from correctness and observed-difficulty denominators. Partial credit is reported separately.
- Option selection counts and rates are aggregated without candidate identifiers or raw written responses. Observed difficulty is based on the average awarded-mark percentage (70%+ easy, 40–69.99% medium, below 40% hard); it is unavailable when there are no graded responses.

These features use the existing `CandidatePreference`, `AttemptScratchpad`, `AttemptAnswer`, and `AttemptAnswerOption` schema models; no new migration is required.

Generated report creation, file storage, and public report verification are not implemented by these endpoints. `GeneratedReport` currently stores metadata only; a secure verifier requires a defined storage/checksum verification contract.
