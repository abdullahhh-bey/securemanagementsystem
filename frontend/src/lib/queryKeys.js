export const queryKeys = {
  me: ['auth', 'me'],
  serverTime: ['time'],
  users: ['admin', 'users'],
  exams: ['exams'],
  exam: (id) => ['exams', String(id)],
  examCandidates: (id) => ['exams', String(id), 'candidates'],
  examAvailableCandidates: (id) => ['exams', String(id), 'candidates', 'available'],
  candidateExams: ['candidate', 'exams'],
  candidateExam: (id) => ['candidate', 'exams', String(id)],
}
