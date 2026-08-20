'use client'

import { Check, Eye, EyeOff, X } from 'lucide-react'
import { useId, useState } from 'react'

import { CRITERES, evaluer } from '@/lib/mot-de-passe'

/**
 * Champ mot de passe — bascule d'affichage et, en option, jauge de robustesse.
 *
 * La jauge n'est montrée qu'à la saisie d'un *nouveau* mot de passe : sur un
 * écran de connexion, évaluer la force de ce que l'on tape n'apporte rien et
 * signale surtout à qui regarde par-dessus l'épaule combien il en reste.
 */
export function ChampMotDePasse({
  nom,
  libelle,
  erreur,
  aide,
  requis,
  autoComplete = 'new-password',
  jauge = false,
  placeholder,
}: {
  nom: string
  libelle: string
  erreur?: string
  aide?: string
  requis?: boolean
  autoComplete?: string
  /** Affiche la jauge et la liste des critères. */
  jauge?: boolean
  placeholder?: string
}) {
  const [valeur, setValeur] = useState('')
  const [visible, setVisible] = useState(false)
  const idCriteres = useId()

  const force = jauge ? evaluer(valeur) : null
  const montrerJauge = force !== null && valeur.length > 0

  return (
    <div>
      <label htmlFor={nom} className="field-label">
        {libelle}
        {requis ? <span className="text-negative"> *</span> : null}
      </label>

      <div className="relative">
        <input
          id={nom}
          name={nom}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={requis}
          value={valeur}
          onChange={(e) => setValeur(e.target.value)}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={jauge ? idCriteres : undefined}
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
        <div className="mt-sm anim-apparait" id={idCriteres}>
          <div className="flex items-center gap-sm">
            <span
              className="flex h-1.5 flex-1 gap-xxs overflow-hidden rounded-pill"
              aria-hidden="true"
            >
              {[0, 1, 2, 3].map((segment) => (
                <span
                  key={segment}
                  className={`flex-1 rounded-pill transition-colors duration-300 ${
                    segment < force.niveau ? TON_BARRE[force.niveau] : 'bg-hairline'
                  }`}
                />
              ))}
            </span>
            <span
              role="status"
              className={`shrink-0 text-caption font-semibold ${TON_TEXTE[force.niveau]}`}
            >
              {force.libelle}
            </span>
          </div>

          <ul className="mt-sm grid gap-xxs sm:grid-cols-2">
            {CRITERES.map((critere) => {
              const ok = critere.satisfait(valeur)

              return (
                <li
                  key={critere.cle}
                  className={`flex items-center gap-xs text-caption ${
                    ok ? 'text-positive-deep' : critere.obligatoire ? 'text-mute' : 'text-mute-soft'
                  }`}
                >
                  {ok ? (
                    <Check size={13} strokeWidth={2.5} aria-hidden="true" className="shrink-0" />
                  ) : (
                    <X size={13} strokeWidth={2} aria-hidden="true" className="shrink-0 opacity-50" />
                  )}
                  <span>
                    {critere.libelle}
                    {critere.obligatoire ? '' : ' (conseillé)'}
                  </span>
                </li>
              )
            })}
          </ul>

          {force.previsible ? (
            <p className="field-error">
              Ce mot de passe est trop courant ou trop régulier : il figure parmi
              les premiers essayés lors d’une attaque.
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
