'use client'

import { AlertTriangle, Check } from 'lucide-react'
import { useActionState, useState } from 'react'

import { BoutonSoumettre } from '@/components/ui/boutons'
import { Alerte } from '@/components/ui/retours'
import { declarerHistorique } from '@/lib/actions/historique'
import { parAnnee, totalDu } from '@/lib/echeances'
import { formaterFCFA, formaterPeriode } from '@/lib/format'
import type { Echeance } from '@/lib/types/database'
import type { EtatFormulaire } from '@/lib/validation'

const ETAT_INITIAL: EtatFormulaire = {}

/**
 * Déclaration des loyers déjà réglés avant Sikaloc.
 *
 * ─── Deux temps, et le second n'est pas décoratif ───────────────────────────
 *
 * On coche, puis on relit. Le récapitulatif montre les deux listes côte à
 * côte — ce qui sera tenu pour réglé, et ce qui sera tenu pour impayé — parce
 * que c'est la seconde qui engage : ce sont les mois qui apparaîtront dans
 * l'écran des relances, d'où part un message au locataire.
 *
 * Une case oubliée ne produit pas une donnée manquante : elle produit une
 * réclamation. Le récapitulatif existe pour ça.
 *
 * ─── Rien n'est coché d'avance ──────────────────────────────────────────────
 *
 * Pré-cocher tous les mois ferait du « tout est réglé » la réponse par défaut,
 * obtenue sans la lire. La déclaration doit venir du bailleur, pas de nous.
 */
export function FormulaireHistorique({
  bailId,
  echeances,
  loyerMensuel,
}: {
  bailId: string
  /** Les échéances antérieures non réglées, dans l'ordre. */
  echeances: Echeance[]
  loyerMensuel: number
}) {
  const action = declarerHistorique.bind(null, bailId)
  const [etat, envoyer] = useActionState(action, ETAT_INITIAL)

  const [coches, setCoches] = useState<Set<string>>(new Set())
  const [relecture, setRelecture] = useState(false)

  const basculer = (periode: string) => {
    setCoches((precedent) => {
      const suivant = new Set(precedent)
      if (suivant.has(periode)) suivant.delete(periode)
      else suivant.add(periode)
      return suivant
    })
  }

  const regles = echeances.filter((e) => coches.has(e.periode_debut))
  const impayes = echeances.filter((e) => !coches.has(e.periode_debut))
  const annees = parAnnee(echeances)
  const toutCoche = coches.size === echeances.length

  // ═══ Temps 2 — relecture ═══════════════════════════════════════════════════
  if (relecture) {
    return (
      <form action={envoyer} className="space-y-xl">
        {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}

        <div>
          <h2 className="text-title-md font-semibold text-ink">
            Vérification de l’historique
          </h2>
          <p className="mt-xs text-body-sm text-mute">
            Relisez avant d’enregistrer : les mois de droite apparaîtront dans
            vos loyers en retard, et c’est de là que partent les relances.
          </p>
        </div>

        <div className="grid gap-lg sm:grid-cols-2">
          <section className="rounded-md border border-positive/30 bg-positive-pale p-lg">
            <p className="text-caption font-semibold uppercase tracking-wide text-positive-deep">
              Déjà réglés · {regles.length}
            </p>
            {regles.length === 0 ? (
              <p className="mt-sm text-body-sm text-positive-deep">
                Aucun mois déclaré comme réglé.
              </p>
            ) : (
              <ul className="mt-sm space-y-xxs">
                {regles.map((e) => (
                  <li
                    key={e.periode_debut}
                    className="flex items-center gap-xs text-body-sm text-positive-deep"
                  >
                    <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                    {formaterPeriode(e.periode_debut)}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-md border border-negative/30 bg-negative/10 p-lg">
            <p className="text-caption font-semibold uppercase tracking-wide text-negative-darkest">
              Seront en retard · {impayes.length}
            </p>
            {impayes.length === 0 ? (
              <p className="mt-sm text-body-sm text-negative-darkest">
                Aucun loyer en retard. Rien ne sera réclamé.
              </p>
            ) : (
              <>
                <ul className="mt-sm space-y-xxs">
                  {impayes.map((e) => (
                    <li
                      key={e.periode_debut}
                      className="flex items-center gap-xs text-body-sm text-negative-darkest"
                    >
                      <AlertTriangle size={14} strokeWidth={2.5} aria-hidden="true" />
                      {formaterPeriode(e.periode_debut)}
                    </li>
                  ))}
                </ul>
                <p className="mt-md text-body-sm font-semibold tabular text-negative-darkest">
                  {formaterFCFA(totalDu(impayes))} à recouvrer
                </p>
              </>
            )}
          </section>
        </div>

        {/* Ce que le serveur relira : les mois cochés, et rien d'autre. */}
        {regles.map((e) => (
          <input key={e.periode_debut} type="hidden" name="mois" value={e.periode_debut} />
        ))}

        <div className="flex flex-wrap gap-md">
          <BoutonSoumettre libelleEnCours="Enregistrement…">
            Confirmer l’historique
          </BoutonSoumettre>
          <button
            type="button"
            onClick={() => setRelecture(false)}
            className="btn btn-secondary"
          >
            Modifier
          </button>
        </div>
      </form>
    )
  }

  // ═══ Temps 1 — sélection ═══════════════════════════════════════════════════
  return (
    <div className="space-y-xl">
      {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}

      <div className="flex flex-wrap items-baseline justify-between gap-md">
        <p className="text-body-sm text-mute">
          {echeances.length} mois à renseigner ·{' '}
          <strong className="text-ink">{formaterFCFA(loyerMensuel)}</strong> par mois
        </p>

        <button
          type="button"
          onClick={() =>
            setCoches(
              toutCoche ? new Set() : new Set(echeances.map((e) => e.periode_debut)),
            )
          }
          className="text-body-sm font-semibold text-primary underline"
        >
          {toutCoche ? 'Tout décocher' : 'Tout cocher'}
        </button>
      </div>

      {annees.map(({ annee, mois }) => (
        <section key={annee}>
          {annees.length > 1 ? (
            <h3 className="mb-md text-caption font-semibold uppercase tracking-wide text-mute">
              {annee}
            </h3>
          ) : null}

          {/*
            Deux colonnes dès l'écran moyen, une seule sur téléphone : une case
            à cocher doit rester atteignable au pouce.
          */}
          <ul className="grid gap-sm sm:grid-cols-2">
            {mois.map((e) => {
              const coche = coches.has(e.periode_debut)

              return (
                <li key={e.periode_debut}>
                  <label
                    className={`flex cursor-pointer items-center gap-md rounded-md border p-md transition-colors ${
                      coche
                        ? 'border-positive bg-positive-pale'
                        : 'border-hairline bg-canvas hover:border-primary/40'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={coche}
                      onChange={() => basculer(e.periode_debut)}
                      className="size-5 shrink-0 accent-primary"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-body-md font-semibold text-ink">
                        {formaterPeriode(e.periode_debut)}
                      </span>
                      <span className="block text-caption text-mute">
                        {coche ? 'Réglé' : 'Sera compté en retard'}
                      </span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <div className="flex flex-wrap gap-md border-t border-hairline pt-lg">
        <button
          type="button"
          onClick={() => setRelecture(true)}
          className="btn btn-primary"
        >
          Continuer
        </button>
      </div>
    </div>
  )
}
