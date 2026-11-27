import { EmptyState } from '@/components/EmptyState'

/** Placeholder for tabs whose features land in a later phase. */
export function ComingNextTab({ icon, title, description }) {
  return <EmptyState icon={icon} title={title} description={description} />
}
