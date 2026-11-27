import { Bell, BookOpenCheck, Gavel, GraduationCap, LayoutDashboard, Medal } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { CANDIDATE_THEME } from './themes'

const NAV = [
  { to: '/candidate', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/candidate/exams', label: 'Exams', icon: BookOpenCheck },
  { to: '/candidate/results', label: 'Results', icon: Medal },
  { to: '/candidate/disputes', label: 'Disputes', icon: Gavel },
  { to: '/candidate/announcements', label: 'Announcements', icon: Bell },
]

export default function CandidateLayout() {
  return <AppShell nav={NAV} areaLabel="Student portal" theme={CANDIDATE_THEME} changePasswordTo="/candidate/account/password" />
}
