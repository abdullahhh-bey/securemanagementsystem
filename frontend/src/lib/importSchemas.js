const ROLES = ['ADMIN', 'EXAMINER', 'CANDIDATE']
const TYPES = ['MCQ_SINGLE', 'MCQ_MULTI', 'WRITTEN']
const DIFFICULTIES = ['easy', 'medium', 'hard']
const RULES = ['ALL_OR_NOTHING', 'PARTIAL']

const pick = (values, ...keys) => {
  for (const key of keys) {
    const value = values[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim()
  }
  return ''
}

const parseBool = (text) => /^(1|true|yes|y)$/i.test(String(text ?? '').trim())

function normalizeType(raw) {
  const typeRaw = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_')
  if (typeRaw === 'SINGLE' || typeRaw === 'MCQSINGLE') return 'MCQ_SINGLE'
  if (typeRaw === 'MULTI' || typeRaw === 'MCQMULTI' || typeRaw === 'MULTIPLE') return 'MCQ_MULTI'
  if (typeRaw === 'WRITTEN' || typeRaw === 'ESSAY' || typeRaw === 'TEXT') return 'WRITTEN'
  return typeRaw
}

function parseOptionTexts(values) {
  const listed = pick(values, 'options', 'choices', 'answers')
  if (listed) {
    if (listed.startsWith('[')) {
      try {
        const parsed = JSON.parse(listed)
        if (Array.isArray(parsed)) {
          return parsed
            .map((entry) => (typeof entry === 'string' ? entry : String(entry?.text ?? '').trim()))
            .filter(Boolean)
        }
      } catch {
        /* fall through */
      }
    }
    return listed
      .split(/[|]/)
      .map((part) => part.trim())
      .filter(Boolean)
  }
  const fromColumns = []
  for (let i = 1; i <= 12; i += 1) {
    const opt = pick(values, `option${i}`, `choice${i}`, `answer${i}`)
    if (opt) fromColumns.push(opt)
  }
  return fromColumns
}

function applyCorrect(options, values) {
  const next = options.map((text) => ({ text, isCorrect: false }))
  const correctRaw = pick(values, 'correct', 'correctanswers', 'correctindices', 'key', 'correctanswer')
  if (correctRaw) {
    for (const token of correctRaw.split(/[|,;]/).map((t) => t.trim()).filter(Boolean)) {
      const asIndex = Number(token)
      if (Number.isInteger(asIndex) && asIndex >= 1 && asIndex <= next.length) {
        next[asIndex - 1].isCorrect = true
        continue
      }
      if (/^[A-Za-z]$/.test(token)) {
        const index = token.toUpperCase().charCodeAt(0) - 65
        if (index >= 0 && index < next.length) next[index].isCorrect = true
        continue
      }
      const byText = next.findIndex((o) => o.text.toLowerCase() === token.toLowerCase())
      if (byText >= 0) next[byText].isCorrect = true
    }
  }
  Object.entries(values).forEach(([key, raw]) => {
    if (!/^correct\d*$/.test(key) && !/^iscorrect\d+$/.test(key)) return
    const match = key.match(/(\d+)/)
    const index = match ? Number(match[1]) - 1 : -1
    if (index >= 0 && index < next.length && parseBool(raw)) next[index].isCorrect = true
  })
  return next
}

/** Client-side validation that mirrors the server question rules (plain messages for import rows). */
function validateQuestionInput(input) {
  const messages = []
  const type = input.type
  if (!TYPES.includes(type)) messages.push('type must be MCQ_SINGLE, MCQ_MULTI or WRITTEN')
  if (!input.text?.trim()) messages.push('text is required')
  if (!input.topic?.trim()) messages.push('topic is required')
  if (!DIFFICULTIES.includes(input.difficulty)) messages.push('difficulty must be easy, medium or hard')
  if (!(Number(input.defaultMarks) > 0)) messages.push('marks must be more than zero')

  let options = []
  let markingRule = null
  let penalty = 0
  if (type === 'MCQ_SINGLE' || type === 'MCQ_MULTI') {
    options = (input.options ?? [])
      .map((o) => ({ text: String(o.text ?? '').trim(), isCorrect: Boolean(o.isCorrect) }))
      .filter((o) => o.text)
    const correct = options.filter((o) => o.isCorrect).length
    if (options.length < 2) messages.push('add at least two answer options')
    else if (correct === 0) messages.push('mark at least one option as correct')
    else if (type === 'MCQ_SINGLE' && correct > 1) messages.push('a single-answer question can have only one correct option')
    if (type === 'MCQ_MULTI') {
      markingRule = input.markingRule || 'ALL_OR_NOTHING'
      if (!RULES.includes(markingRule)) messages.push('markingRule must be ALL_OR_NOTHING or PARTIAL')
      if (markingRule === 'PARTIAL') {
        penalty = Number(input.penalty ?? 0)
        if (Number.isNaN(penalty) || penalty < 0 || penalty > 1) messages.push('penalty must be a fraction between 0 and 1')
      }
    }
  }
  if (messages.length) return { ok: false, messages }
  return {
    ok: true,
    value: {
      type,
      text: input.text.trim(),
      topic: input.topic.trim(),
      difficulty: input.difficulty,
      defaultMarks: Number(input.defaultMarks),
      options,
      markingRule,
      penalty,
      modelAnswer: type === 'WRITTEN' ? (input.modelAnswer ?? '').trim() : '',
    },
  }
}

export function parseQuestionRecord(record) {
  if (record.notAnObject) return { ok: false, messages: ['Each row must be an object with column values.'] }
  const { values } = record
  const type = normalizeType(pick(values, 'type', 'questiontype'))
  const texts = parseOptionTexts(values)
  const options = applyCorrect(texts, values)
  return validateQuestionInput({
    type,
    text: pick(values, 'text', 'question', 'stem', 'prompt'),
    topic: pick(values, 'topic', 'subject', 'category'),
    difficulty: pick(values, 'difficulty', 'level').toLowerCase(),
    defaultMarks: pick(values, 'defaultmarks', 'marks', 'points', 'mark'),
    options,
    markingRule: pick(values, 'markingrule', 'rule').toUpperCase().replace(/[\s-]+/g, '_') || undefined,
    penalty: pick(values, 'penalty', 'partialpenalty') || undefined,
    modelAnswer: pick(values, 'modelanswer', 'model', 'rubric', 'answerkey'),
  })
}

export function parseUserRecord(record) {
  if (record.notAnObject) return { ok: false, messages: ['Each row must be an object with column values.'] }
  const messages = []
  const name = pick(record.values, 'name', 'fullname')
  const email = pick(record.values, 'email', 'mail')
  const role = pick(record.values, 'role').toUpperCase()
  const password = pick(record.values, 'password', 'pass')
  if (!name) messages.push('name is required')
  if (!/^\S+@\S+\.\S+$/.test(email)) messages.push('email is not valid')
  if (!ROLES.includes(role)) messages.push('role must be ADMIN, EXAMINER or CANDIDATE')
  if (!password || password.length < 8) messages.push('password must be at least 8 characters')
  if (messages.length > 0) return { ok: false, messages }
  return { ok: true, value: { name, email, role, password } }
}

export function parseCandidateEnrollRecord(record) {
  if (record.notAnObject) return { ok: false, messages: ['Each row must be an object with column values.'] }
  const email = pick(record.values, 'email', 'mail').toLowerCase()
  if (!email) return { ok: false, messages: ['email is required'] }
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, messages: ['email is not valid'] }
  return { ok: true, value: { email } }
}
