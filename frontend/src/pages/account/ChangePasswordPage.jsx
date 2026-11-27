import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound } from 'lucide-react'
import { applyFieldErrors } from '@/api/client'
import * as authApi from '@/api/auth'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/ui/password-input'
import { FormField } from '@/components/FormField'
import { PageHeader } from '@/components/PageHeader'
import { changePasswordSchema } from '@/lib/schemas'
import { useAppMutation } from '@/hooks/useAppMutation'

export default function ChangePasswordPage() {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const mutation = useAppMutation(authApi.changePassword, {
    successMessage: 'Password updated',
    onSuccess: () => reset(),
  })

  const onSubmit = (values) =>
    mutation.mutate(
      { currentPassword: values.currentPassword, newPassword: values.newPassword },
      { onError: (error) => applyFieldErrors(error, setError) },
    )

  return (
    <>
      <PageHeader title="Change password" />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid max-w-md gap-4">
        <FormField label="Current password" error={errors.currentPassword?.message} required>
          {(field) => <PasswordInput {...field} autoComplete="current-password" {...register('currentPassword')} />}
        </FormField>
        <FormField label="New password" error={errors.newPassword?.message} required>
          {(field) => <PasswordInput {...field} autoComplete="new-password" {...register('newPassword')} />}
        </FormField>
        <FormField label="Confirm new password" error={errors.confirmPassword?.message} required>
          {(field) => <PasswordInput {...field} autoComplete="new-password" {...register('confirmPassword')} />}
        </FormField>
        <div>
          <Button type="submit" loading={mutation.isPending} loadingLabel="Updating…">
            {!mutation.isPending && <KeyRound />}
            Update password
          </Button>
        </div>
      </form>
    </>
  )
}
