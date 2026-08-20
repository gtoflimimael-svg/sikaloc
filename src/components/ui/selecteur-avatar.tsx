'use client'

import { Check, Shuffle } from 'lucide-react'
import { useState } from 'react'

import {
  NB_OPTIONS,
  auHasard,
  encoder,
  resoudre,
  type Categorie,
  type ConfigAvatar,
} from '@/lib/avatar/config'
import { LIBELLES_CATEGORIES, NOMS_OPTIONS } from '@/lib/avatar/noms'

/** Ordre d'affichage : du plus structurant au plus accessoire. */
const ORDRE: Categorie[] = ['coiffure', 'visage', 'pilosite', 'tenue', 'accessoire']

/**
 * Sélecteur d'avatar — on voit ce qu'on choisit.
 *
 * La version précédente faisait défiler chaque catégorie à la flèche, en
 * affichant « 7 / 24 » : il fallait parcourir les vingt-quatre coiffures pour
 * savoir à quoi elles ressemblaient. Ici, chaque option est une vignette
 * cliquable, comme le choix d'emoji de Notion ou d'avatar de Snapchat.
 *
 * Le coût réseau, qui justifiait le pas-à-pas, est tenu par trois choix :
 * une seule catégorie est montée à la fois, les vignettes sont immuables donc
 * mises en cache définitivement, et le chargement est différé (`lazy`) pour
 * que seules les vignettes réellement visibles descendent.
 */
export function SelecteurAvatar({
  nom,
  identifiant,
  valeurInitiale,
  taille = 112,
}: {
  /** Nom du champ posté (ex. « avatar »). */
  nom: string
  /** Identifiant servant d'amorce quand rien n'est encore personnalisé. */
  identifiant: string
  valeurInitiale?: string | null
  taille?: number
}) {
  const [config, setConfig] = useState<ConfigAvatar>(() =>
    resoudre(identifiant, valeurInitiale),
  )
  const [categorie, setCategorie] = useState<Categorie>('coiffure')

  const valeur = encoder(config)

  return (
    <div className="space-y-lg">
      <input type="hidden" name={nom} value={valeur} />

      {/* ── Aperçu ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-lg">
        <span
          className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-pill ring-2 ring-primary/25"
          style={{ width: taille, height: taille, backgroundColor: '#f4f4fb' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={valeur}
            src={`/avatar/${valeur}.svg`}
            alt="Aperçu de votre avatar"
            width={taille}
            height={taille}
            className="anim-apparait"
            style={{ display: 'block', width: '100%', height: '100%' }}
          />
        </span>

        <div className="min-w-0">
          <p className="text-body-sm text-mute">
            Cliquez sur ce qui vous ressemble. Votre avatar se met à jour aussitôt.
          </p>
          <button
            type="button"
            onClick={() => setConfig(auHasard())}
            className="btn btn-secondary btn-sm mt-sm"
          >
            <Shuffle size={15} strokeWidth={2} aria-hidden="true" />
            Surprenez-moi
          </button>
        </div>
      </div>

      {/* ── Catégories ───────────────────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="Éléments de l’avatar"
        className="no-scrollbar -mx-xxs flex gap-xs overflow-x-auto px-xxs pb-xxs"
      >
        {ORDRE.map((cat) => {
          const actif = cat === categorie

          return (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={actif}
              onClick={() => setCategorie(cat)}
              className={`shrink-0 rounded-pill px-md py-xs text-body-sm font-medium transition-colors duration-150 ${
                actif
                  ? 'bg-primary text-on-primary'
                  : 'border border-hairline bg-canvas text-mute hover:text-ink'
              }`}
            >
              {LIBELLES_CATEGORIES[cat]}
            </button>
          )
        })}
      </div>

      {/* ── Vignettes ────────────────────────────────────────────────────── */}
      <div
        role="tabpanel"
        aria-label={LIBELLES_CATEGORIES[categorie]}
        key={categorie}
        className="anim-apparait grid max-h-[19rem] grid-cols-4 gap-xs overflow-y-auto rounded-lg bg-canvas p-xs sm:grid-cols-5 md:grid-cols-6"
      >
        {Array.from({ length: NB_OPTIONS[categorie] }, (_, index) => {
          const choisi = config[categorie] === index
          const libelle = NOMS_OPTIONS[categorie][index]

          return (
            <button
              key={index}
              type="button"
              title={libelle}
              aria-label={`${LIBELLES_CATEGORIES[categorie]} : ${libelle}`}
              aria-pressed={choisi}
              onClick={() => setConfig((c) => ({ ...c, [categorie]: index }))}
              className={`relative aspect-square overflow-hidden rounded-md transition-[transform,background-color,box-shadow] duration-150 hover:-translate-y-0.5 ${
                choisi
                  ? 'bg-primary-pale shadow-[inset_0_0_0_2px_var(--color-primary)]'
                  : 'bg-surface-soft hover:bg-surface-elevated'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/avatar/vignette/${categorie}-${index}.svg`}
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
                width={96}
                height={96}
                style={{ display: 'block', width: '100%', height: '100%' }}
              />

              {choisi ? (
                <span className="absolute right-xxs top-xxs inline-flex size-4 items-center justify-center rounded-pill bg-primary text-on-primary">
                  <Check size={11} strokeWidth={3} aria-hidden="true" />
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <p className="text-caption text-mute">
        {NOMS_OPTIONS[categorie][config[categorie]]} ·{' '}
        {Object.values(NB_OPTIONS)
          .reduce((a, b) => a * b, 1)
          .toLocaleString('fr-FR')}{' '}
        combinaisons possibles.
      </p>
    </div>
  )
}
