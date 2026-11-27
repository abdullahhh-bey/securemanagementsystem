import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowUpRight, Check, CircleAlert, Fingerprint, LockKeyhole, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { AppFooter } from '@/components/layout/AppFooter'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { SkipLink } from '@/components/layout/SkipLink'
import { FormField } from '@/components/FormField'
import { useAuth } from '@/hooks/useAuth'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useToast } from '@/hooks/useToast'
import { roleHome } from '@/lib/constants'
import { loginSchema } from '@/lib/schemas'

function BrandPanel() {
  return (
    <aside
      aria-label="About"
      className="login-visual geo-lines on-ink relative hidden min-h-dvh flex-col justify-between overflow-hidden px-10 py-10 text-on-dark lg:flex xl:px-16 xl:py-12"
    >
      <div className="login-orbit pointer-events-none absolute -right-36 top-24 size-[34rem] rounded-full border border-white/10" aria-hidden="true">
        <div className="absolute inset-8 rounded-full border border-white/10" />
        <div className="absolute inset-20 rounded-full border border-white/10" />
        <div className="absolute left-1/2 top-1/2 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl" />
      </div>

      <div className="relative z-10">
        <BrandLogo size="md" variant="onDark" />
        <div className="mt-24 max-w-xl xl:mt-28">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5 text-xs font-semibold tracking-[0.16em] text-on-dark/80">
            <span className="size-1.5 rounded-full bg-sky" />
            FS DIGITAL ASSESSMENT
          </div>
          <h2 className="text-balance font-heading text-4xl font-extrabold leading-[1.12] tracking-tight xl:text-6xl">
            A clearer way to
            <span className="mt-1 block text-sky">move forward.</span>
          </h2>
          <p className="mt-6 max-w-md text-base leading-7 text-on-dark/70 xl:text-lg">
            Thoughtful tools for secure exams, confident candidates, and better assessment workflows.
          </p>
        </div>

        <div className="login-feature-card mt-12 flex max-w-md items-center gap-4 rounded-2xl border border-white/15 bg-white/[0.08] p-4 backdrop-blur-md xl:mt-16 xl:p-5">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-sky/15 text-sky">
            <Fingerprint className="size-6" aria-hidden="true" />
          </div>
          <div>
            <p className="font-heading text-sm font-bold">Your exam workspace</p>
            <p className="mt-1 text-sm text-on-dark/65">Everything you need, in one focused place.</p>
          </div>
          <ArrowUpRight className="ml-auto size-4 shrink-0 text-on-dark/50" aria-hidden="true" />
        </div>
      </div>

      <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-5 text-xs text-on-dark/55">
        <span>FS University Lahore</span>
        <span>Technoverse 5.0</span>
      </div>
    </aside>
  )
}

export default function LoginPage() {
  usePageTitle('Sign in')
  const { login } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [formError, setFormError] = useState(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (values) => {
    setFormError(null)
    try {
      const user = await login(values)
      navigate(roleHome(user.role), { replace: true })
    } catch (error) {
      setFormError(error.message)
      if (error.code === 'NETWORK_ERROR' || error.status >= 500) toast.error(error.message)
    }
  }

  return (
    <div className="login-shell grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)]">
      <SkipLink />
      <BrandPanel />

      <div className="login-main relative flex min-h-dvh flex-col overflow-hidden">
        <div className="geo-lines on-ink flex items-center justify-between px-5 py-4 sm:px-8 lg:hidden">
          <BrandLogo size="sm" variant="onDark" />
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-xs font-medium text-on-dark/80">
            <ShieldCheck className="size-4 text-sky" aria-hidden="true" />
            Secure portal
          </span>
        </div>

        <div className="login-glow pointer-events-none absolute -right-40 -top-40 size-[30rem] rounded-full bg-primary/[0.07] blur-3xl" aria-hidden="true" />
        <main
          id="main-content"
          className="relative flex flex-1 items-center justify-center px-5 py-12 sm:px-10 lg:px-12 xl:px-16"
        >
          <div className="login-content w-full max-w-[440px]">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.06] px-3 py-1.5 text-xs font-semibold text-primary">
              <LockKeyhole className="size-3.5" aria-hidden="true" />
              SECURE EXAM ACCESS
            </div>
            <h1 className="font-heading text-4xl font-extrabold tracking-tight text-ink sm:text-[2.7rem]">Welcome back</h1>
            <p className="mt-3 max-w-sm text-base leading-7 text-muted">
              Sign in to continue to your examination workspace.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-9 flex flex-col gap-5">
              {formError && (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger"
                >
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <p className="font-medium">{formError}</p>
                </div>
              )}

              <FormField label="Email address" error={errors.email?.message} required className="gap-2">
                {(field) => (
                  <Input
                    {...field}
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="you@university.edu"
                    className="h-12 rounded-xl bg-white px-4 shadow-sm shadow-ink/[0.02] transition-all focus:border-primary focus:ring-4 focus:ring-primary/10"
                    {...register('email')}
                  />
                )}
              </FormField>

              <FormField label="Password" error={errors.password?.message} required className="gap-2">
                {(field) => (
                  <PasswordInput
                    {...field}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="h-12 rounded-xl bg-white px-4 pr-12 shadow-sm shadow-ink/[0.02] transition-all focus:border-primary focus:ring-4 focus:ring-primary/10"
                    {...register('password')}
                  />
                )}
              </FormField>

              <Button
                type="submit"
                size="lg"
                loading={isSubmitting}
                loadingLabel="Signing in…"
                className="login-submit mt-2 h-12 w-full rounded-xl text-sm font-semibold shadow-lg shadow-primary/20 transition-all"
              >
                {!isSubmitting && <span>Sign in securely</span>}
              </Button>
            </form>

            <div className="mt-6 flex items-start gap-3 rounded-xl border border-border/70 bg-white/70 p-4">
              <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                <Check className="size-4" aria-hidden="true" />
              </div>
              <p className="text-sm leading-6 text-muted">
                Your account gives you access to the tools assigned to your role. Contact your administrator if you need help.
              </p>
            </div>
          </div>
        </main>
        <AppFooter />
      </div>
    </div>
  )
}
