import { examStatus, exams, enrollments, requireRole, users } from './db'
import {
  DAY, DIFFICULTY_WEIGHT, DISPUTE_WINDOW_DAYS, PASS_PERCENT, disputes, gradeLetter, hash, maxMarks, publishedAt, questionById,
  questionMarks, realAttempts, resultsState, round2, currentScore, assignedFor,
} from './examData'
import { ownedExam } from './exams'
import { clone, delay, fail, serverNow } from './helpers'
import { makeCsv, makePdf } from './pdf'
import { formatDateTime } from '@/lib/format'

const person = (id) => {
  const u = users.find((x) => x.id === id)
  return { id: u.id, name: u.name, email: u.email }
}

const submitted = (examId) => realAttempts(examId).filter((a) => a.status === 'SUBMITTED')

export function verificationId(...parts) {
  const h = hash(parts.join(':'))
  const h2 = hash(`${parts.join(':')}:cul`)
  return `CUL-${h.toString(36).toUpperCase().padStart(7, '0').slice(0, 4)}-${h2.toString(36).toUpperCase().padStart(7, '0').slice(0, 4)}`
}

export function resultRows(exam) {
  return submitted(exam.id)
    .map((attempt) => {
      const score = currentScore(attempt)
      const max = maxMarks(attempt)
      const percent = max ? round2((score.total / max) * 100) : 0
      return {
        attemptId: attempt.id,
        candidate: person(attempt.candidateId),
        total: score.total,
        max,
        percent,
        grade: gradeLetter(percent),
        passed: percent >= PASS_PERCENT,
        pending: score.pending,
        version: score.version,
        submittedAt: attempt.submittedAt,
        incidentCount: attempt.incidents.length,
        compensationMinutes: attempt.compensations.reduce((s, c) => s + c.minutes, 0),
      }
    })
    .sort((a, b) => b.percent - a.percent)
}

function summarize(rows) {
  if (rows.length === 0) return { count: 0, average: 0, highest: 0, lowest: 0, passRate: 0, passPercent: PASS_PERCENT }
  const percents = rows.map((r) => r.percent)
  return {
    count: rows.length,
    average: round2(percents.reduce((a, b) => a + b, 0) / rows.length),
    highest: Math.max(...percents),
    lowest: Math.min(...percents),
    passRate: round2((rows.filter((r) => r.passed).length / rows.length) * 100),
    passPercent: PASS_PERCENT,
  }
}

function distribution(rows) {
  const bins = Array.from({ length: 10 }, (_, i) => ({ range: i === 9 ? '90-100' : `${i * 10}-${i * 10 + 9}`, count: 0 }))
  for (const row of rows) bins[Math.min(9, Math.floor(row.percent / 10))].count += 1
  return bins
}

// GET /api/exams/:id/results
//   -> { state: NOT_READY | UNGRADED | GRADED | PUBLISHED, publishedAt, provisional, pendingAnswers,
//        summary: { count, average, highest, lowest, passRate, passPercent },       (percentages)
//        distribution: [{ range: "0-9", count }],                                    (10 bins of percent)
//        rows: [{ attemptId, candidate, total, max, percent, grade, passed, pending, version, submittedAt, incidentCount, compensationMinutes }] }
// Sandbox attempts are never included. Before publishing, `provisional` is true and written answers still being marked count as pending.
export async function getResults(examId) {
  const exam = ownedExam(examId)
  await delay()
  const state = resultsState(exam, examStatus(exam))
  const rows = state === 'NOT_READY' ? [] : resultRows(exam)
  return clone({
    state,
    publishedAt: publishedAt.get(examId) ?? null,
    provisional: state !== 'PUBLISHED',
    pendingAnswers: rows.reduce((sum, r) => sum + r.pending, 0),
    summary: summarize(rows),
    distribution: distribution(rows),
    rows,
  })
}

const shortText = (text) => (text.length > 70 ? `${text.slice(0, 67)}...` : text)

