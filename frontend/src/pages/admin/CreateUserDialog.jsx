import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { UserPlus } from 'lucide-react'
import { applyFieldErrors } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input, Select } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { FormField } from '@/components/FormField'
import { useCreateUser } from '@/hooks/useUsers'
import { ROLE_OPTIONS } from '@/lib/constants'
import { createUserSchema } from '@/lib/schemas'

function CreateUserForm({ onDone }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(createUserSchema),
    defaultValues: { name: '', email: '', role: 'CANDIDATE', password: '' },
  })

  const createUser = useCreateUser()

  const onSubmit = (values) =>
    createUser.mutate(values, {
      onSuccess: onDone,
      onError: (error) => applyFieldErrors(error, setError),
    })

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogBody className="flex flex-col gap-5">
        <FormField label="Full name" error={errors.name?.message} required>
          {(field) => <Input {...field} autoComplete="off" {...register('name')} />}
        </FormField>
        <FormField label="Email address" error={errors.email?.message} required>
          {(field) => <Input {...field} type="email" autoComplete="off" {...register('email')} />}
        </FormField>
        <FormField label="Role" error={errors.role?.message} required>
          {(field) => (
            <Select {...field} {...register('role')}>
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField
          label="Temporary password"
          hint="At least 8 characters with a letter and a number. Share it securely."
          error={errors.password?.message}
          required
        >
          {(field) => <PasswordInput {...field} autoComplete="new-password" {...register('password')} />}
        </FormField>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onDone} disabled={createUser.isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={createUser.isPending}>
          {!createUser.isPending && <UserPlus />}
          Create user
        </Button>
      </DialogFooter>
    </form>
  )
}

export function CreateUserDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a user</DialogTitle>
          <DialogDescription>The new account can sign in straight away.</DialogDescription>
        </DialogHeader>
        <CreateUserForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}
