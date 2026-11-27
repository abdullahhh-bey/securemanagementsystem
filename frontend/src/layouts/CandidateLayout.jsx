import { useEffect } from 'react'
import { Bell, BookOpenCheck, Gavel, LayoutDashboard, Medal, Settings2 } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { useCandidatePreferences } from '@/hooks/useStudentPortal'
import { CANDIDATE_THEME } from './themes'

const NAV = [
  { to: '/candidate', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/candidate/exams', label: 'Exams', icon: BookOpenCheck },
  { to: '/candidate/results', label: 'Results', icon: Medal },
  { to: '/candidate/disputes', label: 'Disputes', icon: Gavel },
  { to: '/candidate/announcements', label: 'Announcements', icon: Bell },
  { to: '/candidate/preferences', label: 'Preferences', icon: Settings2 },
]

export default function CandidateLayout() {
  const preferencesQuery = useCandidatePreferences()

  useEffect(() => {
    const preferences = preferencesQuery.data
    if (!preferences) return undefined

    document.documentElement.dataset.candidateTextSize = preferences.textSize
    document.documentElement.dataset.candidateContrast = preferences.contrast
    document.documentElement.dataset.candidateLineSpacing = preferences.lineSpacing
    return () => {
      delete document.documentElement.dataset.candidateTextSize
      delete document.documentElement.dataset.candidateContrast
      delete document.documentElement.dataset.candidateLineSpacing
    }
  }, [preferencesQuery.data])

  return <AppShell nav={NAV} areaLabel="Student portal" theme={CANDIDATE_THEME} />
}
