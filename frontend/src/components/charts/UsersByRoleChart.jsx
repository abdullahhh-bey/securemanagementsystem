import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ROLE_META } from '@/lib/constants'

const INK = '#14213D'
const MUTED = '#5B6475'

/**
 * Stacked bars: active vs inactive accounts per role. Inactive uses a hatch
 * pattern so the two series differ by texture as well as colour.
 */
export default function UsersByRoleChart({ users }) {
  const data = ['ADMIN', 'EXAMINER', 'CANDIDATE'].map((role) => ({
    role: `${ROLE_META[role].label}s`,
    Active: users.filter((u) => u.role === role && u.isActive).length,
    Inactive: users.filter((u) => u.role === role && !u.isActive).length,
  }))

  return (
    <figure>
      <div className="h-72 w-full" role="img" aria-label={`Accounts per role. ${data.map((d) => `${d.role}: ${d.Active} active, ${d.Inactive} inactive`).join('. ')}.`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barCategoryGap="32%">
            <defs>
              <pattern id="hatch-inactive" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill="#EFECE4" />
                <rect width="2.5" height="6" fill="#8A91A0" />
              </pattern>
            </defs>
            <CartesianGrid vertical={false} stroke="#E5E1D8" />
            <XAxis dataKey="role" tickLine={false} axisLine={{ stroke: '#E5E1D8' }} tick={{ fill: INK, fontSize: 13, fontWeight: 500 }} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: MUTED, fontSize: 12 }} />
            <Tooltip
              cursor={{ fill: 'rgba(15,118,110,0.06)' }}
              contentStyle={{ border: '1px solid #E5E1D8', borderRadius: 8, boxShadow: 'none', fontSize: 13 }}
            />
            <Legend iconType="square" wrapperStyle={{ fontSize: 13, color: INK, paddingTop: 8 }} />
            <Bar dataKey="Active" stackId="a" fill="#0F766E" maxBarSize={72} isAnimationActive={false} />
            <Bar dataKey="Inactive" stackId="a" fill="url(#hatch-inactive)" stroke="#8A91A0" maxBarSize={72} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">Number of active and inactive accounts for each role.</figcaption>
    </figure>
  )
}
