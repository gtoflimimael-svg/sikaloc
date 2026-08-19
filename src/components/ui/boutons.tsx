'use client'

import { LoaderCircle } from 'lucide-react'
import { useFormStatus } from 'react-dom'
import type { ReactNode } from 'react'

/**
 * Bouton de soumission.
 *
 * `useFormStatus` évite d'avoir à câbler un état de chargement dans chaque
 * formulaire : le bouton connaît l'état du <form> qui le contient.
 */
export function BoutonSoumettre({
  children,
  variante = 'primary',
  pleineLargeur = false,
  compact = false,
  libelleEnCours,
}: {
  children: ReactNode
  variante?: 'primary' | 'secondary' | 'tertiary' | 'danger'
  pleineLargeur?: boolean
  compact?: boolean
  libelleEnCours?: string
}) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className={[
        'btn',
        `btn-${variante}`,
        compact ? 'btn-sm' : '',
        pleineLargeur ? 'w-full' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {pending ? (
        <>
          <Spinner />
          {libelleEnCours ?? 'En cours…'}
        </>
      ) : (
        children
      )}
    </button>
  )
}

export function Spinner({ taille = 16 }: { taille?: number }) {
  return <LoaderCircle size={taille} strokeWidth={3} aria-hidden="true" className="animate-spin" />
}
