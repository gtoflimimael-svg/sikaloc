'use client'

import { useEffect, useId, useRef, useState } from 'react'

import { LONGUEUR_CODE } from '@/lib/verification/regles'

/**
 * Saisie d'un code à six chiffres, une case par chiffre.
 *
 * ─── Pourquoi six cases et pas un champ ─────────────────────────────────────
 *
 * Parce qu'on recopie un code en le lisant, et que les cases disent où on en
 * est sans avoir à recompter. C'est aussi ce que font les claviers de
 * téléphone : un champ unique de six chiffres se trompe d'une frappe sans que
 * rien ne le signale.
 *
 * ─── Ce qui se casse d'habitude, et qui est traité ici ──────────────────────
 *
 *   · Le collage. Coller « 482731 » dans la première case doit remplir les
 *     six, pas mettre « 482731 » dans une case de largeur 1.
 *   · Le retour arrière sur une case vide doit reculer d'une case, sinon on
 *     reste coincé.
 *   · La suggestion du système (iOS et Android proposent le code du SMS) doit
 *     fonctionner : `autoComplete="one-time-code"` sur la première case, et
 *     un remplissage automatique qui s'étale sur les suivantes.
 *
 * La valeur postée vient d'un champ caché : le formulaire reçoit « 482731 » et
 * non six valeurs séparées.
 */
export function ChampCode({
  nom = 'code',
  libelle,
  erreur,
  autoFocus,
}: {
  nom?: string
  libelle: string
  erreur?: string
  autoFocus?: boolean
}) {
  const [chiffres, setChiffres] = useState<string[]>(() =>
    Array.from({ length: LONGUEUR_CODE }, () => ''),
  )
  const cases = useRef<Array<HTMLInputElement | null>>([])
  const idErreur = useId()

  // Le focus initial est posé après le montage : `autoFocus` en attribut est
  // ignoré par certains navigateurs sur un élément rendu côté serveur.
  useEffect(() => {
    if (autoFocus) cases.current[0]?.focus()
  }, [autoFocus])

  const valeur = chiffres.join('')

  /** Écrit une suite de chiffres à partir d'une case, et suit le curseur. */
  const remplir = (depuis: number, suite: string) => {
    const propres = suite.replace(/\D/g, '')
    if (!propres) return

    const prochains = [...chiffres]
    let index = depuis
    for (const chiffre of propres) {
      if (index >= LONGUEUR_CODE) break
      prochains[index] = chiffre
      index += 1
    }

    setChiffres(prochains)
    cases.current[Math.min(index, LONGUEUR_CODE - 1)]?.focus()
  }

  const surTouche = (index: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()

      const prochains = [...chiffres]
      if (prochains[index]) {
        // La case porte un chiffre : on l'efface sans bouger.
        prochains[index] = ''
        setChiffres(prochains)
        return
      }

      // Case déjà vide : on recule, sinon la touche ne fait rien et l'on ne
      // peut plus corriger le début du code.
      if (index > 0) {
        prochains[index - 1] = ''
        setChiffres(prochains)
        cases.current[index - 1]?.focus()
      }
      return
    }

    if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault()
      cases.current[index - 1]?.focus()
    }
    if (e.key === 'ArrowRight' && index < LONGUEUR_CODE - 1) {
      e.preventDefault()
      cases.current[index + 1]?.focus()
    }
  }

  return (
    <div>
      <p className="field-label" id={`${idErreur}-libelle`}>
        {libelle}
      </p>

      {/*
        `role="group"` plutôt que six champs indépendants : un lecteur d'écran
        annonce « groupe, entrez le code reçu » une fois, au lieu de répéter
        l'intitulé six fois.
      */}
      <div
        role="group"
        aria-labelledby={`${idErreur}-libelle`}
        aria-describedby={erreur ? idErreur : undefined}
        className="mt-sm flex gap-sm"
      >
        {chiffres.map((chiffre, index) => (
          <input
            key={index}
            ref={(el) => {
              cases.current[index] = el
            }}
            type="text"
            inputMode="numeric"
            // `one-time-code` sur la première case seulement : c'est elle que
            // le système remplit, et `remplir` étale la valeur sur les autres.
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            maxLength={LONGUEUR_CODE}
            value={chiffre}
            onChange={(e) => remplir(index, e.target.value)}
            onKeyDown={surTouche(index)}
            onFocus={(e) => e.currentTarget.select()}
            aria-label={`Chiffre ${index + 1} sur ${LONGUEUR_CODE}`}
            aria-invalid={erreur ? true : undefined}
            className={`h-14 w-full min-w-0 rounded-md border bg-canvas text-center text-title-md font-semibold text-ink tabular-nums outline-none transition-colors focus:border-primary focus:outline focus:outline-2 focus:outline-primary ${
              erreur ? 'border-negative' : 'border-hairline'
            }`}
          />
        ))}
      </div>

      <input type="hidden" name={nom} value={valeur} />

      {erreur ? (
        <p id={idErreur} className="field-error" role="alert">
          {erreur}
        </p>
      ) : null}
    </div>
  )
}
