'use client'

import { Eye, EyeOff } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

import { LIBELLES, LONGUEUR_MINIMALE, type ForceMotDePasse } from '@/lib/mot-de-passe'

/**
 * Champ mot de passe — bascule d'affichage et, en option, jauge de robustesse.
 *
 * ─── Gestionnaires de mots de passe ────────────────────────────────────────
 *
 * `autocomplete` est ce qui décide de leur comportement, et il n'y a que deux
 * valeurs utiles ici : `new-password` déclenche la proposition d'un mot de passe
 * fort et l'enregistrement, `current-password` déclenche le remplissage des
 * identifiants déjà connus. Se tromper de valeur, ou n'en mettre aucune, et le
 * gestionnaire cesse d'aider — ou pire, remplit le mauvais champ.
 *
 * Sikaloc ne stocke aucun mot de passe : le hachage bcrypt vit dans `auth.users`
 * et n'est jamais lu par l'application. Ce champ n'est qu'un `<input>`.
 *
 * ─── La jauge ──────────────────────────────────────────────────────────────
 *
 * Elle n'est montrée qu'à la saisie d'un *nouveau* mot de passe : sur un écran
 * de connexion, évaluer la force de ce que l'on tape n'apprend rien et signale
 * surtout à qui regarde par-dessus l'épaule combien il en reste.
 *
 * Le moteur de mesure (zxcvbn et ses dictionnaires, ~1 Mo) est chargé **à la
 * demande**, à la première frappe. Une page de connexion ouverte depuis un
 * téléphone à Cotonou ne le télécharge jamais.
 *
 * Ce que la jauge dit n'engage rien : le serveur repasse la même mesure à
 * l'envoi. Elle sert à corriger avant d'être refusé, pas à autoriser.
 */

type Evaluateur = (valeur: string, contexte: string[]) => ForceMotDePasse

/** Laisse finir de taper avant de mesurer : zxcvbn coûte cher sur mobile. */
const DELAI_MESURE_MS = 180

