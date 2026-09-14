import { Check, Circle } from 'lucide-react'

import { etapesRestantes, type EtatVerification } from '@/lib/verification/regles'

/**
 * Où en est la vérification — et le compte de ce qui reste.
 *
 * L'indicateur reste affiché pendant tout le parcours, y compris à l'étape
 * téléphone : savoir qu'il ne reste qu'une chose à faire change la disposition
 * à la faire.
 *
 * ─── Le téléphone ne concerne pas tout le monde ─────────────────────────────
 *
 * Un locataire arrive par une invitation : son bailleur détient déjà son
 * numéro, et Sikaloc ne le lui redemandera jamais. Lui afficher « Téléphone
 * pas encore vérifié · 1 étape restante » lui annonce une étape qui ne
 * viendra pas — et laisse croire que son compte est incomplet alors qu'il est
 * prêt.
 *
 * Trouvé en parcourant l'inscription d'un locataire de bout en bout dans un
 * navigateur : depuis le code, l'écran paraissait juste.
 */
export function ProgressionVerification({
  etat,
  courante,
  telephoneConcerne = true,
}: {
  etat: EtatVerification
  courante?: 'email' | 'telephone' | null
  /** Faux pour un compte locataire : l'étape téléphone n'existe pas pour lui. */
  telephoneConcerne?: boolean
}) {
  const restantes = telephoneConcerne
    ? etapesRestantes(etat)
    : etat.emailVerifie
      ? 0
      : 1

  const lignes = [
    { cle: 'email' as const, libelle: 'Email', fait: etat.emailVerifie },
    ...(telephoneConcerne
      ? [{ cle: 'telephone' as const, libelle: 'Téléphone', fait: etat.telephoneVerifie }]
      : []),
  ]

  return (
    <div className="rounded-md border border-hairline bg-canvas-soft p-lg">
      <p className="text-caption font-semibold uppercase tracking-wide text-mute">
        Vérification de votre compte
      </p>

      <ul className="mt-md space-y-sm">
        {lignes.map((ligne) => (
          <li key={ligne.cle} className="flex items-center gap-sm text-body-sm">
            {ligne.fait ? (
              <span
                aria-hidden="true"
                className="flex size-5 shrink-0 items-center justify-center rounded-pill bg-positive text-canvas"
              >
                <Check size={13} strokeWidth={3} />
              </span>
            ) : (
              <Circle
                size={20}
                strokeWidth={1.5}
                aria-hidden="true"
                className={`shrink-0 ${
                  courante === ligne.cle ? 'text-primary' : 'text-hairline'
                }`}
              />
            )}

            <span
              className={
                ligne.fait
                  ? 'text-body'
                  : courante === ligne.cle
                    ? 'font-semibold text-ink'
                    : 'text-mute'
              }
            >
              {ligne.libelle}
            </span>

            <span className="sr-only">
              {ligne.fait ? ' vérifié' : ' pas encore vérifié'}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-md text-caption text-mute" aria-live="polite">
        {restantes === 0
          ? 'Votre compte est vérifié.'
          : `${restantes} étape${restantes > 1 ? 's' : ''} restante${restantes > 1 ? 's' : ''}.`}
      </p>
    </div>
  )
}
