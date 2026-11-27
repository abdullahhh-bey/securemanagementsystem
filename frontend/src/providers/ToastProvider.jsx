import { useCallback, useMemo, useRef, useState } from 'react'
import { ToastContext } from '@/hooks/useToast'
import { Toaster } from '@/components/Toaster'

const DURATION = { success: 5000, info: 6000, error: 9000 }

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const counter = useRef(0)
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback(
    (tone, title, { description, action } = {}) => {
      const id = ++counter.current
      setToasts((current) => [...current.slice(-3), { id, tone, title, description, action }])
      // Toasts that carry an action stay until the user decides.
      if (!action) timers.current.set(id, setTimeout(() => dismiss(id), DURATION[tone]))
      return id
    },
    [dismiss],
  )

  const api = useMemo(
    () => ({
      success: (title, options) => push('success', title, options),
      error: (title, options) => push('error', title, options),
      info: (title, options) => push('info', title, options),
      dismiss,
    }),
    [push, dismiss],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}
