import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ServerClockProvider } from '@/providers/ServerClockProvider'
import { AuthProvider } from '@/providers/AuthProvider'
import { ToastProvider } from '@/providers/ToastProvider'
import { FullPageLoader, ProtectedRoute, PublicOnlyRoute, RootRedirect } from '@/routes/guards'
import { ROLES } from '@/lib/constants'
import LoginPage from '@/pages/auth/LoginPage'
import ForbiddenPage from '@/pages/errors/ForbiddenPage'
import NotFoundPage from '@/pages/errors/NotFoundPage'

const AdminLayout = lazy(() => import('@/layouts/AdminLayout'))
const AdminOverviewPage = lazy(() => import('@/pages/admin/AdminOverviewPage'))
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage'))
const AdminAuditPage = lazy(() => import('@/pages/admin/AdminAuditPage'))
const AdminExamsPage = lazy(() => import('@/pages/admin/AdminExamsPage'))
const ChangePasswordPage = lazy(() => import('@/pages/account/ChangePasswordPage'))
const CandidateResultPage = lazy(() => import('@/pages/candidate/CandidateResultPage'))
const ExamWorkspacePage = lazy(() => import('@/pages/examiner/ExamWorkspacePage'))
const CandidateExamPage = lazy(() => import('@/pages/candidate/CandidateExamPage'))
const CandidateExamsPage = lazy(() => import('@/pages/candidate/CandidateExamsPage'))
const CandidateLayout = lazy(() => import('@/layouts/CandidateLayout'))
const ExamShell = lazy(() => import('@/pages/examiner/ExamShell'))
const ExamFormPage = lazy(() => import('@/pages/examiner/ExamFormPage'))
const ExaminerDashboardPage = lazy(() => import('@/pages/examiner/ExaminerDashboardPage'))
const ExaminerLayout = lazy(() => import('@/layouts/ExaminerLayout'))
const ExaminerStudentsPage = lazy(() => import('@/pages/examiner/StudentsPage'))
const ExamReviewPage = lazy(() => import('@/pages/examiner/ExamReviewPage'))
const ExamsListPage = lazy(() => import('@/pages/examiner/ExamsListPage'))

