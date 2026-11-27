import { createContext, useContext } from 'react'

export const ToastContext = createContext(null)

/** toast.success(title, { description, action }) / toast.error(...) / toast.info(...) */
export function useToast() {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast must be used inside <ToastProvider>')
  return value
}
