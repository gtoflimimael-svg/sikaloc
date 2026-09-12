'use client'

import { MessageCircle, Smartphone } from 'lucide-react'
import { useActionState, useEffect, useState } from 'react'

import { BoutonSoumettre } from '@/components/ui/boutons'
import { ChampCode } from '@/components/ui/champ-code'
import { Alerte } from '@/components/ui/retours'
import {
  demanderCodeTelephone,
  reprendreVerificationEmail,
  renvoyerCodeEmail,
  verifierCodeEmail,
  verifierCodeTelephoneAction,
} from '@/lib/actions/verification'
import {
  CANAUX_TELEPHONE,
  DELAI_RENVOI_SECONDES,
  LIBELLE_CANAL,
  VALIDITE_MINUTES,
  type CanalTelephone,
} from '@/lib/verification/regles'
import type { EtatFormulaire } from '@/lib/validation'

const ETAT_INITIAL: EtatFormulaire = {}

/**
 * Compte à rebours du renvoi.
 *
 * Il ne protège rien — le serveur applique le même délai, et c'est lui qui
 * décide. Il évite seulement de laisser cliquer sur un bouton qui répondra
 * « patientez », ce qui donne l'impression que l'application est cassée.
 */
function useCompteARebours(depart: number) {
  const [reste, setReste] = useState(depart)

  useEffect(() => {
    if (reste <= 0) return
    const minuteur = setTimeout(() => setReste((r) => r - 1), 1000)
    return () => clearTimeout(minuteur)
  }, [reste])

  return [reste, setReste] as const
}

/**
 * « Vous n'avez pas reçu le code ? »
 *
 * Le bouton est un vrai bouton de soumission du formulaire qui l'entoure. Une
 * version précédente appelait `requestSubmit()` depuis un `onClick` en
 * remontant au formulaire par `document.activeElement` : ça marchait, et ça
 * cassait au premier changement de balisage.
 */
function BoutonRenvoi({ reste }: { reste: number }) {
  return (
    <div className="mt-lg border-t border-hairline pt-lg text-center">
      <p className="text-body-sm text-mute">Vous n&apos;avez pas reçu le code ?</p>

      {reste > 0 ? (
        <p className="mt-xs text-body-sm text-mute-soft" aria-live="polite">
          Renvoyer le code dans {reste} s
        </p>
      ) : (
        <div className="mt-sm">
          <BoutonSoumettre variante="tertiary" compact libelleEnCours="Envoi…">
            Renvoyer le code
          </BoutonSoumettre>
        </div>
      )}
    </div>
  )
}

// ═══ Étape 1 — email ═════════════════════════════════════════════════════════

export function FormulaireCodeEmail({
  email,
  emailMasque,
}: {
  email: string
  emailMasque: string
}) {
  const [etat, action] = useActionState(verifierCodeEmail, ETAT_INITIAL)
  const [etatRenvoi, actionRenvoi] = useActionState(renvoyerCodeEmail, ETAT_INITIAL)
  const [reste, setReste] = useCompteARebours(DELAI_RENVOI_SECONDES)

  // Un renvoi accepté relance l'attente. Fait au rendu plutôt que dans un
  // effet : c'est une valeur dérivée d'une nouvelle réponse serveur.
  const [dernierRenvoi, setDernierRenvoi] = useState<string | undefined>(undefined)
  if (etatRenvoi.succes && etatRenvoi.succes !== dernierRenvoi) {
    setDernierRenvoi(etatRenvoi.succes)
    setReste(DELAI_RENVOI_SECONDES)
  }

  return (
    <div className="space-y-lg">
      <div>
        <h2 className="text-title-md font-semibold text-ink">
          Vérifiez votre adresse email
        </h2>
        <p className="mt-xs text-body-sm text-mute">
          Un code de vérification a été envoyé à{' '}
          <strong className="font-semibold text-ink">{emailMasque}</strong>. Il
          expire dans {VALIDITE_MINUTES} minutes.
        </p>
      </div>

      {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}
      {etatRenvoi.erreur ? <Alerte ton="attention">{etatRenvoi.erreur}</Alerte> : null}
      {etatRenvoi.succes ? <Alerte ton="succes">{etatRenvoi.succes}</Alerte> : null}

      <form action={action} className="space-y-lg">
        <input type="hidden" name="email" value={email} />

        <ChampCode
          libelle="Entrez le code reçu"
          erreur={etat.erreursChamps?.code}
          autoFocus
        />

        <BoutonSoumettre pleineLargeur libelleEnCours="Vérification…">
          Vérifier
        </BoutonSoumettre>
      </form>

      <form action={actionRenvoi}>
        <input type="hidden" name="email" value={email} />
        <BoutonRenvoi reste={reste} />
      </form>
    </div>
  )
}

