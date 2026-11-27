import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const INK = 'var(--ink)'
const MUTED = 'var(--muted)'
const SANS = 'var(--font-sans)'
const MONO = 'var(--font-mono)'
const TOOLTIP_STYLE = { border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'none', fontFamily: SANS, fontSize: 14 }
const TOOLTIP_LABEL_STYLE = { fontFamily: SANS, fontWeight: 400 }
const TOOLTIP_ITEM_STYLE = { fontFamily: MONO, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }
const GRID = { vertical: false, stroke: 'var(--border)' }

const DIFFICULTY_SCORE = { easy: 1, medium: 2, hard: 3 }
export function ScoreDistributionChart({ distribution }) {
  return (
    <figure>
      <div className="h-64 w-full" role="img" aria-label={`Score distribution. ${distribution.map((d) => `${d.range}%: ${d.count}`).join(', ')}.`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={distribution} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="range" tickLine={false} axisLine={{ stroke: 'var(--border)' }} tick={{ fill: INK, fontFamily: SANS, fontSize: 13, fontWeight: 500 }} label={{ value: 'Score %', position: 'insideBottom', offset: -2, fill: MUTED, fontFamily: SANS, fontSize: 12, fontWeight: 500 }} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: MUTED, fontFamily: MONO, fontSize: 13, fontWeight: 500 }} label={{ value: 'Candidates', angle: -90, position: 'insideLeft', fill: MUTED, fontFamily: SANS, fontSize: 12, fontWeight: 500 }} />
            <Tooltip cursor={{ fill: 'var(--chart-cursor)' }} contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
            <Bar dataKey="count" name="Candidates" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">Histogram of candidate scores in ten percent bands.</figcaption>
    </figure>
  )
}

function topHorizontalBarChart(data, dataKey, name, fill, ariaLabel) {
  return (
    <figure>
      <div className="h-64 w-full" role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
            <CartesianGrid horizontal={false} stroke="var(--border)" />
            <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={{ stroke: 'var(--border)' }} tick={{ fill: MUTED, fontFamily: MONO, fontSize: 13, fontWeight: 500 }} unit="%" />
            <YAxis type="category" dataKey="label" width={44} tickLine={false} axisLine={false} tick={{ fill: INK, fontFamily: SANS, fontSize: 13, fontWeight: 500 }} />
            <Tooltip cursor={{ fill: 'var(--chart-cursor)' }} contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} formatter={(v) => [`${v}%`, name]} />
            <Bar dataKey={dataKey} name={name} fill={fill} radius={[0, 4, 4, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}

export function SkippedQuestionsChart({ questions }) {
  const data = [...questions].sort((a, b) => b.skippedRate - a.skippedRate).slice(0, 6)
  return topHorizontalBarChart(data, 'skippedRate', 'Skipped', 'var(--warning)', `Most skipped questions. ${data.map((q) => `${q.label}: ${q.skippedRate}%`).join('. ')}.`)
}

export function WrongQuestionsChart({ questions }) {
  const data = [...questions].sort((a, b) => b.wrongRate - a.wrongRate).slice(0, 6)
  return topHorizontalBarChart(data, 'wrongRate', 'Wrong', 'var(--danger)', `Most commonly wrong questions. ${data.map((q) => `${q.label}: ${q.wrongRate}%`).join('. ')}.`)
}

export function DifficultyMismatchChart({ questions }) {
  const data = questions.map((q) => ({
    label: q.label,
    declared: DIFFICULTY_SCORE[q.declaredDifficulty] ?? 2,
    observed: DIFFICULTY_SCORE[q.observedDifficulty] ?? 2,
    mismatch: q.declaredDifficulty !== q.observedDifficulty,
  }))

  return (
    <figure>
      <div className="h-72 w-full" role="img" aria-label="Declared vs observed difficulty per question.">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--border)' }} tick={{ fill: INK, fontFamily: SANS, fontSize: 13, fontWeight: 500 }} />
            <YAxis domain={[0, 3.5]} ticks={[1, 2, 3]} tickFormatter={(v) => ({ 1: 'Easy', 2: 'Medium', 3: 'Hard' })[v] ?? ''} tickLine={false} axisLine={false} tick={{ fill: MUTED, fontFamily: SANS, fontSize: 13, fontWeight: 500 }} />
            <Tooltip
              cursor={{ fill: 'var(--chart-cursor)' }}
              contentStyle={TOOLTIP_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
              itemStyle={TOOLTIP_ITEM_STYLE}
              formatter={(v, key) => [{ 1: 'Easy', 2: 'Medium', 3: 'Hard' }[v] ?? v, key === 'declared' ? 'Declared' : 'Observed']}
            />
            <Legend iconType="square" wrapperStyle={{ fontFamily: SANS, fontSize: 14, fontWeight: 500, color: INK, paddingTop: 8 }} />
            <Bar dataKey="declared" name="Declared" fill="var(--info)" radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false} />
            <Bar dataKey="observed" name="Observed" radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false}>
              {data.map((entry) => (
                <Cell key={entry.label} fill={entry.mismatch ? 'var(--danger)' : 'var(--success)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">Side-by-side declared and observed difficulty for each question; red bars mark mismatches.</figcaption>
    </figure>
  )
}