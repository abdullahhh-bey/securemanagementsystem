import { ClipboardList, LayoutDashboard } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { NAVY_THEME } from './themes'

const NAV = [
  { to: '/examiner', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/examiner/exams', label: 'My Exams', icon: ClipboardList },
]

export default function ExaminerLayout() {
  return <AppShell nav={NAV} areaLabel="Examiner workspace" theme={NAVY_THEME} />
}
