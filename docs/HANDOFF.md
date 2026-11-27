# Handoff

- **Current focus:** Continue frontend-only teacher portal work one area at a time.
- **Recent changes:** Added local-mock Students directory and separate Dashboard, Students, Exams, and Create exam navigation; removed create actions from the Exams list; updated question authoring for optional topics, single-answer Multiple Choices, custom wrong-answer penalties, and no group controls; limited candidate exam settings to negative-marking status; normalized auth users and added a render-error fallback; adjusted `jsconfig.json`; simplified startup loading to the animated logo and made `/` route to login. No backend code or new API integration was added.
- **Known issues:** Teacher announcements, consolidated results/disputes views, dispute chat UI, typography, and shared sidebar color remain.
- **Immediate next step:** Run static lint/build validation; do not start a live server unless requested. Continue with the remaining teacher views and frontend-only dispute conversation.
