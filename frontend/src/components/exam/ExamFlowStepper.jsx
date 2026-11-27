import { ClipboardCheck, FilePenLine } from 'lucide-react'
import { Stepper } from '@/components/Stepper'

const STEPS = [
  { key: 'details', label: 'Exam details', icon: FilePenLine },
  { key: 'review', label: 'Review & publish', icon: ClipboardCheck },
]

/** The two-step create flow: fill in details, then review and publish. */
export function ExamFlowStepper({ current }) {
  return <Stepper label="Exam setup steps" steps={STEPS} current={current} className="mb-8 max-w-sm" />
}
