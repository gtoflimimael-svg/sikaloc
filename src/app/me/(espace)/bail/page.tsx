import { Phone } from 'lucide-react'
import type { Metadata } from 'next'

import { Badge, EnTetePage } from '@/components/ui/retours'
import { formaterDate, formaterFCFA } from '@/lib/format'
import { mesBaux } from '@/lib/locataire'
import { formaterTelephone } from '@/lib/telephone'
import type { BailLocataire } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Mon bail' }

/**
 * Les termes du bail, tels qu'ils sont enregistrés.
 *
 * ─── Ce que cet écran est, et ce qu'il n'est pas ────────────────────────────
 *
 * C'est le reflet de ce que le bailleur a saisi dans Sikaloc. Ce n'est pas le
 * contrat : le contrat est le document signé entre les deux parties, et Sikaloc
 * n'en détient pas de copie. La page le dit, plutôt que de laisser croire qu'un
 * loyer affiché ici fait foi contre un papier signé.
 *
 * ─── Rien n'est modifiable ──────────────────────────────────────────────────
 *
 * Aucun formulaire, et pas seulement à l'écran : la surface d'accès du
 * locataire n'a aucun chemin d'écriture. Une valeur fausse se corrige auprès du
 * bailleur, qui est nommé et joignable en bas de page.
 */
export default async function PageBail() {
  const baux = await mesBaux()

  return (
    <div className="space-y-xl">
      <EnTetePage
        titre={baux.length > 1 ? 'Mes baux' : 'Mon bail'}
        description="Les termes enregistrés par votre bailleur."
      />

      {baux.map((bail) => (
        <CarteDetail key={bail.bail_id} bail={bail} />
      ))}

      <p className="text-body-sm text-mute">
        Ces informations sont celles saisies dans Sikaloc par votre bailleur.
        Elles ne remplacent pas votre contrat de bail signé. Si une valeur ne
        correspond pas, signalez-la : seul votre bailleur peut la corriger.
      </p>
    </div>
  )
}

function CarteDetail({ bail }: { bail: BailLocataire }) {
  return (
    <section className="overflow-hidden rounded-xl border border-hairline bg-canvas">
      <header className="flex flex-wrap items-start justify-between gap-md border-b border-hairline p-xl">
        <div className="min-w-0">
          <p className="text-display-xs font-semibold text-ink">{bail.logement_adresse}</p>
          <p className="text-body-sm text-mute">
            {bail.logement_type} · {bail.logement_ville}, {bail.logement_pays}
          </p>
        </div>
        <Badge ton={bail.statut === 'Actif' ? 'positive' : 'neutral'}>{bail.statut}</Badge>
      </header>

      <dl className="divide-y divide-hairline-soft">
        <Ligne terme="Locataire" definition={bail.locataire_nom} />
        <Ligne terme="Loyer mensuel" definition={formaterFCFA(bail.loyer_mensuel)} />
        <Ligne
          terme="Jour d’échéance"
          definition={`Le ${bail.jour_echeance} de chaque mois`}
        />
        <Ligne
          terme="Tolérance"
          definition={
            bail.tolerance_jours > 0
              ? `${bail.tolerance_jours} jour${bail.tolerance_jours > 1 ? 's' : ''} après l’échéance`
              : 'Aucune'
          }
        />
        <Ligne terme="Début du bail" definition={formaterDate(bail.date_debut)} />
        <Ligne
          terme="Fin du bail"
          // Un bail sans date de fin est la règle au Bénin, pas une donnée
          // manquante. Afficher « — » laisserait croire à un oubli de saisie.
          definition={bail.date_fin ? formaterDate(bail.date_fin) : 'Non précisée'}
        />
        {bail.depot_garantie ? (
          <Ligne terme="Dépôt de garantie" definition={formaterFCFA(bail.depot_garantie)} />
        ) : null}
      </dl>

      <footer className="flex flex-wrap items-center justify-between gap-md border-t border-hairline bg-canvas-soft p-xl">
        <div>
          <p className="text-caption uppercase tracking-wide text-mute">Votre bailleur</p>
          <p className="mt-xxs text-body-md font-semibold text-ink">{bail.bailleur_nom}</p>
        </div>
        <a href={`tel:${bail.bailleur_telephone}`} className="btn btn-secondary btn-sm">
          <Phone size={15} strokeWidth={2} aria-hidden="true" />
          {formaterTelephone(bail.bailleur_telephone)}
        </a>
      </footer>
    </section>
  )
}

function Ligne({ terme, definition }: { terme: string; definition: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-md px-xl py-md">
      <dt className="text-body-sm text-mute">{terme}</dt>
      <dd className="text-right text-body-md font-semibold tabular text-ink">{definition}</dd>
    </div>
  )
}
