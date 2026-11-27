import { useEffect } from 'react'

export function usePageTitle(title) {
  useEffect(() => {
    if (title) document.title = `${title} \u00b7 Secure Exam System`
  }, [title])
}
