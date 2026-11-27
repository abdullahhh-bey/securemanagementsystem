import { BookOpenCheck } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { CANDIDATE_THEME } from './themes'

const NAV = [{ to: '/candidate', label: 'My Exams', icon: BookOpenCheck }]

export default function CandidateLayout() {
  return <AppShell nav={NAV} areaLabel="Candidate portal" theme={CANDIDATE_THEME} />
}
