import { useOutletContext } from 'react-router-dom'
import { CandidatesTab } from './tabs/CandidatesTab'
import { DetailsTab } from './tabs/DetailsTab'
import { QuestionsTab } from './tabs/QuestionsTab'
import { MonitorTab } from './tabs/MonitorTab'
import { GradingTab } from './tabs/GradingTab'
import { ResultsTab } from './tabs/ResultsTab'
import { DisputesTab } from './tabs/DisputesTab'

function useExamContext() {
  const ctx = useOutletContext()
  if (!ctx?.exam) throw new Error('Exam section rendered outside ExamShell')
  return ctx.exam
}

export function ExamDetailsSection() {
  return <DetailsTab exam={useExamContext()} />
}

export function ExamCandidatesSection() {
  return <CandidatesTab exam={useExamContext()} />
}

export function ExamQuestionsSection() {
  return <QuestionsTab exam={useExamContext()} />
}

export function ExamMonitorLiveSection() {
  return <MonitorTab exam={useExamContext()} view="live" />
}

export function ExamMonitorAnnouncementsSection() {
  return <MonitorTab exam={useExamContext()} view="announcements" />
}

export function ExamMonitorDisruptionsSection() {
  return <MonitorTab exam={useExamContext()} view="disruptions" />
}

export function ExamGradingSection() {
  return <GradingTab exam={useExamContext()} />
}

export function ExamResultsScoresSection() {
  return <ResultsTab exam={useExamContext()} view="scores" />
}

export function ExamDisputesSection() {
  return <DisputesTab exam={useExamContext()} />
}
