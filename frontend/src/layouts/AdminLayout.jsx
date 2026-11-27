import { BookOpenCheck, LayoutDashboard, ScrollText, Users } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { NAVY_THEME } from './themes'

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/exams', label: 'Exams', icon: BookOpenCheck },
  { to: '/admin/audit', label: 'Audit log', icon: ScrollText },
]

export default function AdminLayout() {
  return <AppShell nav={NAV} areaLabel="Administration" theme={NAVY_THEME} />
}
