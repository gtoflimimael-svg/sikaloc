import Link from 'next/link'

import { Alerte } from '@/components/ui/retours'
import { LIMITE_LOGEMENTS_GRATUIT, PRIX_STANDARD_FCFA } from '@/lib/plan'

/**
 * Écran affiché quand un bail ne peut pas être créé.
 *
 * Le point de vigilance est le décompte : un bailleur qui a atteint le plafond
 * du plan Gratuit *et* dont les deux logements portent déjà un bail actif n'a
 * pas « besoin d'un logement de plus », il a besoin de savoir qu'il n'en aura
 * pas. Lui proposer « Ajouter un logement » ne fait que reporter le refus d'un
 * écran — c'est exactement ce que faisait la version précédente.
 */

export interface SituationBail {
  totalLogements: number
  logementsLibres: number
  totalLocataires: number
  /** Plafond du plan, ou null si illimité (Standard). */
  maxLogements: number | null
}

interface Diagnostic {
  ton: 'attention' | 'info'
  message: string
  actions: { href: string; libelle: string; variante: 'primary' | 'secondary' | 'tertiary' }[]
  aide?: string
}

export function diagnostiquer(situation: SituationBail): Diagnostic | null {
  const { totalLogements, logementsLibres, totalLocataires, maxLogements } = situation

  const plafondAtteint = maxLogements !== null && totalLogements >= maxLogements
  const manqueLocataire = totalLocataires === 0
  const manqueLogement = logementsLibres === 0

  if (!manqueLocataire && !manqueLogement) return null

  const lienLocataire = {
    href: '/app/locataires/nouveau',
    libelle: 'Ajouter un locataire',
    variante: 'primary' as const,
  }
  const lienLogement = {
    href: '/app/logements/nouveau',
    libelle: 'Ajouter un logement',
    variante: 'primary' as const,
  }
  const lienAbonnement = {
    href: '/app/parametres/abonnement',
    libelle: 'Passer au plan Standard',
    variante: 'primary' as const,
  }
  const lienBaux = {
    href: '/app/baux',
    libelle: 'Voir mes baux',
    variante: 'secondary' as const,
  }
  const lienLogements = {
    href: '/app/logements',
    libelle: 'Voir mes logements',
    variante: 'secondary' as const,
  }

  // ── Aucun logement du tout ────────────────────────────────────────────────
  if (totalLogements === 0) {
    return manqueLocataire
      ? {
          ton: 'info',
          message:
            'Un bail relie un logement à un locataire. Vous n’avez encore enregistré ni l’un ni l’autre.',
          actions: [lienLogement, { ...lienLocataire, variante: 'secondary' }],
        }
      : {
          ton: 'info',
          message:
            'Un bail relie un logement à un locataire. Il vous reste à enregistrer votre premier logement.',
          actions: [lienLogement, lienBaux],
        }
  }

  // ── Des logements, mais tous déjà sous bail actif ─────────────────────────
  if (manqueLogement) {
    const tous =
      totalLogements === 1
        ? 'Votre logement porte déjà un bail actif'
        : `Vos ${totalLogements} logements portent déjà chacun un bail actif`

    if (plafondAtteint) {
      return {
        ton: 'attention',
        message:
          `${tous}, et le plan Gratuit est limité à ${LIMITE_LOGEMENTS_GRATUIT} logements. ` +
          'Pour signer un nouveau bail, il faut donc soit un logement supplémentaire — ' +
          `réservé au plan Standard (${PRIX_STANDARD_FCFA.toLocaleString('fr-FR')} FCFA/mois) —, ` +
          'soit mettre fin à un bail en cours.',
        actions: [lienAbonnement, lienBaux],
        aide:
          'Un bail terminé libère son logement : vous pourrez alors y installer un nouveau locataire sans changer de plan.',
      }
    }

    return {
      ton: 'attention',
      message:
        `${tous}. Un logement ne peut porter qu’un bail actif à la fois : ajoutez un ` +
        'logement, ou mettez fin à un bail en cours pour en libérer un.',
      actions: [lienLogement, lienBaux],
    }
  }

  // ── Des logements libres, mais aucun locataire ────────────────────────────
  return {
    ton: 'info',
    message:
      'Un bail relie un logement à un locataire. Il vous reste à enregistrer votre premier locataire.',
    actions: [lienLocataire, lienLogements],
  }
}

export function BailImpossible({ situation }: { situation: SituationBail }) {
  const diagnostic = diagnostiquer(situation)

  if (!diagnostic) return null

  return (
    <div className="card card-lg space-y-lg anim-monte">
      <Alerte ton={diagnostic.ton}>{diagnostic.message}</Alerte>

      {diagnostic.aide ? (
        <p className="text-body-sm text-mute">{diagnostic.aide}</p>
      ) : null}

      <div className="flex flex-wrap gap-md">
        {diagnostic.actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={`btn btn-${action.variante}`}
          >
            {action.libelle}
          </Link>
        ))}
      </div>
    </div>
  )
}
