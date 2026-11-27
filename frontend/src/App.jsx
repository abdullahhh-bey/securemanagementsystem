import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ServerClockProvider } from "@/providers/ServerClockProvider";
import { AuthProvider } from "@/providers/AuthProvider";
import { ToastProvider } from "@/providers/ToastProvider";
import {
  FullPageLoader,
  ProtectedRoute,
  PublicOnlyRoute,
  RootRedirect,
} from "@/routes/guards";
import { ROLES } from "@/lib/constants";
import LoginPage from "@/pages/auth/LoginPage";
import ForbiddenPage from "@/pages/errors/ForbiddenPage";
import NotFoundPage from "@/pages/errors/NotFoundPage";

// Role areas are code-split: a candidate never downloads the admin screens.
const AdminLayout = lazy(() => import("@/layouts/AdminLayout"));
const AdminOverviewPage = lazy(() => import("@/pages/admin/AdminOverviewPage"));
const AdminUsersPage = lazy(() => import("@/pages/admin/AdminUsersPage"));
const AdminAuditPage = lazy(() => import("@/pages/admin/AdminAuditPage"));
const AdminExamsPage = lazy(() => import("@/pages/admin/AdminExamsPage"));
const CandidateResultPage = lazy(() => import("@/pages/candidate/CandidateResultPage"));
const ExamWorkspacePage = lazy(() => import("@/pages/examiner/ExamWorkspacePage"));
const CandidateExamPage = lazy(
  () => import("@/pages/candidate/CandidateExamPage"),
);
const CandidateExamsPage = lazy(
  () => import("@/pages/candidate/CandidateExamsPage"),
);
const CandidateLayout = lazy(() => import("@/layouts/CandidateLayout"));
const ExamDetailPage = lazy(() => import("@/pages/examiner/ExamDetailPage"));
const ExamFormPage = lazy(() => import("@/pages/examiner/ExamFormPage"));
const ExaminerDashboardPage = lazy(
  () => import("@/pages/examiner/ExaminerDashboardPage"),
);
const ExaminerLayout = lazy(() => import("@/layouts/ExaminerLayout"));
const ExamReviewPage = lazy(() => import("@/pages/examiner/ExamReviewPage"));
const ExamsListPage = lazy(() => import("@/pages/examiner/ExamsListPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      // Retry only transient failures (network / 5xx), never 4xx answers.
      retry: (failureCount, error) =>
        failureCount < 1 &&
        (error?.code === "NETWORK_ERROR" || error?.status >= 500),
    },
  },
});

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

                    <Route
                      path="/admin"
                      element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]} />}
                    >
                      <Route element={<AdminLayout />}>
                        <Route index element={<AdminOverviewPage />} />
                        <Route path="users" element={<AdminUsersPage />} />
                        <Route path="exams" element={<AdminExamsPage />} />
                        <Route path="audit" element={<AdminAuditPage />} />
                        <Route
                          path="*"
                          element={<Navigate to="/404" replace />}
                        />
                      </Route>
                    </Route>

                    <Route
                      path="/examiner"
                      element={
                        <ProtectedRoute allowedRoles={[ROLES.EXAMINER]} />
                      }
                    >
                      <Route element={<ExaminerLayout />}>
                        <Route index element={<ExaminerDashboardPage />} />
                        <Route path="exams" element={<ExamsListPage />} />
                        <Route path="exams/new" element={<ExamFormPage />} />
                        <Route path="exams/:id" element={<ExamDetailPage />} />
                        <Route path="exams/:id/sandbox" element={<ExamWorkspacePage />} />
                        <Route
                          path="exams/:id/edit"
                          element={<ExamFormPage />}
                        />
                        <Route
                          path="exams/:id/review"
                          element={<ExamReviewPage />}
                        />
                        <Route
                          path="*"
                          element={<Navigate to="/404" replace />}
                        />
                      </Route>
                    </Route>

                    <Route
                      path="/candidate"
                      element={
                        <ProtectedRoute allowedRoles={[ROLES.CANDIDATE]} />
                      }
                    >
                      <Route element={<CandidateLayout />}>
                        <Route index element={<CandidateExamsPage />} />
                        <Route
                          path="exams/:id"
                          element={<CandidateExamPage />}
                        />
                        <Route
                          path="exams/:id/result"
                          element={<CandidateResultPage />}
                        />
                        <Route
                          path="*"
                          element={<Navigate to="/404" replace />}
                        />
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
  );
}