// GET /api/exams/:id/analytics/questions
//   -> { questions: [{ questionId, label: "Q3", text, type, declaredDifficulty, observedDifficulty, attempts, skipped,
//        skippedRate, wrongRate, correctRate }] }          (rates are percentages 0-100, based on submitted real attempts)
// observedDifficulty: correctRate >= 70 -> easy, >= 40 -> medium, else hard.
export async function getQuestionAnalytics(examId) {
  const exam = ownedExam(examId)
  await delay()
  const attempts = submitted(examId)
  const questionsOut = assignedFor(examId).map((item, index) => {
    const question = questionById(item.questionId)
    let count = 0
    let skipped = 0
    let correct = 0
    let wrong = 0
    for (const attempt of attempts) {
      if (!attempt.paper.some((p) => p.questionId === item.questionId)) continue
      count += 1
      const answer = attempt.answers[item.questionId]
      const isBlank = question.type === 'WRITTEN' ? !answer?.text?.trim() : !answer?.selected?.length
      if (isBlank) {
        skipped += 1
        continue
      }
      const { perQuestion } = questionMarks(attempt, exam)
      const marks = attempt.versions.at(-1)?.perQuestion[item.questionId] ?? perQuestion[item.questionId]
      if (marks === undefined) continue // written answer not graded yet
      if (marks >= item.marks * 0.6) correct += 1
      else wrong += 1
    }
    const answered = correct + wrong
    const correctRate = answered ? round2((correct / answered) * 100) : 0
    return {
      questionId: item.questionId,
      label: `Q${index + 1}`,
      text: shortText(question.text),
      type: question.type,
      declaredDifficulty: question.difficulty,
      observedDifficulty: correctRate >= 70 ? 'easy' : correctRate >= 40 ? 'medium' : 'hard',
      attempts: count,
      skipped,
      skippedRate: count ? round2((skipped / count) * 100) : 0,
      wrongRate: answered ? round2((wrong / answered) * 100) : 0,
      correctRate,
    }
  })
  return clone({ questions: questionsOut.filter((q) => q.attempts > 0) })
}

