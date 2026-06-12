'use client'
import { useState, useTransition } from 'react'
import { deleteBusinessAction } from './actions'

export function DeleteBusinessBtn({ businessId, businessName }: { businessId: string; businessName: string }) {
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <span className="flex items-center gap-2">
        <span className="text-xs text-ink-muted">Delete &ldquo;{businessName}&rdquo;?</span>
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await deleteBusinessAction(businessId)
              setConfirming(false)
            })
          }
          className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
        >
          {pending ? 'Deleting…' : 'Yes, delete'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-ink-muted hover:text-ink"
        >
          Cancel
        </button>
      </span>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs text-ink-faint hover:text-red-600 transition-colors"
    >
      Delete
    </button>
  )
}