export function ChampMotDePasse({
  nom,
  libelle,
  erreur,
  aide,
  requis,
  autoComplete = 'new-password',
  jauge = false,
  placeholder,
  contexteDepuis,
}: {
  nom: string
  libelle: string
  erreur?: string
  aide?: string
  requis?: boolean
  /** `new-password` à la création, `current-password` à la connexion. */
  autoComplete?: 'new-password' | 'current-password'
  /** Affiche la jauge de robustesse. */
  jauge?: boolean
  placeholder?: string
  /**
   * Noms des champs du même formulaire à passer en indices à la mesure.
   *
   * Lus dans le DOM au moment de mesurer, et non par un état React : les autres
   * champs de Sikaloc sont non contrôlés, et c'est aussi ce qui permet de voir
   * une valeur posée par un gestionnaire de mots de passe.
   */
  contexteDepuis?: string[]
}) {
  const [valeur, setValeur] = useState('')
  const [visible, setVisible] = useState(false)
  const [force, setForce] = useState<ForceMotDePasse | null>(null)
  const champ = useRef<HTMLInputElement>(null)
  const evaluateur = useRef<Evaluateur | null>(null)
  const idRetour = useId()

  /** Indices tirés des champs voisins, à l'instant de la mesure. */
  const indices = useCallback((): string[] => {
    const formulaire = champ.current?.form
    if (!formulaire || !contexteDepuis) return []

    return contexteDepuis
      .map((autre) => (formulaire.elements.namedItem(autre) as HTMLInputElement | null)?.value ?? '')
      .filter(Boolean)
  }, [contexteDepuis])

  const mesurer = useCallback(
    async (saisie: string) => {
      if (!jauge) return

      if (saisie.length === 0) {
        setForce(null)
        return
      }

      if (!evaluateur.current) {
        const mesure = await import('@/lib/mot-de-passe-evaluation')
        evaluateur.current = mesure.evaluerMotDePasse
      }

      setForce(evaluateur.current(saisie, indices()))
    },
    [jauge, indices],
  )

  /**
   * Un gestionnaire de mots de passe remplit le champ sans passer par React.
   * On relit donc la valeur réelle après le montage : sans cela, la jauge
   * resterait vide devant un champ visiblement rempli.
   */
  useEffect(() => {
    const rempli = champ.current?.value
    if (rempli) {
      setValeur(rempli)
      void mesurer(rempli)
    }
    // Au montage seulement : ensuite, `onChange` suffit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!jauge || valeur.length === 0) return

    const minuterie = setTimeout(() => void mesurer(valeur), DELAI_MESURE_MS)
    return () => clearTimeout(minuterie)
  }, [valeur, jauge, mesurer])

  const montrerJauge = jauge && valeur.length > 0
  const niveau = force?.niveau ?? 0

  return (
    <div>
      <label htmlFor={nom} className="field-label">
        {libelle}
        {requis ? <span className="text-negative"> *</span> : null}
      </label>

      <div className="relative">
        <input
          ref={champ}
          id={nom}
          name={nom}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={requis}
          // `minLength` fait partie du contrat que lisent les gestionnaires de
          // mots de passe pour composer une proposition acceptable du premier coup.
          minLength={autoComplete === 'new-password' ? LONGUEUR_MINIMALE : undefined}
          value={valeur}
          onChange={(e) => setValeur(e.target.value)}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={montrerJauge ? idRetour : undefined}
          className="input pr-[44px]"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          className="absolute right-xs top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-mute transition-colors hover:bg-surface-elevated hover:text-ink"
        >
          {visible ? (
            <EyeOff size={17} strokeWidth={1.9} aria-hidden="true" />
          ) : (
            <Eye size={17} strokeWidth={1.9} aria-hidden="true" />
          )}
        </button>
      </div>

      {montrerJauge ? (
        <div className="mt-sm anim-apparait" id={idRetour}>
          <div className="flex items-center gap-sm">
            {/* Quatre segments pour cinq paliers : « Très faible » n'en allume
                aucun, ce qui se lit mieux qu'un segment rouge esseulé. */}
            <span
              className="flex h-1.5 flex-1 gap-xxs overflow-hidden rounded-pill"
              aria-hidden="true"
            >
              {[0, 1, 2, 3].map((segment) => (
                <span
                  key={segment}
                  className={`flex-1 rounded-pill transition-colors duration-300 ${
                    segment < niveau ? TON_BARRE[niveau] : 'bg-hairline'
                  }`}
                />
              ))}
            </span>
            <span
              role="status"
              className={`shrink-0 text-caption font-semibold ${TON_TEXTE[niveau]}`}
            >
              {force ? force.libelle : 'Analyse…'}
            </span>
          </div>

          {force?.tropCourt ? (
            <p className="mt-xs text-caption text-mute">
              Encore {LONGUEUR_MINIMALE - valeur.length} caractère
              {LONGUEUR_MINIMALE - valeur.length > 1 ? 's' : ''} au minimum.
            </p>
          ) : null}

          {force?.avertissement ? (
            <p className="mt-xs text-caption text-warning-content">{force.avertissement}</p>
          ) : null}

          {force?.conseils.map((conseil) => (
            <p key={conseil} className="mt-xxs text-caption text-mute">
              {conseil}
            </p>
          ))}

          {force?.acceptable && !force.avertissement ? (
            <p className="mt-xs text-caption text-positive-deep">
              {force.niveau === 4
                ? 'Excellent — pensez à l’enregistrer dans votre gestionnaire de mots de passe.'
                : 'Ce mot de passe convient.'}
            </p>
          ) : null}
        </div>
      ) : null}

      {aide && !erreur && !montrerJauge ? <p className="field-hint">{aide}</p> : null}
      {erreur ? (
        <p className="field-error" role="alert">
          {erreur}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Les cinq paliers de zxcvbn, repris tels quels — la jauge ne réinterprète pas
 * le score. `LIBELLES` vit dans `@/lib/mot-de-passe` pour que le serveur nomme
 * les mêmes niveaux de la même façon.
 */
const TON_BARRE: Record<number, string> = {
  0: 'bg-negative',
  1: 'bg-negative',
  2: 'bg-warning',
  3: 'bg-positive',
  4: 'bg-positive',
}

const TON_TEXTE: Record<number, string> = {
  0: 'text-negative-darkest',
  1: 'text-negative-darkest',
  2: 'text-warning-content',
  3: 'text-positive-deep',
  4: 'text-positive-deep',
}

// Garde-fou : si un palier disparaissait de `LIBELLES`, la jauge afficherait
// « undefined ». Le compilateur le dira ici plutôt que l'utilisateur en production.
const _paliersCouverts: Record<keyof typeof LIBELLES, string> = TON_BARRE
void _paliersCouverts
