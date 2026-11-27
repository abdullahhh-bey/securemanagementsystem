import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select } from '@/components/ui/input'
import { FormField } from '@/components/FormField'
import { useUpdateUser } from '@/hooks/useUsers'
import { ROLE_META, ROLE_OPTIONS } from '@/lib/constants'
import { editRoleSchema } from '@/lib/schemas'

function EditRoleForm({ user, onDone }) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({ resolver: zodResolver(editRoleSchema), defaultValues: { role: user.role } })

  const updateUser = useUpdateUser({
    successMessage: (updated) => `${updated.name} is now ${ROLE_META[updated.role].label.toLowerCase()}`,
  })
  const unchanged = useWatch({ control, name: 'role' }) === user.role

  return (
    <form
      noValidate
      onSubmit={handleSubmit(({ role }) => updateUser.mutate({ id: user.id, role }, { onSuccess: onDone }))}
      className="flex min-h-0 flex-1 flex-col"
    >
      <DialogBody>
        <FormField label="Role" error={errors.role?.message} hint="Changing a role takes effect the next time they load a page.">
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
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onDone} disabled={updateUser.isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={updateUser.isPending} disabledReason={unchanged ? 'Pick a different role to save.' : undefined}>
          Save role
        </Button>
      </DialogFooter>
    </form>
  )
}

export function EditRoleDialog({ user, onOpenChange }) {
  return (
    <Dialog open={Boolean(user)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change role</DialogTitle>
          <DialogDescription>{user ? `Choose a new role for ${user.name}.` : ''}</DialogDescription>
        </DialogHeader>
        {user && <EditRoleForm key={user.id} user={user} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}