// ═══ Étape 2 — téléphone ═════════════════════════════════════════════════════

export function FormulaireCodeTelephone({
  telephoneMasque,
  attenteInitiale,
  codeEnAttente,
  canauxDisponibles,
  exigences,
}: {
  telephoneMasque: string
  attenteInitiale: number
  /** Un code a déjà été demandé : on ouvre directement sur la saisie. */
  codeEnAttente: boolean
  canauxDisponibles: CanalTelephone[]
  /** Ce qu'il reste à configurer, par canal indisponible. */
  exigences: Record<string, string[]>
}) {
  const [etatDemande, actionDemande] = useActionState(demanderCodeTelephone, ETAT_INITIAL)
  const [etatVerif, actionVerif] = useActionState(
    verifierCodeTelephoneAction,
    ETAT_INITIAL,
  )
  const [reste, setReste] = useCompteARebours(attenteInitiale)
  const [canal, setCanal] = useState<CanalTelephone | null>(null)

  const [dernierEnvoi, setDernierEnvoi] = useState<string | undefined>(undefined)
  if (etatDemande.succes && etatDemande.succes !== dernierEnvoi) {
    setDernierEnvoi(etatDemande.succes)
    setReste(DELAI_RENVOI_SECONDES)
  }

  const codeDemande = codeEnAttente || Boolean(etatDemande.succes)
  const aucunCanal = canauxDisponibles.length === 0

  return (
    <div className="space-y-lg">
      <div>
        <h2 className="text-title-md font-semibold text-ink">
          Vérifiez votre numéro de téléphone
        </h2>
        <p className="mt-xs text-body-sm text-mute">
          Votre numéro :{' '}
          <strong className="font-semibold text-ink tabular-nums">
            {telephoneMasque}
          </strong>
        </p>
      </div>

      {etatDemande.erreur ? <Alerte ton="attention">{etatDemande.erreur}</Alerte> : null}
      {etatDemande.succes ? <Alerte ton="succes">{etatDemande.succes}</Alerte> : null}
      {etatVerif.erreur ? <Alerte ton="erreur">{etatVerif.erreur}</Alerte> : null}

      {/*
        Aucun canal configuré : on le dit franchement au lieu de présenter deux
        boutons qui échoueront. Le bailleur n'a rien à se reprocher et rien à
        réessayer.
      */}
      {aucunCanal ? (
        <Alerte ton="info">
          L&apos;envoi de codes par SMS et WhatsApp n&apos;est pas encore activé
          sur Sikaloc. Votre adresse email est vérifiée ; la vérification du
          numéro sera disponible très bientôt.
        </Alerte>
      ) : null}

      {/* ── Choix du canal ─────────────────────────────────────────────── */}
      {!aucunCanal ? (
        <form action={actionDemande} className="space-y-md">
          <p className="field-label">Comment souhaitez-vous recevoir votre code ?</p>

          <div className="flex gap-md">
            {CANAUX_TELEPHONE.map((c) => {
              const disponible = canauxDisponibles.includes(c)
              const choisi = canal === c

              return (
                <button
                  key={c}
                  type="button"
                  disabled={!disponible}
                  onClick={() => setCanal(c)}
                  aria-pressed={choisi}
                  className={`flex flex-1 flex-col items-center gap-xs rounded-md border p-md transition-colors ${
                    choisi
                      ? 'border-primary bg-canvas-sage'
                      : 'border-hairline bg-canvas hover:border-primary/40'
                  } ${disponible ? '' : 'cursor-not-allowed opacity-40'}`}
                >
                  {c === 'WHATSAPP' ? (
                    <MessageCircle size={20} strokeWidth={2} aria-hidden="true" />
                  ) : (
                    <Smartphone size={20} strokeWidth={2} aria-hidden="true" />
                  )}
                  <span className="text-body-sm font-semibold">{LIBELLE_CANAL[c]}</span>
                  {!disponible ? (
                    <span className="text-caption text-mute">Bientôt</span>
                  ) : null}
                </button>
              )
            })}
          </div>

          <input type="hidden" name="canal" value={canal ?? ''} />

          {reste > 0 && codeDemande ? (
            <p className="text-body-sm text-mute-soft" aria-live="polite">
              Renvoyer le code dans {reste} s
            </p>
          ) : (
            <BoutonSoumettre pleineLargeur libelleEnCours="Envoi…">
              {codeDemande ? 'Renvoyer le code' : 'Envoyer le code'}
            </BoutonSoumettre>
          )}
        </form>
      ) : null}

      {/* ── Saisie du code ─────────────────────────────────────────────── */}
      {codeDemande ? (
        <form action={actionVerif} className="space-y-lg border-t border-hairline pt-lg">
          <ChampCode
            libelle="Entrez le code reçu"
            erreur={etatVerif.erreursChamps?.code}
            autoFocus
          />

          <BoutonSoumettre pleineLargeur libelleEnCours="Vérification…">
            Vérifier
          </BoutonSoumettre>
        </form>
      ) : null}

      {/* Ce qui manque, écrit noir sur blanc plutôt que laissé à deviner. */}
      {aucunCanal && Object.keys(exigences).length > 0 ? (
        <details className="text-caption text-mute">
          <summary className="cursor-pointer">Pourquoi ?</summary>
          <ul className="mt-sm list-disc space-y-xs pl-lg">
            {Object.entries(exigences).flatMap(([c, liste]) =>
              liste.map((item, i) => (
                <li key={`${c}-${i}`}>
                  <strong>{LIBELLE_CANAL[c as CanalTelephone]}</strong> — {item}
                </li>
              )),
            )}
          </ul>
        </details>
      ) : null}
    </div>
  )
}

