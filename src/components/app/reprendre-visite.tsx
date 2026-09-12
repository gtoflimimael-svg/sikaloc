'use client'

import { Compass } from 'lucide-react'
import { useActionState } from 'react'

import { reprendreVisite } from '@/lib/actions/visite'

/**
 * Point de reprise de la visite guidée, depuis le tableau de bord.
 *
 * Rendu uniquement quand la visite est terminée ou quittée — tant qu'elle est
 * en cours, elle est déjà à l'écran et proposer de la « reprendre » n'aurait
 * aucun sens.
 *
 * Un `<form>` plutôt qu'un `onClick` : l'action est une écriture serveur, et ce
 * bouton reste fonctionnel avant l'hydratation.
 */
export function ReprendreVisite({ terminee }: { terminee: boolean }) {
  const [, action, enCours] = useActionState(async () => {
    await reprendreVisite()
    return null
  }, null)

  return (
    <form action={action}>
      <button
        type="submit"
        disabled={enCours}
        className="inline-flex items-center gap-xs text-body-sm font-semibold text-mute underline transition-colors hover:text-ink disabled:opacity-60"
      >
        <Compass size={15} strokeWidth={2} aria-hidden="true" />
        {enCours
          ? 'Ouverture…'
          : terminee
            ? 'Revoir la visite guidée'
            : 'Reprendre la visite guidée'}
      </button>
    </form>
  )
}
