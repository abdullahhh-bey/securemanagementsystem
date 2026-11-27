import { Navigate, useParams, useSearchParams } from 'react-router-dom'

/** Legacy `?tab=` URLs redirect to nested exam section routes. */
export default function ExamDetailPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const tab = params.get('tab')
  if (!tab || tab === 'details') return <Navigate to={`/examiner/exams/${id}`} replace />
  return <Navigate to={`/examiner/exams/${id}/${tab}`} replace />
}
