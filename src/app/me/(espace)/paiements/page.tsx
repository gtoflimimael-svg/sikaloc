import { Banknote, Download } from 'lucide-react'
import type { Metadata } from 'next'

import { EnTetePage, EtatVide } from '@/components/ui/retours'
import { formaterDate, formaterFCFA, formaterPeriode } from '@/lib/format'
import { mesBaux, mesPaiements } from '@/lib/locataire'
import type { BailLocataire, PaiementLocataire } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Mes paiements' }

/**
 * L'historique des versements, et les quittances qui vont avec.
 *
 * ─── Une seule liste, pas deux ──────────────────────────────────────────────
 *
 * Une quittance appartient à un paiement — la base impose un document par
 * versement. Deux onglets, « mes paiements » et « mes quittances », auraient
 * montré la même chose deux fois, avec le risque de ne pas la raconter pareil.
 *
 * ─── Ce que le locataire ne voit pas ────────────────────────────────────────
 *
 * Les brouillons du bailleur. Un versement qu'il a commencé à saisir sans le
 * valider n'est pas un fait : l'afficher ferait croire qu'il est enregistré.
 * Le filtre est en base, dans `mes_paiements()`, pas ici.
 */
export default async function PagePaiements() {
  const [baux, paiements] = await Promise.all([mesBaux(), mesPaiements()])

  const adresses = new Map(baux.map((b) => [b.bail_id, b]))

  return (
    <div className="space-y-xl">
      <EnTetePage
        titre="Mes paiements"
        description="Tout ce que votre bailleur a enregistré, et les quittances émises."
      />

      {paiements.length === 0 ? (
        <EtatVide
          icone={<Banknote size={32} strokeWidth={1.5} aria-hidden="true" />}
          titre="Aucun paiement enregistré"
          description="Dès que votre bailleur enregistrera un versement, il apparaîtra ici avec sa quittance."
        />
      ) : (
        <ul className="space-y-md">
          {paiements.map((paiement) => (
            <LignePaiement
              key={paiement.paiement_id}
              paiement={paiement}
              bail={adresses.get(paiement.bail_id) ?? null}
              montrerAdresse={baux.length > 1}
            />
          ))}
        </ul>
      )}

      <p className="text-body-sm text-mute">
        Une quittance manque, ou un montant ne correspond pas ? Seul votre
        bailleur peut corriger un paiement. Sikaloc_Me affiche ce qu’il a
        enregistré, sans le modifier.
      </p>
    </div>
  )
}

function LignePaiement({
  paiement,
  bail,
  montrerAdresse,
}: {
  paiement: PaiementLocataire
  bail: BailLocataire | null
  montrerAdresse: boolean
}) {
  return (
    <li className="rounded-xl border border-hairline bg-canvas p-lg">
      <div className="flex flex-wrap items-start justify-between gap-md">
        <div className="min-w-0">
          <p className="text-body-md font-semibold text-ink">
            {formaterPeriode(paiement.periode_debut)}
            {paiement.type_paiement !== 'Loyer' ? (
              <span className="ml-sm text-body-sm font-normal text-mute">
                {paiement.type_paiement}
              </span>
            ) : null}
          </p>

          <p className="mt-xxs text-body-sm text-mute">
            {/*
              Un paiement historique n'a pas de date d'encaissement : le
              bailleur a déclaré « ce mois est réglé », sans dire quel jour.
              Écrire une date ici — celle du jour, celle de l'échéance —
              affirmerait un encaissement qui n'a pas eu lieu ce jour-là.
            */}
            {paiement.date_paiement
              ? `Versé le ${formaterDate(paiement.date_paiement)}`
              : 'Date de versement non précisée'}
            {' · '}
            {paiement.mode_paiement}
            {paiement.est_partiel ? ' · versement partiel' : null}
          </p>

          {montrerAdresse && bail ? (
            <p className="mt-xxs text-caption text-mute-soft">{bail.logement_adresse}</p>
          ) : null}
        </div>

        <p className="text-display-xs font-extrabold tabular text-ink">
          {formaterFCFA(paiement.montant)}
        </p>
      </div>

      {/* ── Le document ──────────────────────────────────────────────────── */}
      <div className="mt-lg flex flex-wrap items-center justify-between gap-md border-t border-hairline pt-md">
        {paiement.quittance_id && paiement.quittance_telechargeable ? (
          <>
            <p className="text-body-sm text-mute">
              {paiement.quittance_type} n° {paiement.quittance_numero}
            </p>
            <a
              href={`/api/quittances/${paiement.quittance_id}/pdf`}
              className="btn btn-tertiary btn-sm"
              download
            >
              <Download size={15} strokeWidth={2} aria-hidden="true" />
              Télécharger
            </a>
          </>
        ) : paiement.quittance_id ? (
          /*
            La quittance a existé, son fichier n'est plus là.
            `prive.purger_donnees_personnelles()` — la purge qui suit 90 jours
            d'impayé d'abonnement du bailleur — efface le PDF et laisse la ligne.

            Proposer « Télécharger » ici mènerait droit à une erreur, et le
            locataire réessaierait en croyant à une panne passagère. On nomme le
            document, on dit qu'il n'est plus là, et on n'invente rien.
          */
          <p className="text-body-sm text-mute">
            {paiement.quittance_type} n° {paiement.quittance_numero} — le
            fichier n’est plus disponible au téléchargement.
          </p>
        ) : paiement.historique ? (
          /*
            Aucune quittance n'est émise pour un loyer réglé avant Sikaloc, et
            c'est volontaire : Sikaloc n'a pas assisté à cet encaissement et ne
            peut donc rien attester. Le dire vaut mieux que laisser un vide qui
            passerait pour un oubli du bailleur.
          */
          <p className="text-body-sm text-mute">
            Loyer réglé avant que votre bailleur n’utilise Sikaloc. Aucune
            quittance n’est émise pour ces mois — Sikaloc n’a pas assisté au
            versement.
          </p>
        ) : (
          <p className="text-body-sm text-mute">
            Quittance pas encore émise. Vous pouvez la demander à votre bailleur.
          </p>
        )}
      </div>
    </li>
  )
}
