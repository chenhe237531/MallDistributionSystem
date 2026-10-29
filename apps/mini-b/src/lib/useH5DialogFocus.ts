import { useEffect, useRef } from 'react'

type H5DialogFocusOptions = {
  open: boolean
  dialogId: string
  initialFocusId: string
  onDismiss: () => void
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** H5 only: traps modal focus and restores it after dismissal; WeChat keeps native tap behavior. */
export function useH5DialogFocus({
  open,
  dialogId,
  initialFocusId,
  onDismiss,
}: H5DialogFocusOptions) {
  const priorFocusRef = useRef<HTMLElement | null>(null)
  const dismissRef = useRef(onDismiss)
  dismissRef.current = onDismiss

  useEffect(() => {
    if (!open || typeof document === 'undefined' || typeof HTMLElement === 'undefined') {
      return
    }

    priorFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusTimer = setTimeout(() => document.getElementById(initialFocusId)?.focus(), 0)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        dismissRef.current()
        return
      }
      if (event.key !== 'Tab') {
        return
      }

      const dialog = document.getElementById(dialogId)
      const focusable = dialog ? Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) : []
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKeyDown)
      const priorFocus = priorFocusRef.current
      if (priorFocus?.isConnected) {
        setTimeout(() => priorFocus.focus(), 0)
      }
    }
  }, [dialogId, initialFocusId, open])
}
