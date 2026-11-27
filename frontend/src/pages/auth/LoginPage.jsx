import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlert, KeyRound, LogIn } from 'lucide-react'
import * as authApi from '@/api/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { AppFooter } from '@/components/layout/AppFooter'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { SkipLink } from '@/components/layout/SkipLink'
import { FormField } from '@/components/FormField'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/hooks/useAuth'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useToast } from '@/hooks/useToast'
import { roleHome } from '@/lib/constants'
import { forgotPasswordSchema, loginSchema } from '@/lib/schemas'

function BrandPanel() {
  return (
    <aside aria-label="About" className="geo-lines on-ink relative hidden flex-col justify-between overflow-hidden p-12 text-on-dark lg:flex xl:p-16">
      <BrandLogo size="lg" variant="onDark" />
      <div className="max-w-lg">
        <p className="text-balance font-heading text-4xl font-extrabold leading-tight tracking-tight xl:text-[2.6rem]">
          Secure Examination Management System
        </p>
        <p className="mt-4 max-w-md text-lg text-on-dark/85">COMSATS University Lahore</p>
      </div>
      <p className="text-sm text-on-dark/80">Technoverse 5.0</p>
    </aside>
  )
}

function ForgotPasswordDialog({ open, onOpenChange }) {
  const toast = useToast()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = async (values) => {
    try {
      await authApi.forgotPassword(values)
      toast.success('Check your email', { description: 'If an account exists, reset instructions were sent.' })
      reset()
      onOpenChange(false)
    } catch (error) {
      toast.error(error.message)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isSubmitting) {
          if (!next) reset()
          onOpenChange(next)
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Forgot password</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody>
            <FormField label="Email" error={errors.email?.message} required>
              {(field) => <Input {...field} type="email" autoComplete="email" {...register('email')} />}
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting} loadingLabel="Sending…">
              {!isSubmitting && <KeyRound />}
              Send reset link
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function LoginPage() {
  usePageTitle('Sign in')
  const { login } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [formError, setFormError] = useState(null)
  const [forgotOpen, setForgotOpen] = useState(false)

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
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <SkipLink />
      <BrandPanel />

      <div className="flex flex-col">
        <div className="geo-lines on-ink px-6 py-5 lg:hidden">
          <BrandLogo size="md" variant="onDark" />
        </div>

        <main id="main-content" className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-md">
            <h1 className="text-3xl font-extrabold">Sign in</h1>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 flex flex-col gap-4">
              {formError && (
                <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <p className="font-medium">{formError}</p>
                </div>
              )}

              <FormField label="Email" error={errors.email?.message} required>
                {(field) => (
                  <Input {...field} type="email" autoComplete="email" inputMode="email" {...register('email')} />
                )}
              </FormField>

              <FormField label="Password" error={errors.password?.message} required>
                {(field) => <PasswordInput {...field} autoComplete="current-password" {...register('password')} />}
              </FormField>

              <div className="flex justify-end">
                <Button type="button" variant="link" size="sm" onClick={() => setForgotOpen(true)}>
                  Forgot password?
                </Button>
              </div>

              <Button type="submit" size="lg" loading={isSubmitting} loadingLabel="Signing in…">
                {!isSubmitting && <LogIn />}
                Sign in
              </Button>
            </form>
          </div>
        </main>
        <AppFooter />
      </div>

      <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} />
    </div>
  )
}
