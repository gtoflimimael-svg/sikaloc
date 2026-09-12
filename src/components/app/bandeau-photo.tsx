import Link from 'next/link'

import { etatIdentite, messageRappel } from '@/lib/identite'
import type { Bailleur } from '@/lib/types/database'

/**
 * Rappel progressif d'ajouter sa photo de profil.
 *
 * ─── Progressif, et borné ───────────────────────────────────────────────────
 *
 *   jours 0-1  discret    une ligne, ton neutre
 *   jour  2    visible    le décompte apparaît
 *   jours 3-4  dernier    dernier jour annoncé
 *   au-delà    permanent  le rappel reste, mais ne s'aggrave plus
 *
 * Il ne grandit jamais au-delà de « permanent », et il ne retire rien. Un
 * rappel qui devient une sanction n'est plus un rappel.
 *
 * ─── Pourquoi l'expiration ne bloque rien ───────────────────────────────────
 *
 * Aujourd'hui, personne d'autre que le bailleur ne voit sa photo : les policies
 * RLS isolent chaque compte, les locataires n'ont pas d'accès, et la photo ne
 * figure pas sur les quittances. Restreindre un compte au cinquième jour serait
 * donc un coût certain pour un bénéfice nul.
 *
 * Ce choix est à revoir le jour où l'espace locataire existera — c'est là que
 * la photo commencera à servir à quelqu'un d'autre qu'à son propriétaire, et
 * que l'absence de photo aura une conséquence réelle.
 */
export function BandeauPhoto({ bailleur }: { bailleur: Bailleur }) {
  const etat = etatIdentite(bailleur)
  const message = messageRappel(etat)

  if (!message) return null

  // Le ton suit l'insistance, sans jamais passer à l'alarme : il s'agit d'une
  // photo manquante, pas d'un incident.
  const discret = etat.rappel === 'discret'

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-md border-b px-lg py-sm sm:px-xl ${
        discret
          ? 'border-hairline bg-canvas text-mute'
          : 'border-warning-pale bg-warning-pale text-warning-content'
      }`}
    >
      <p className="text-caption">{message}</p>
      <Link
        href="/app/parametres/profil"
        className="shrink-0 text-caption font-semibold underline hover:no-underline"
      >
        Ajouter ma photo
      </Link>
    </div>
  )
}
