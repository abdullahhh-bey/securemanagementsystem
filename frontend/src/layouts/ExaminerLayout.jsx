import { ClipboardList, LayoutDashboard, Plus, Users } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { NAVY_THEME } from './themes'

const NAV = [
  { to: '/examiner', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/examiner/students', label: 'Students', icon: Users },
  { to: '/examiner/exams', label: 'Exams', icon: ClipboardList },
  { to: '/examiner/exams/new', label: 'Create exam', icon: Plus, end: true },
]

export default function ExaminerLayout() {
  return <AppShell nav={NAV} areaLabel="Teacher" theme={NAVY_THEME} />
}