// ═══ Reprise sans session ════════════════════════════════════════════════════

/**
 * Quand on arrive sur `/verification` sans session ni trace de l'inscription.
 *
 * Le cas n'est pas rare : on ferme l'onglet, on revient le lendemain. Comme
 * l'email n'est pas encore confirmé, la connexion par mot de passe est refusée
 * par GoTrue — il faut donc un autre moyen de redemander un code, et ce moyen
 * ne peut être que l'adresse elle-même.
 *
 * La réponse est identique que le compte existe ou non : sinon ce formulaire
 * deviendrait un outil pour savoir qui est inscrit sur Sikaloc.
 */
export function FormulaireReprise() {
  const [etat, action] = useActionState(reprendreVerificationEmail, ETAT_INITIAL)

  return (
    <div className="space-y-lg">
      <div>
        <h2 className="text-title-md font-semibold text-ink">
          Reprenez votre vérification
        </h2>
        <p className="mt-xs text-body-sm text-mute">
          Indiquez l&apos;adresse email de votre compte : nous vous renvoyons un
          code de vérification.
        </p>
      </div>

      {etat.succes ? <Alerte ton="succes">{etat.succes}</Alerte> : null}
      {etat.erreur ? <Alerte ton="attention">{etat.erreur}</Alerte> : null}

      <form action={action} className="space-y-lg">
        <div>
          <label htmlFor="email" className="field-label">
            Adresse email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="vous@exemple.bj"
            required
            className="input mt-sm w-full"
          />
        </div>

        <BoutonSoumettre pleineLargeur libelleEnCours="Envoi…">
          Recevoir un code
        </BoutonSoumettre>
      </form>
    </div>
  )
}
