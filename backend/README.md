# Backend

Node.js, Express, and JavaScript API. Routes, controllers, services, models, middleware, validation, configuration, utilities, types, tests, and database files are organized by layer.

## Candidate portal API

Candidate routes are mounted at `/api/candidate` and require an authenticated `CANDIDATE` session:

- `GET /exams` and `GET /exams/:id` list enrolled exams and their access state.
- `POST /exams/:examId/attempts`, `GET /attempts/:attemptId/workspace`, `PUT /attempts/:attemptId/questions/:attemptQuestionId/answer`, and `POST /attempts/:attemptId/submit` manage official attempts.
- `GET /results` lists published results; `GET /disputes` and `POST /results/:resultId/disputes` track one dispute per published result.
- `GET /announcements` lists published announcements for enrolled exams.

Candidate result disputes and announcements use the `ResultDispute` and `ExamAnnouncement` models in `prisma/schema.prisma`.
