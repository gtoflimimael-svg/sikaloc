'use client'

import { useId, useRef, useState } from 'react'

import {
  INDICATIF_AFFICHE,
  LONGUEUR_NATIONALE,
  chiffresSaisis,
  formaterTelephone,
  normaliserTelephone,
} from '@/lib/telephone'

/**
 * Champ téléphone — l'indicatif est fixe, l'utilisateur saisit dix chiffres.
 *
 * ─── Pourquoi l'indicatif n'est pas dans le champ ───────────────────────────
 *
 * Il est posé à côté, dans un élément qui n'est pas éditable. Un préfixe écrit
 * dans la valeur se supprime au Backspace, se sélectionne, se colle en double —
 * et il faut alors le défendre à chaque frappe. Hors du champ, il n'y a rien à
 * défendre.
 *
 * La valeur postée reste complète : un `<input type="hidden">` porte la forme
 * canonique `+2290190459821`, celle que le serveur attend.
 *
 * ─── Le curseur ─────────────────────────────────────────────────────────────
 *
 * Reformater à chaque frappe replace le curseur à la fin, ce qui rend une
 * correction au milieu impossible. On compte donc les chiffres situés avant le
 * curseur, on reformate, puis on replace le curseur après le même nombre de
 * chiffres — les espaces ajoutés ne le déplacent plus.
 */
