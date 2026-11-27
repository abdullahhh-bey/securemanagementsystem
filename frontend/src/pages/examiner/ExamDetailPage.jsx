import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Activity, BarChart3, FileText, HelpCircle, Pencil, Send, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorState } from '@/components/ErrorState'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { ExamLifecycle } from '@/components/exam/ExamLifecycle'
import { useDeleteExam, useExam } from '@/hooks/useExams'
import { formatWindow } from '@/lib/format'
import { ComingNextTab } from './tabs/ComingNextTab'
import { CandidatesTab } from './tabs/CandidatesTab'
import { DetailsTab } from './tabs/DetailsTab'

const TABS = [
  { value: 'details', label: 'Details', icon: FileText },
  { value: 'candidates', label: 'Candidates', icon: Users },
  { value: 'questions', label: 'Questions', icon: HelpCircle },
  { value: 'monitor', label: 'Monitor', icon: Activity },
  { value: 'results', label: 'Results', icon: BarChart3 },
]

const COMING_NEXT = {
  questions: {
    icon: HelpCircle,
    title: 'The question builder is coming next',
    description: 'Soon you will write multiple-choice questions, attach marks and reorder them right here.',
  },
  monitor: {
    icon: Activity,
    title: 'Live monitoring is coming next',
    description: 'When an exam is running you will see who has joined, progress and connection status in real time.',
  },
  results: {
    icon: BarChart3,
    title: 'Results are coming next',
    description: 'Scores, grade distribution and per-question analysis will appear here once an exam has finished.',
  },
}

function DetailSkeleton() {
  return (
    <div className="space-y-6" role="status">
      <span className="sr-only">Loading exam</span>
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  )
}

export default function ExamDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: exam, isPending, error, refetch, isRefetching } = useExam(id)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const deleteExam = useDeleteExam({ onSuccess: () => navigate('/examiner/exams', { replace: true }) })

  const requested = searchParams.get('tab')
  const tab = TABS.some((t) => t.value === requested) ? requested : 'details'

  const back = { to: '/examiner/exams', label: 'My exams' }

  if (error) {
    return (
      <>
        <PageHeader title="Exam" back={back} />
        <ErrorState error={error} onRetry={refetch} isRetrying={isRefetching} title="We couldn't load this exam" />
      </>
    )
  }
  if (isPending) {
    return (
      <>
        <PageHeader title="Loading exam" back={back} />
        <DetailSkeleton />
      </>
    )
  }

  const isDraft = exam.status === 'DRAFT'

  return (
    <>
      <PageHeader
        title={exam.title}
        back={back}
        meta={
          <>
            <StatusBadge status={exam.status} />
            <span className="num text-sm text-muted">{formatWindow(exam.startAt, exam.endAt)}</span>
          </>
        }
        actions={
          <>
            {isDraft ? (
              <>
                <Button asChild variant="secondary">
                  <Link to={`/examiner/exams/${exam.id}/edit`}>
                    <Pencil /> Edit
                  </Link>
                </Button>
                <Button asChild>
                  <Link to={`/examiner/exams/${exam.id}/review`}>
                    <Send /> Review and publish
                  </Link>
                </Button>
                <Button variant="danger-outline" size="icon" onClick={() => setDeleteOpen(true)} aria-label="Delete draft exam">
                  <Trash2 />
                </Button>
              </>
            ) : (
              <Button variant="secondary" disabledReason="Only draft exams can be edited.">
                <Pencil /> Edit
              </Button>
            )}
          </>
        }
      />

      <Card className="mb-6">
        <CardContent className="py-6">
          <ExamLifecycle status={exam.status} />
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(value) => setSearchParams(value === 'details' ? {} : { tab: value }, { replace: true })}>
        <TabsList aria-label="Exam sections">
          {TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value}>
              <Icon aria-hidden="true" />
              {label}
              {value === 'candidates' && <span className="num rounded bg-sunken px-1.5 text-xs">{exam.candidateCount}</span>}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="details">
          <DetailsTab exam={exam} />
        </TabsContent>
        <TabsContent value="candidates">
          <CandidatesTab exam={exam} />
        </TabsContent>
        {Object.entries(COMING_NEXT).map(([value, content]) => (
          <TabsContent key={value} value={value}>
            <ComingNextTab {...content} />
          </TabsContent>
        ))}
      </Tabs>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this draft?"
        description={`"${exam.title}" and its enrolled candidates will be removed permanently. This can't be undone.`}
        confirmLabel="Delete draft"
        tone="danger"
        isPending={deleteExam.isPending}
        onConfirm={() => deleteExam.mutate(exam.id, { onError: () => setDeleteOpen(false) })}
      />
    </>
  )
}
