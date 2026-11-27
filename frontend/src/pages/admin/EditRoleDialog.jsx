import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select } from '@/components/ui/input'
import { FormField } from '@/components/FormField'
import { useUpdateUser } from '@/hooks/useUsers'
import { ROLE_META, ROLE_OPTIONS } from '@/lib/constants'
import { userDisplayName } from '@/lib/schema'
import { editRoleSchema } from '@/lib/schemas'

function EditRoleForm({ user, onDone, allowedRoles }) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({ resolver: zodResolver(editRoleSchema), defaultValues: { role: user.role } })

  const updateUser = useUpdateUser({
    successMessage: (updated) => `${userDisplayName(updated)} is now ${ROLE_META[updated.role].label}`,
  })
  const unchanged = useWatch({ control, name: 'role' }) === user.role
  const options = allowedRoles?.length
    ? ROLE_OPTIONS.filter((o) => allowedRoles.includes(o.value) || o.value === user.role)
    : ROLE_OPTIONS

  return (
    <form
      noValidate
      onSubmit={handleSubmit(({ role }) => updateUser.mutate({ id: user.id, role }, { onSuccess: onDone }))}
      className="flex min-h-0 flex-1 flex-col"
    >
      <DialogBody>
        <FormField label="Role" error={errors.role?.message}>
          {(field) => (
            <Select {...field} {...register('role')}>
              {options.map((option) => (
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
        <Button
          type="submit"
          loading={updateUser.isPending}
          loadingLabel="Saving…"
          disabledReason={unchanged ? 'Pick a different role.' : undefined}
        >
          Save
        </Button>
      </DialogFooter>
    </form>
  )
}

export function EditRoleDialog({ user, onOpenChange, allowedRoles }) {
  return (
    <Dialog open={Boolean(user)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change role</DialogTitle>
        </DialogHeader>
        {user && (
          <EditRoleForm key={user.id} user={user} onDone={() => onOpenChange(false)} allowedRoles={allowedRoles} />
        )}
      </DialogContent>
    </Dialog>
  )
}
