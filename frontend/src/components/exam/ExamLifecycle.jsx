import { CircleCheck, CircleDashed, CirclePlay, Send } from 'lucide-react'
import { Stepper } from '@/components/Stepper'
import { LIFECYCLE_STEPS } from '@/lib/constants'

const STEPS = [
  { key: 'DRAFT', label: 'Draft', icon: CircleDashed },
  { key: 'PUBLISHED', label: 'Published', icon: Send },
  { key: 'ONGOING', label: 'Ongoing', icon: CirclePlay },
  { key: 'COMPLETED', label: 'Completed', icon: CircleCheck },
]

/** Draft -> Published -> Ongoing -> Completed, driven by the server-provided status. */
export function ExamLifecycle({ status }) {
  const index = LIFECYCLE_STEPS.indexOf(status)
  return <Stepper label="Exam lifecycle" steps={STEPS} current={Math.max(index, 0)} complete={status === 'COMPLETED'} />
}
