'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { tempsRestantCorrection } from '@/lib/paiement-utils'

/**
 * Compte à rebours de la fenêtre de correction (§6.1.7).
 *
 * Rendu côté client : afficher un temps restant depuis le serveur donnerait une
 * valeur figée à l'instant du rendu, que le cache pourrait resservir.
 */
export function FenetreCorrection({
  valideLe,
  paiementId,
}: {
  valideLe: string | null
  paiementId: string
}) {
  const [restant, setRestant] = useState<number | null>(null)

  // Le temps restant dépend de l'horloge, qui diffère entre le serveur et le
  // navigateur : le calculer au rendu ferait diverger l'hydratation.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRestant(tempsRestantCorrection(valideLe))

    const minuteur = setInterval(() => {
      const reste = tempsRestantCorrection(valideLe)
      setRestant(reste)
      if (reste <= 0) clearInterval(minuteur)
    }, 1000)

    return () => clearInterval(minuteur)
  }, [valideLe])

  // Premier rendu : on n'affiche rien tant que le client n'a pas calculé,
  // pour éviter une différence d'hydratation.
  if (restant === null) return null

  if (restant <= 0) {
    return (
      <p className="text-body-sm text-mute">
        Ce paiement est figé : la fenêtre de correction est écoulée.
      </p>
    )
  }

  const minutes = Math.floor(restant / 60_000)
  const secondes = Math.floor((restant % 60_000) / 1000)

  return (
    <div className="flex flex-wrap items-center gap-md rounded-lg bg-warning-pale px-lg py-md">
      <p className="text-body-sm font-semibold text-warning-content">
        Correction possible pendant encore {minutes}:{String(secondes).padStart(2, '0')}
      </p>
      <Link
        href={`/app/paiements/${paiementId}/modifier`}
        className="text-body-sm font-semibold text-warning-deep underline"
      >
        Corriger ce paiement
      </Link>
    </div>
  )
}
