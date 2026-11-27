import { BookOpenCheck, GraduationCap, LayoutDashboard, PencilLine, ScrollText, Users } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { NAVY_THEME } from './themes'

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  {
    to: '/admin/teachers',
    label: 'Users',
    icon: Users,
    children: [
      { to: '/admin/teachers', label: 'Teachers', icon: PencilLine },
      { to: '/admin/students', label: 'Students', icon: GraduationCap },
    ],
  },
  { to: '/admin/exams', label: 'Exams', icon: BookOpenCheck },
  { to: '/admin/audit', label: 'Audit log', icon: ScrollText },
]

export default function AdminLayout() {
  return <AppShell nav={NAV} areaLabel="Admin" theme={NAVY_THEME} />
}