// GET /api/exams/:id/analytics/fairness
//   -> { method, note, variantGroups, papers: [{ attemptId, candidate, difficultyScore, easy, medium, hard, questions }],
//        mean, variance, spread, tolerance, withinTolerance }
// difficultyScore = marks-weighted mean of question difficulty (easy 1, medium 2, hard 3), so 1.00-3.00.
export async function getFairness(examId) {
  ownedExam(examId)
  await delay()
  const items = assignedFor(examId)
  const attempts = realAttempts(examId)
  const papers = attempts.map((attempt) => {
    let weighted = 0
    let marks = 0
    const counts = { easy: 0, medium: 0, hard: 0 }
    for (const entry of attempt.paper) {
      const difficulty = questionById(entry.questionId).difficulty
      weighted += DIFFICULTY_WEIGHT[difficulty] * entry.marks
      marks += entry.marks
      counts[difficulty] += 1
    }
    return { attemptId: attempt.id, candidate: person(attempt.candidateId), difficultyScore: marks ? round2(weighted / marks) : 0, ...counts, questions: attempt.paper.length }
  })
  const scores = papers.map((p) => p.difficultyScore)
  const mean = scores.length ? round2(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
  const variance = scores.length ? Math.round((scores.reduce((a, s) => a + (s - mean) ** 2, 0) / scores.length) * 10000) / 10000 : 0
  const spread = scores.length ? round2(Math.max(...scores) - Math.min(...scores)) : 0
  const groups = [...new Set(items.filter((i) => i.group).map((i) => i.group))]
  const tolerance = 0.25
  let note
  if (papers.length === 0) note = 'No papers have been issued yet. Fairness is calculated from the papers candidates actually received.'
  else if (groups.length === 0) note = 'Every candidate received the same questions, so papers differ only in order. The difficulty score is identical for everyone.'
  else {
    const hardest = papers.reduce((a, b) => (b.difficultyScore > a.difficultyScore ? b : a))
    note =
      spread === 0
        ? `Variants in groups ${groups.join(' and ')} were rotated so every candidate received the same mix of easy, medium and hard questions.`
        : `Variants in groups ${groups.join(' and ')} were rotated so most candidates received the same difficulty mix. With ${papers.length} candidates the rotation cannot split evenly, so ${hardest.candidate.name}'s paper is ${spread.toFixed(2)} harder than the easiest. That is ${spread <= tolerance ? 'inside' : 'outside'} the allowed tolerance of ${tolerance.toFixed(2)}.`
  }
  return clone({
    method: 'Questions in the same variant group are interchangeable. Each candidate receives one per group, assigned in rotation by declared difficulty so no group favours anyone.',
    note,
    variantGroups: groups,
    papers: papers.sort((a, b) => b.difficultyScore - a.difficultyScore),
    mean,
    variance,
    spread,
    tolerance,
    withinTolerance: spread <= tolerance,
  })
}

// --- exports & reports ------------------------------------------------------------

function blobResult(blob, filename) {
  return { blob, filename }
}

const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// GET /api/exams/:id/results/export?format=csv|pdf   -> file download (Content-Disposition carries the filename)
export async function exportResults(examId, format) {
  const exam = ownedExam(examId)
  await delay(500, 900)
  const state = resultsState(exam, examStatus(exam))
  if (state === 'NOT_READY') fail(409, 'RESULTS_NOT_READY', 'Results can be exported once the exam has finished.')
  const rows = resultRows(exam)
  const name = `${slug(exam.title)}-results`
  if (format === 'csv') {
    return blobResult(
      makeCsv([
        ['Candidate', 'Email', 'Score', 'Out of', 'Percent', 'Grade', 'Result', 'Score version', 'Pending written answers'],
        ...rows.map((r) => [r.candidate.name, r.candidate.email, r.total, r.max, r.percent, r.grade, r.passed ? 'Pass' : 'Fail', r.version ?? 'provisional', r.pending]),
      ]),
      `${name}.csv`,
    )
  }
  const summary = summarize(rows)
  return blobResult(
    makePdf([
      { text: 'COMSATS University Lahore', size: 10 },
      { text: exam.title, size: 18, bold: true },
      { text: `Results ${state === 'PUBLISHED' ? '(published)' : '(provisional)'}`, size: 11 },
      { text: `Candidates ${summary.count}  |  Average ${summary.average}%  |  Highest ${summary.highest}%  |  Lowest ${summary.lowest}%  |  Pass rate ${summary.passRate}%`, size: 10 },
      { text: ' ' },
      ...rows.map((r) => ({ text: `${r.candidate.name} - ${r.total} / ${r.max} (${r.percent}%) - grade ${r.grade} - ${r.passed ? 'pass' : 'fail'}${r.pending ? ' - marking pending' : ''}` })),
    ]),
    `${name}.pdf`,
  )
}

function examReportData(exam) {
  const state = resultsState(exam, examStatus(exam))
  const rows = state === 'NOT_READY' ? [] : resultRows(exam)
  const id = verificationId(exam.id, 'exam')
  return {
    verificationId: id,
    verifyUrl: `${window.location.origin}/verify/${id}`,
    generatedAt: new Date(serverNow()).toISOString(),
    state,
    exam: { id: exam.id, title: exam.title, startAt: exam.startAt, endAt: exam.endAt, totalMarks: exam.totalMarks },
    summary: summarize(rows),
    rows,
  }
}

// GET /api/exams/:id/report
//   -> { verificationId, verifyUrl, generatedAt, state, exam: { id, title, startAt, endAt, totalMarks }, summary, rows }
// The report preview panel shows the verification ID and a QR code that encodes `verifyUrl`.
export async function getExamReportPreview(examId) {
  const exam = ownedExam(examId)
  await delay()
  return clone(examReportData(exam))
}

// GET /api/exams/:id/report.pdf   -> application/pdf
export async function downloadExamReport(examId) {
  const exam = ownedExam(examId)
  await delay(700, 1200)
  const data = examReportData(exam)
  if (data.state === 'NOT_READY') fail(409, 'RESULTS_NOT_READY', 'The report can be created once the exam has finished.')
  return blobResult(
    makePdf([
      { text: 'COMSATS University Lahore - Secure Examination Management System', size: 9 },
      { text: `${exam.title} - exam report`, size: 18, bold: true },
      { text: `Window: ${formatDateTime(exam.startAt)} to ${formatDateTime(exam.endAt)}` },
      { text: `Candidates ${data.summary.count}  |  Average ${data.summary.average}%  |  Pass rate ${data.summary.passRate}%` },
      { text: `Results status: ${data.state}` },
      { text: ' ' },
      ...data.rows.map((r) => ({ text: `${r.candidate.name}: ${r.total}/${r.max} (${r.percent}%) grade ${r.grade}` })),
      { text: ' ' },
      { text: `Verification ID: ${data.verificationId}`, bold: true },
      { text: `Verify at ${data.verifyUrl}`, size: 9 },
    ]),
    `${slug(exam.title)}-report.pdf`,
  )
}

// --- candidate-facing result ---------------------------------------------------------

function candidateAttempt(examId) {
  const me = requireRole('CANDIDATE')
  const exam = exams.find((e) => e.id === examId)
  if (!exam || !exam.published || !enrollments.get(examId)?.has(me.id)) fail(404, 'NOT_FOUND', "We couldn't find that exam in your list.")
  const attempt = submitted(examId).find((a) => a.candidateId === me.id)
  return { me, exam, attempt }
}

export function disputeWindow(examId) {
  const at = publishedAt.get(examId)
  if (!at) return null
  const closesAt = new Date(new Date(at).getTime() + DISPUTE_WINDOW_DAYS * DAY).toISOString()
  return { opensAt: at, closesAt, isOpen: serverNow() < new Date(closesAt).getTime() }
}

export function disputeDto(d) {
  const exam = exams.find((e) => e.id === d.examId)
  const q = d.questionId ? questionById(d.questionId) : null
  const attemptRows = realAttempts(d.examId)
  const attempt = attemptRows.find((a) => a.id === d.attemptId)
  const number = q && attempt ? attempt.paper.findIndex((p) => p.questionId === q.id) + 1 : null
  return {
    id: d.id,
    examId: d.examId,
    examTitle: exam?.title,
    attemptId: d.attemptId,
    candidate: person(d.candidateId),
    category: d.category,
    question: q ? { id: q.id, number: number || null, text: shortText(q.text) } : null,
    explanation: d.explanation,
    status: d.status,
    outcome: d.outcome,
    resolutionReason: d.resolutionReason,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    resolvedAt: d.resolvedAt,
    resolvedBy: d.resolvedById ? person(d.resolvedById).name : null,
  }
}

// GET /api/candidate/exams/:id/result
//   -> { exam, publishedAt, verificationId, score: { total, max, percent, grade, passed, version, revised },
//        questions: [{ id, number, type, text, marks, max, status: correct | partial | incorrect | skipped, feedback }],
//        compensationMinutes, disputeWindow: { opensAt, closesAt, isOpen }, disputes: [Dispute] }
// 403 RESULTS_NOT_PUBLISHED until the examiner publishes results.
export async function getCandidateResult(examId) {
  await delay()
  const { exam, attempt } = candidateAttempt(examId)
  if (!publishedAt.has(examId)) fail(403, 'RESULTS_NOT_PUBLISHED', "Results for this exam haven't been published yet.")
  if (!attempt) fail(404, 'NOT_FOUND', 'You have no submitted attempt for this exam.')
  const score = currentScore(attempt)
  const max = maxMarks(attempt)
  const percent = max ? round2((score.total / max) * 100) : 0
  const id = verificationId(examId, attempt.candidateId)
  return clone({
    exam: { id: exam.id, title: exam.title, startAt: exam.startAt, endAt: exam.endAt, totalMarks: exam.totalMarks },
    publishedAt: publishedAt.get(examId),
    verificationId: id,
    verifyUrl: `${window.location.origin}/verify/${id}`,
    score: { total: score.total, max, percent, grade: gradeLetter(percent), passed: percent >= PASS_PERCENT, version: score.version, revised: score.version > 1 },
    questions: attempt.paper.map((entry, i) => {
      const q = questionById(entry.questionId)
      const awarded = score.perQuestion[entry.questionId] ?? 0
      const answer = attempt.answers[entry.questionId]
      const blank = q.type === 'WRITTEN' ? !answer?.text?.trim() : !answer?.selected?.length
      return {
        id: q.id,
        number: i + 1,
        type: q.type,
        text: q.text,
        marks: awarded,
        max: entry.marks,
        status: blank ? 'skipped' : awarded >= entry.marks ? 'correct' : awarded > 0 ? 'partial' : 'incorrect',
        feedback: attempt.written[q.id]?.feedback ?? '',
      }
    }),
    compensationMinutes: attempt.compensations.reduce((s, c) => s + c.minutes, 0),
    disputeWindow: disputeWindow(examId),
    disputes: disputes.filter((d) => d.examId === examId && d.candidateId === attempt.candidateId).map(disputeDto),
  })
}

// GET /api/candidate/exams/:id/report   (same shape as the exam report preview, for the candidate's own result)
export async function getCandidateReportPreview(examId) {
  await delay()
  const { exam, attempt } = candidateAttempt(examId)
  if (!publishedAt.has(examId) || !attempt) fail(403, 'RESULTS_NOT_PUBLISHED', "Results for this exam haven't been published yet.")
  const score = currentScore(attempt)
  const max = maxMarks(attempt)
  const percent = max ? round2((score.total / max) * 100) : 0
  const id = verificationId(examId, attempt.candidateId)
  return clone({
    verificationId: id,
    verifyUrl: `${window.location.origin}/verify/${id}`,
    generatedAt: new Date(serverNow()).toISOString(),
    exam: { id: exam.id, title: exam.title, startAt: exam.startAt, endAt: exam.endAt, totalMarks: exam.totalMarks },
    candidate: person(attempt.candidateId),
    score: { total: score.total, max, percent, grade: gradeLetter(percent), passed: percent >= PASS_PERCENT, version: score.version },
  })
}

// GET /api/candidate/exams/:id/report.pdf -> application/pdf
export async function downloadCandidateReport(examId) {
  const preview = await getCandidateReportPreview(examId)
  await delay(600, 1000)
  return blobResult(
    makePdf([
      { text: 'COMSATS University Lahore - Secure Examination Management System', size: 9 },
      { text: `${preview.exam.title} - result report`, size: 18, bold: true },
      { text: `Candidate: ${preview.candidate.name}` },
      { text: `Score: ${preview.score.total} / ${preview.score.max} (${preview.score.percent}%)  Grade ${preview.score.grade}  ${preview.score.passed ? 'Pass' : 'Fail'}` },
      { text: `Score version: v${preview.score.version}` },
      { text: ' ' },
      { text: `Verification ID: ${preview.verificationId}`, bold: true },
      { text: `Verify at ${preview.verifyUrl}`, size: 9 },
    ]),
    `${slug(preview.exam.title)}-result.pdf`,
  )
}
