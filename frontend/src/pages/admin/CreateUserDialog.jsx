import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { UserPlus } from 'lucide-react'
import { applyFieldErrors } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input, Select } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { FormField } from '@/components/FormField'
import { useCreateUser } from '@/hooks/useUsers'
import { ROLE_META } from '@/lib/constants'
import { createUserSchema } from '@/lib/schemas'

function CreateUserForm({ onDone, defaultRole, allowedRoles }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(createUserSchema),
    defaultValues: { name: '', email: '', role: defaultRole, password: '' },
  })

  const createUser = useCreateUser()
  const roles = allowedRoles.map((value) => ({ value, label: ROLE_META[value].label }))

  const onSubmit = (values) =>
    createUser.mutate(values, {
      onSuccess: onDone,
      onError: (error) => applyFieldErrors(error, setError),
    })

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogBody className="grid gap-4 sm:grid-cols-2">
        <FormField label="Full name" error={errors.name?.message} required className="sm:col-span-2">
          {(field) => <Input {...field} autoComplete="off" {...register('name')} />}
        </FormField>
        <FormField label="Email" error={errors.email?.message} required className="sm:col-span-2">
          {(field) => <Input {...field} type="email" autoComplete="off" {...register('email')} />}
        </FormField>
        <FormField label="Role" error={errors.role?.message} required>
          {(field) => (
            <Select {...field} {...register('role')}>
              {roles.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label="Password" error={errors.password?.message} required>
          {(field) => <PasswordInput {...field} autoComplete="new-password" {...register('password')} />}
        </FormField>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onDone} disabled={createUser.isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={createUser.isPending} loadingLabel="Creating…">
          {!createUser.isPending && <UserPlus />}
          Create
        </Button>
      </DialogFooter>
    </form>
  )
}

export function CreateUserDialog({ open, onOpenChange, defaultRole = 'CANDIDATE', allowedRoles = ['CANDIDATE'], title = 'Create user' }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {open && (
          <CreateUserForm
            key={`${defaultRole}-${open}`}
            onDone={() => onOpenChange(false)}
            defaultRole={defaultRole}
            allowedRoles={allowedRoles}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