const ExamDetailsSection = lazy(() => import('@/pages/examiner/examSections').then((m) => ({ default: m.ExamDetailsSection })))
const ExamCandidatesSection = lazy(() => import('@/pages/examiner/examSections').then((m) => ({ default: m.ExamCandidatesSection })))
const ExamQuestionsSection = lazy(() => import('@/pages/examiner/examSections').then((m) => ({ default: m.ExamQuestionsSection })))
const ExamMonitorLiveSection = lazy(() => import('@/pages/examiner/examSections').then((m) => ({ default: m.ExamMonitorLiveSection })))
const ExamMonitorAnnouncementsSection = lazy(() =>
  import('@/pages/examiner/examSections').then((m) => ({ default: m.ExamMonitorAnnouncementsSection })),
)
const ExamMonitorDisruptionsSection = lazy(() =>
  import('@/pages/examiner/examSections').then((m) => ({ default: m.ExamMonitorDisruptionsSection })),
)
const ExamGradingSection = lazy(() => import('@/pages/examiner/examSections').then((m) => ({ default: m.ExamGradingSection })))
const ExamResultsScoresSection = lazy(() => import('@/pages/examiner/examSections').then((m) => ({ default: m.ExamResultsScoresSection })))
const ExamResultsAnalyticsSection = lazy(() =>
  import('@/pages/examiner/examSections').then((m) => ({ default: m.ExamResultsAnalyticsSection })),
)
const ExamResultsFairnessSection = lazy(() =>
  import('@/pages/examiner/examSections').then((m) => ({ default: m.ExamResultsFairnessSection })),
)
const ExamResultsReportSection = lazy(() => import('@/pages/examiner/examSections').then((m) => ({ default: m.ExamResultsReportSection })))
const ExamDisputesSection = lazy(() => import('@/pages/examiner/examSections').then((m) => ({ default: m.ExamDisputesSection })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => failureCount < 1 && (error?.code === 'NETWORK_ERROR' || error?.status >= 500),
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ToastProvider>
          <ServerClockProvider>
            <AuthProvider>
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Suspense fallback={<FullPageLoader />}>
                  <Routes>
                    <Route path="/" element={<RootRedirect />} />
                    <Route
                      path="/login"
                      element={
                        <PublicOnlyRoute>
                          <LoginPage />
                        </PublicOnlyRoute>
                      }
                    />
                    <Route path="/403" element={<ForbiddenPage />} />

                    <Route path="/admin" element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]} />}>
                      <Route element={<AdminLayout />}>
                        <Route index element={<AdminOverviewPage />} />
                        <Route path="users" element={<Navigate to="/admin/teachers" replace />} />
                        <Route path="teachers" element={<AdminUsersPage roleFilter={ROLES.EXAMINER} />} />
                        <Route path="students" element={<AdminUsersPage roleFilter={ROLES.CANDIDATE} />} />
                        <Route path="exams" element={<AdminExamsPage />} />
                        <Route path="audit" element={<AdminAuditPage />} />
                        <Route path="account/password" element={<ChangePasswordPage />} />
                        <Route path="*" element={<Navigate to="/404" replace />} />
                      </Route>
                    </Route>

                    <Route path="/examiner" element={<ProtectedRoute allowedRoles={[ROLES.EXAMINER]} />}>
                      <Route element={<ExaminerLayout />}>
                        <Route index element={<ExaminerDashboardPage />} />
                        <Route path="students" element={<ExaminerStudentsPage />} />
                        <Route path="exams" element={<ExamsListPage />} />
                        <Route path="exams/new" element={<ExamFormPage />} />
                        <Route path="exams/:id/sandbox" element={<ExamWorkspacePage />} />
                        <Route path="exams/:id/edit" element={<ExamFormPage />} />
                        <Route path="exams/:id/review" element={<ExamReviewPage />} />
                        <Route path="exams/:id" element={<ExamShell />}>
                          <Route index element={<ExamDetailsSection />} />
                          <Route path="candidates" element={<ExamCandidatesSection />} />
                          <Route path="questions" element={<ExamQuestionsSection />} />
                          <Route path="monitor" element={<ExamMonitorLiveSection />} />
                          <Route path="monitor/announcements" element={<ExamMonitorAnnouncementsSection />} />
                          <Route path="monitor/disruptions" element={<ExamMonitorDisruptionsSection />} />
                          <Route path="grading" element={<ExamGradingSection />} />
                          <Route path="results" element={<ExamResultsScoresSection />} />
                          <Route path="results/analytics" element={<ExamResultsAnalyticsSection />} />
                          <Route path="results/fairness" element={<ExamResultsFairnessSection />} />
                          <Route path="results/report" element={<ExamResultsReportSection />} />
                          <Route path="disputes" element={<ExamDisputesSection />} />
                        </Route>
                        <Route path="account/password" element={<ChangePasswordPage />} />
                        <Route path="*" element={<Navigate to="/404" replace />} />
                      </Route>
                    </Route>

                    <Route path="/candidate" element={<ProtectedRoute allowedRoles={[ROLES.CANDIDATE]} />}>
                      <Route element={<CandidateLayout />}>
                        <Route index element={<CandidateExamsPage />} />
                        <Route path="exams/:id" element={<CandidateExamPage />} />
                        <Route path="exams/:id/result" element={<CandidateResultPage />} />
                        <Route path="account/password" element={<ChangePasswordPage />} />
                        <Route path="*" element={<Navigate to="/404" replace />} />
                      </Route>
                    </Route>

                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </AuthProvider>
          </ServerClockProvider>
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>
  )
}
