import { CalendarDays } from 'lucide-react'
import type { Metadata } from 'next'

import { BadgeLoyer } from '@/components/me/etat-loyer'
import { EnTetePage, EtatVide } from '@/components/ui/retours'
import { formaterDate, formaterFCFA, formaterPeriode } from '@/lib/format'
import {
  EXPLICATION_ETAT,
  mesBaux,
  mesEcheances,
  parAnneeDecroissante,
  sansEcheancesCalculees,
} from '@/lib/locataire'
import type { EcheanceLocataire } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Mes loyers' }

/**
 * Le relevé des loyers, mois par mois.
 *
 * ─── Les quatre états, montrés tels quels ───────────────────────────────────
 *
 * C'est le même calcul que celui du bailleur : la vue `v_echeances` décide, et
 * cet écran affiche. Un mois lu ici et lu depuis Sikaloc_Pro porte le même état
 * au même instant, parce qu'il n'y a qu'un seul calcul.
 *
 * ─── L'ordre est inversé par rapport à l'espace bailleur ────────────────────
 *
 * Année la plus récente en tête, et mois décroissants. Le bailleur descend une
 * liste pour retrouver ce qu'il doit réclamer ; le locataire cherche d'abord le
 * mois en cours, qui est en haut.
 */
export default async function PageLoyers() {
  const [baux, echeances] = await Promise.all([mesBaux(), mesEcheances()])

  return (
    <div className="space-y-2xl">
      <EnTetePage
        titre="Mes loyers"
        description="Chaque mois de votre bail, et ce que Sikaloc en sait."
      />

      {baux.map((bail) => {
        const duBail = echeances.filter((e) => e.bail_id === bail.bail_id)

        return (
          <section key={bail.bail_id} className="space-y-lg">
            {/*
              L'adresse n'est répétée que s'il y a plus d'un bail. Avec un seul
              logement, elle est déjà partout ailleurs et n'apporterait que du
              bruit.
            */}
            {baux.length > 1 ? (
              <h2 className="text-body-lg font-semibold text-ink">
                {bail.logement_adresse}
                <span className="ml-sm text-body-sm font-normal text-mute">
                  {bail.logement_ville}
                </span>
              </h2>
            ) : null}

            {duBail.length === 0 ? (
              <EtatVide
                icone={<CalendarDays size={32} strokeWidth={1.5} aria-hidden="true" />}
                titre={
                  sansEcheancesCalculees(bail)
                    ? 'Ce bail est résilié'
                    : 'Aucun mois à afficher'
                }
                description={
                  sansEcheancesCalculees(bail)
                    ? 'Les loyers ne sont plus calculés pour un bail résilié. Vos paiements et vos quittances restent consultables dans l’onglet « Mes paiements ».'
                    : 'Votre bail vient d’être enregistré : le premier mois apparaîtra ici dès qu’il commencera.'
                }
              />
            ) : (
              <TableauLoyers echeances={duBail} />
            )}
          </section>
        )
      })}

      {/* ── La légende ───────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-hairline bg-canvas p-xl">
        <h2 className="text-body-md font-semibold text-ink">Ce que veut dire chaque état</h2>
        <dl className="mt-lg space-y-md">
          {(['Réglé', 'À venir', 'Impayé', 'À déterminer'] as const).map((etat) => (
            <div key={etat} className="flex flex-col gap-xs sm:flex-row sm:gap-lg">
              <dt className="shrink-0 sm:w-[9rem]">
                <BadgeLoyer etat={etat} />
              </dt>
              <dd className="text-body-sm text-mute">{EXPLICATION_ETAT[etat]}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}

function TableauLoyers({ echeances }: { echeances: EcheanceLocataire[] }) {
  return (
    <div className="space-y-xl">
      {parAnneeDecroissante(echeances).map(({ annee, mois }) => (
        <div key={annee}>
          <h3 className="mb-sm text-body-sm font-semibold uppercase tracking-wide text-mute">
            {annee}
          </h3>

          <ul className="overflow-hidden rounded-xl border border-hairline bg-canvas">
            {mois.map((echeance) => (
              <li
                key={echeance.periode_debut}
                className="flex flex-wrap items-center justify-between gap-md border-b border-hairline-soft px-lg py-md last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-body-md font-semibold text-ink">
                    {formaterPeriode(echeance.periode_debut)}
                  </p>
                  <p className="text-caption text-mute">
                    Échéance le {formaterDate(echeance.date_echeance)}
                    {/*
                      Deux règles, et la seconde a été trouvée dans un
                      navigateur en comparant les deux espaces.

                      1. Le retard n'est affiché QUE sur un impayé. La vue le
                         calcule pour tous les mois échus, « à déterminer »
                         compris — écrire « 279 jours de retard » à côté d'un
                         état qui dit justement qu'on ne sait rien serait une
                         contradiction, et une accusation.

                      2. C'est le nombre BRUT de la vue, sans retrancher la
                         tolérance. L'écran du bailleur affiche celui-là ;
                         en soustraire trois jours ici aurait donné « 279 »
                         au locataire et « 282 » à son bailleur pour le même
                         mois. Un désaccord de trois jours entre deux écrans
                         du même produit est un litige en puissance.
                    */}
                    {echeance.etat === 'Impayé'
                      ? ` · ${echeance.jours_de_retard} jours de retard`
                      : null}
                  </p>
                </div>

                <div className="flex items-center gap-lg">
                  <div className="text-right">
                    <p className="text-body-md font-semibold tabular text-ink">
                      {formaterFCFA(echeance.loyer_mensuel)}
                    </p>
                    {Number(echeance.montant_paye) > 0 &&
                    Number(echeance.montant_du) > 0 ? (
                      /* Un versement partiel : dire ce qui reste, sinon le
                         montant affiché passerait pour la totalité due. */
                      <p className="text-caption text-mute">
                        {formaterFCFA(echeance.montant_paye)} versés · reste{' '}
                        {formaterFCFA(echeance.montant_du)}
                      </p>
                    ) : null}
                  </div>
                  <BadgeLoyer etat={echeance.etat} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
