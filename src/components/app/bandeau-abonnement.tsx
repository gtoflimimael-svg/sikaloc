import Link from 'next/link'

import { droits } from '@/lib/acces'
import type { Bailleur } from '@/lib/types/database'

/**
 * Bandeau d'état de l'abonnement, affiché en tête de l'application.
 *
 * Il ne masque rien et ne bloque rien — le refus d'écriture est appliqué côté
 * serveur (`bailleurAvecEcriture`). Ce bandeau explique la situation et donne
 * le chemin pour en sortir, ce qui est la seule chose utile à ce moment-là.
 */
export function BandeauAbonnement({ bailleur }: { bailleur: Bailleur }) {
  const acces = droits(bailleur)

  if (!acces.avertissement) return null

  const grave = acces.statut === 'suspendu' || acces.statut === 'supprime'

  return (
    <div
      role="status"
      className={`border-b px-lg py-md sm:px-xl ${
        grave
          ? 'border-negative/30 bg-negative/10'
          : acces.statut === 'lecture_seule'
            ? 'border-warning/30 bg-warning-pale'
            : 'border-primary/20 bg-canvas-sage'
      }`}
    >
      <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-md">
        <p
          className={`text-body-sm font-semibold ${
            grave
              ? 'text-negative-darkest'
              : acces.statut === 'lecture_seule'
                ? 'text-warning-content'
                : 'text-ink-deep'
          }`}
        >
          {acces.avertissement}
        </p>

        <Link
          href="/app/parametres/abonnement"
          className="btn btn-primary btn-sm shrink-0"
        >
          Régler mon abonnement
        </Link>
      </div>
    </div>
  )
}