export function ChampTelephone({
  nom,
  libelle,
  valeurDefaut,
  erreur,
  aide,
  requis,
  autoComplete = 'tel-national',
}: {
  nom: string
  libelle: string
  valeurDefaut?: string | null
  erreur?: string
  aide?: string
  requis?: boolean
  autoComplete?: string
}) {
  const [chiffres, setChiffres] = useState(() => chiffresDepart(valeurDefaut))
  const champ = useRef<HTMLInputElement>(null)
  const idAide = useId()

  const affiche = groupes(chiffres)
  const complet = chiffres.length === LONGUEUR_NATIONALE

  /** Chiffres situés avant une position donnée dans le texte affiché. */
  const chiffresAvant = (texte: string, position: number) =>
    texte.slice(0, position).replace(/\D/g, '').length

  /**
   * Replace le curseur après le n-ième chiffre du texte reformaté.
   *
   * Après le rendu, donc : la valeur de l'input est encore l'ancienne au
   * moment où l'évènement est traité.
   */
  const placerCurseur = (nbChiffres: number) => {
    requestAnimationFrame(() => {
      const element = champ.current
      if (!element) return

      let position = 0
      let vus = 0
      while (position < element.value.length && vus < nbChiffres) {
        if (/\d/.test(element.value[position])) vus += 1
        position += 1
      }
      element.setSelectionRange(position, position)
    })
  }

  /**
   * Retour arrière et suppression sur un espace de présentation.
   *
   * Sans ce traitement, la touche paraît morte : le navigateur retire
   * l'espace, le nombre de chiffres ne change pas, le reformatage remet
   * l'espace, et rien ne bouge à l'écran. On retire donc le chiffre que
   * l'espace masquait — celui que l'utilisateur visait.
   *
   * Se limite à un curseur simple, sans sélection : effacer une sélection est
   * déjà sans ambiguïté, le navigateur s'en charge très bien.
   */
  const surTouche = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const element = e.currentTarget
    const position = element.selectionStart
    if (position === null || position !== element.selectionEnd) return

    const arriere = e.key === 'Backspace'
    const avantEspace = arriere ? position - 1 : position
    if (!arriere && e.key !== 'Delete') return
    if (avantEspace < 0 || avantEspace >= element.value.length) return
    if (/\d/.test(element.value[avantEspace])) return

    e.preventDefault()

    const vus = chiffresAvant(element.value, position)
    const cible = arriere ? vus - 1 : vus
    if (cible < 0 || cible >= chiffres.length) return

    setChiffres(chiffres.slice(0, cible) + chiffres.slice(cible + 1))
    placerCurseur(cible)
  }

  const surSaisie = (e: React.ChangeEvent<HTMLInputElement>) => {
    const element = e.target
    const avant = chiffresAvant(element.value, element.selectionStart ?? element.value.length)

    // `chiffresSaisis` absorbe tout : un `+229` collé, des tirets, des espaces,
    // un indicatif en double. Il n'y a donc rien à nettoyer en amont.
    setChiffres(chiffresSaisis(element.value))

    // Replacer le curseur après le même nombre de chiffres qu'avant : les
    // espaces ajoutés par le reformatage ne le déplacent plus.
    placerCurseur(avant)
  }

  return (
    <div>
      <label htmlFor={nom} className="field-label">
        {libelle}
        {requis ? <span className="text-negative"> *</span> : null}
      </label>

      {/*
        `flex` sur un conteneur qui porte l'apparence du champ : l'indicatif et
        la saisie forment un seul objet à l'œil, sans que l'indicatif soit
        atteignable au clavier ni à la souris.
      */}
      <div
        className="input flex items-center gap-xs p-0 focus-within:outline focus-within:outline-2 focus-within:outline-primary"
        onClick={() => champ.current?.focus()}
      >
        <span
          aria-hidden="true"
          className="select-none border-r border-hairline py-sm pl-md pr-sm text-body-md text-mute"
        >
          {INDICATIF_AFFICHE}
        </span>

        <input
          ref={champ}
          id={nom}
          type="tel"
          inputMode="numeric"
          autoComplete={autoComplete}
          placeholder="01 90 45 98 21"
          value={affiche}
          onChange={surSaisie}
          onKeyDown={surTouche}
          required={requis}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={aide ? idAide : undefined}
          // L'indicatif est décoratif : les lecteurs d'écran le liraient comme
          // du texte détaché du champ. On le remet dans le nom accessible.
          aria-label={`${libelle}, indicatif ${INDICATIF_AFFICHE}`}
          className="min-w-0 flex-1 border-0 bg-transparent py-sm pr-md text-body-md text-ink outline-none placeholder:text-mute-soft"
        />
      </div>

      {/*
        C'est cette valeur qui est postée : la forme canonique, sans espaces.
        Le champ visible n'a pas de `name` — il ne sert qu'à la saisie.
      */}
      <input
        type="hidden"
        name={nom}
        value={complet ? `${INDICATIF_AFFICHE}${chiffres}` : chiffres}
      />

      {aide && !erreur ? (
        <p id={idAide} className="field-hint">
          {aide}
        </p>
      ) : null}
      {erreur ? (
        <p className="field-error" role="alert">
          {erreur}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Les chiffres montrés à l'ouverture du formulaire.
 *
 * Un numéro enregistré avant la réforme béninoise de 2024 n'en compte que
 * huit, alors que le champ en exige dix. On affiche donc sa forme actuelle —
 * celle que l'opérateur a produite en préfixant « 01 » — plutôt que huit
 * chiffres que la validation refuserait à l'enregistrement, sur un formulaire
 * que le bailleur n'a même pas modifié.
 *
 * La migration 20260912000600 a converti les numéros existants : ce filet ne
 * devrait plus servir. Il coûte une ligne et évite un formulaire bloqué.
 */
function chiffresDepart(valeur: string | null | undefined): string {
  return chiffresSaisis(normaliserTelephone(valeur ?? '') ?? valeur ?? '')
}

/**
 * « 0190459821 » → « 01 90 45 98 21 ». Sans l'indicatif, qui vit à côté.
 *
 * Le cas vide est traité à part, et pas par coquetterie : `formaterTelephone`
 * rend « +229 » tout court quand il n'y a aucun chiffre — sans espace final,
 * donc sans le préfixe que le retrait cherchait. Le champ affichait alors
 * « +229 » à l'intérieur, en double de la pastille posée à côté.
 */
function groupes(chiffres: string): string {
  if (!chiffres) return ''

  // Dès qu'il y a un chiffre, `formaterTelephone` rend « +229 » puis les
  // paires : on retire l'indicatif et son espace, sans rien réimplémenter.
  return formaterTelephone(chiffres).slice(INDICATIF_AFFICHE.length + 1)
}
