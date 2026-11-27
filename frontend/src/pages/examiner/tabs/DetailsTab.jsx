import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DescriptionList } from '@/components/DescriptionList'
import { ExamSettings } from '@/components/exam/ExamSettings'
import { formatDateTime, formatDuration, formatWindow } from '@/lib/format'

export function DetailsTab({ exam }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card as="section" aria-labelledby="exam-info-heading">
        <CardHeader>
          <CardTitle id="exam-info-heading">Exam information</CardTitle>
        </CardHeader>
        <CardContent>
          <DescriptionList
            items={[
              { label: 'Instructions', value: exam.instructions, wide: true },
              { label: 'Exam window', value: formatWindow(exam.startAt, exam.endAt), mono: true, wide: true },
              { label: 'Duration', value: formatDuration(exam.durationMinutes), mono: true },
              { label: 'Total marks', value: String(exam.totalMarks), mono: true },
              { label: 'Created by', value: exam.createdBy },
              { label: 'Last updated', value: formatDateTime(exam.updatedAt), mono: true },
            ]}
          />
        </CardContent>
      </Card>
      <Card as="section" aria-labelledby="exam-settings-heading" className="self-start">
        <CardHeader>
          <CardTitle id="exam-settings-heading">Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <ExamSettings settings={exam.settings} />
        </CardContent>
      </Card>
    </div>
  )
}
