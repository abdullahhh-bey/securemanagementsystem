import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlert, Clock3, LogIn, ScrollText, ShieldCheck, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Brand } from '@/components/layout/Brand'
import { SkipLink } from '@/components/layout/SkipLink'
import { FormField } from '@/components/FormField'
import { useAuth } from '@/hooks/useAuth'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useToast } from '@/hooks/useToast'
import { ROLE_META, roleHome } from '@/lib/constants'
import { loginSchema } from '@/lib/schemas'

const DEMO_ACCOUNTS = [
  { role: 'ADMIN', email: 'admin@demo.com', password: 'Admin@123' },
  { role: 'EXAMINER', email: 'examiner@demo.com', password: 'Examiner@123' },
  { role: 'CANDIDATE', email: 'candidate1@demo.com', password: 'Candidate@123' },
]

const HIGHLIGHTS = [
  { icon: Clock3, title: 'One trusted clock', text: 'Every countdown and access decision follows the server, never a candidate\u2019s device.' },
  { icon: ShieldCheck, title: 'Role-based access', text: 'Administrators, examiners and candidates each see only what they should.' },
  { icon: ScrollText, title: 'A clear exam lifecycle', text: 'Draft, publish, run and review - every exam moves through visible, auditable steps.' },
]

function BrandPanel() {
  return (
    <aside aria-label="About Quillmark" className="ruled-paper on-ink relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex xl:p-16">
      <Brand onDark size="lg" />
      <div className="max-w-lg pl-6">
        <p className="text-balance font-heading text-4xl font-extrabold leading-tight tracking-tight xl:text-[2.6rem]">
          Fair exams, calmly run.
        </p>
        <p className="mt-4 max-w-md text-lg text-white/80">
          Quillmark helps institutions schedule, publish and supervise examinations with confidence.
        </p>
        <ul className="mt-10 space-y-6">
          {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/5" aria-hidden="true">
                <Icon className="size-5 text-[#7dd3c8]" />
              </span>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="text-sm leading-relaxed text-white/75">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <p className="pl-6 text-sm text-white/65">Secure Examination Management System</p>
    </aside>
  )
}

export default function LoginPage() {
  usePageTitle('Sign in')
  const { login } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [formError, setFormError] = useState(null)
  const [demoNote, setDemoNote] = useState('')
  const submitRef = useRef(null)

  const {
    register,
    handleSubmit,
    setValue,
    clearErrors,
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

  const fillDemo = (account) => {
    setValue('email', account.email, { shouldDirty: true })
    setValue('password', account.password, { shouldDirty: true })
    clearErrors()
    setFormError(null)
    setDemoNote(`${ROLE_META[account.role].label} demo account filled in. Press Sign in to continue.`)
    submitRef.current?.focus()
  }

  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <SkipLink />
      <BrandPanel />

      <div className="flex flex-col">
        <div className="ruled-paper on-ink px-6 py-5 lg:hidden">
          <Brand onDark />
        </div>

        <main id="main-content" className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-md">
            <h1 className="text-3xl font-extrabold">Sign in</h1>
            <p className="mt-2 text-muted">Use the account your institution gave you to continue.</p>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 flex flex-col gap-5">
              {formError && (
                <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <p className="font-medium">{formError}</p>
                </div>
              )}

              <FormField label="Email address" error={errors.email?.message} required>
                {(field) => (
                  <Input {...field} type="email" autoComplete="email" inputMode="email" placeholder="you@institution.edu" {...register('email')} />
                )}
              </FormField>

              <FormField label="Password" error={errors.password?.message} required>
                {(field) => <PasswordInput {...field} autoComplete="current-password" {...register('password')} />}
              </FormField>

              <Button ref={submitRef} type="submit" size="lg" loading={isSubmitting} className="mt-1">
                {!isSubmitting && <LogIn />}
                {isSubmitting ? 'Signing in\u2026' : 'Sign in'}
              </Button>
            </form>

            <section aria-labelledby="demo-heading" className="mt-10 border-t border-border pt-6">
              <h2 id="demo-heading" className="text-sm font-semibold">
                Just exploring?
              </h2>
              <p className="mt-1 text-sm text-muted">Fill the form with a demo account.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {DEMO_ACCOUNTS.map((account) => {
                  const Icon = ROLE_META[account.role].icon
                  return (
                    <Button key={account.role} variant="secondary" size="sm" onClick={() => fillDemo(account)}>
                      <Icon />
                      Use demo account
                      <span className="rounded bg-sunken px-1.5 py-0.5 text-xs font-semibold text-muted">{ROLE_META[account.role].label}</span>
                    </Button>
                  )
                })}
              </div>
              <p role="status" aria-live="polite" className="mt-3 flex min-h-5 items-center gap-1.5 text-sm text-muted">
                {demoNote && (
                  <>
                    <UserRound className="size-4" aria-hidden="true" />
                    {demoNote}
                  </>
                )}
              </p>
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
