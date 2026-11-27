import { useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { DEFAULT_CANDIDATE_PREFERENCES } from '@/api/candidate'
import { useCandidatePreferences, useSaveCandidatePreferences } from '@/hooks/useStudentPortal'

const DISPLAY_OPTIONS = {
  textSize: [
    { value: 'medium', label: 'Standard' },
    { value: 'large', label: 'Large' },
    { value: 'extra-large', label: 'Extra large' },
  ],
  contrast: [
    { value: 'standard', label: 'Standard contrast' },
    { value: 'high', label: 'High contrast' },
  ],
  lineSpacing: [
    { value: 'standard', label: 'Standard spacing' },
    { value: 'relaxed', label: 'Relaxed spacing' },
  ],
}

function PreferenceField({ id, label, value, options, onChange }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className="min-h-10 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-ink"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  )
}

export default function CandidatePreferencesPage() {
  const preferencesQuery = useCandidatePreferences()
  const savePreferences = useSaveCandidatePreferences()
  const [overrides, setOverrides] = useState({})
  const preferences = { ...DEFAULT_CANDIDATE_PREFERENCES, ...preferencesQuery.data, ...overrides }

  if (preferencesQuery.isPending) {
    return (
      <>
        <PageHeader title="Display preferences" />
        <Skeleton className="h-72 w-full" />
      </>
    )
  }

  if (preferencesQuery.error) {
    return (
      <>
        <PageHeader title="Display preferences" />
        <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
          {preferencesQuery.error.message}
        </p>
        <Button className="mt-3" variant="secondary" onClick={() => preferencesQuery.refetch()}>
          Retry
        </Button>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Display preferences"
        description="These settings are saved to your account and applied throughout the candidate portal."
      />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Reading and display</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <PreferenceField
            id="candidate-text-size"
            label="Text size"
            value={preferences.textSize}
            options={DISPLAY_OPTIONS.textSize}
            onChange={(textSize) => setOverrides((current) => ({ ...current, textSize }))}
          />
          <PreferenceField
            id="candidate-contrast"
            label="Contrast"
            value={preferences.contrast}
            options={DISPLAY_OPTIONS.contrast}
            onChange={(contrast) => setOverrides((current) => ({ ...current, contrast }))}
          />
          <PreferenceField
            id="candidate-line-spacing"
            label="Line spacing"
            value={preferences.lineSpacing}
            options={DISPLAY_OPTIONS.lineSpacing}
            onChange={(lineSpacing) => setOverrides((current) => ({ ...current, lineSpacing }))}
          />
          {savePreferences.error && (
            <p role="alert" className="rounded-md bg-danger-soft p-3 text-sm text-danger">
              {savePreferences.error.message}
            </p>
          )}
          <div className="flex items-center gap-3">
            <Button
              onClick={() => savePreferences.mutate(preferences, { onSuccess: () => setOverrides({}) })}
              loading={savePreferences.isPending}
            >
              Save preferences
            </Button>
            <p role="status" className="text-sm text-muted">
              {savePreferences.isSuccess ? 'Preferences saved.' : ''}
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
