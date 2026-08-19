'use client'

import { ChevronLeft, ChevronRight, Shuffle } from 'lucide-react'
import { useState } from 'react'

import {
  CATEGORIES,
  NB_OPTIONS,
  auHasard,
  encoder,
  resoudre,
  type Categorie,
  type ConfigAvatar,
} from '@/lib/avatar/config'

const LIBELLES: Record<Categorie, string> = {
  coiffure: 'Coiffure',
  visage: 'Visage',
  pilosite: 'Barbe',
  tenue: 'Tenue',
  accessoire: 'Lunettes',
}

/** Ordre d'affichage : du plus structurant au plus accessoire. */
const ORDRE: Categorie[] = ['coiffure', 'visage', 'pilosite', 'tenue', 'accessoire']

/**
 * Sélecteur d'avatar — un aperçu et cinq pas-à-pas.
 *
 * Le choix des flèches plutôt que d'une galerie de vignettes est délibéré :
 * une galerie de 24 coiffures ferait 24 requêtes d'image, là où le pas-à-pas
 * n'en déclenche qu'une par changement. Sur une connexion mobile béninoise,
 * c'est la différence entre utilisable et pénible.
 *
 * La valeur est publiée dans un <input hidden> : le formulaire parent la poste
 * sans avoir besoin d'état partagé.
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

  function decaler(cat: Categorie, pas: number) {
    setConfig((c) => {
      const total = NB_OPTIONS[cat]
      return { ...c, [cat]: (c[cat] + pas + total) % total }
    })
  }

  const valeur = encoder(config)

  return (
    <div className="space-y-lg">
      <input type="hidden" name={nom} value={valeur} />

      <div className="flex flex-wrap items-center gap-xl">
        <span
          className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-pill"
          style={{ width: taille, height: taille, backgroundColor: '#f4f4fb' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/avatar/${valeur}.svg`}
            alt="Aperçu de votre avatar"
            width={taille}
            height={taille}
            style={{ display: 'block', width: '100%', height: '100%' }}
          />
        </span>

        <button
          type="button"
          onClick={() => setConfig(auHasard())}
          className="btn btn-secondary btn-sm"
        >
          <Shuffle size={15} strokeWidth={2} aria-hidden="true" />
          Au hasard
        </button>
      </div>

      <div className="space-y-xs">
        {ORDRE.map((cat) => (
          <div
            key={cat}
            className="flex items-center justify-between gap-sm rounded-md border border-hairline bg-canvas px-md py-xs"
          >
            <span className="min-w-0 flex-1 truncate text-body-sm text-body">{LIBELLES[cat]}</span>
            <span className="flex items-center gap-xxs">
              <button
                type="button"
                onClick={() => decaler(cat, -1)}
                aria-label={`${LIBELLES[cat]} — précédent`}
                className="btn-icon"
                style={{ width: 30, height: 30 }}
              >
                <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
              </button>
              <span className="w-[3rem] shrink-0 text-center text-caption tabular text-mute">
                {config[cat] + 1} / {NB_OPTIONS[cat]}
              </span>
              <button
                type="button"
                onClick={() => decaler(cat, 1)}
                aria-label={`${LIBELLES[cat]} — suivant`}
                className="btn-icon"
                style={{ width: 30, height: 30 }}
              >
                <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            </span>
          </div>
        ))}
      </div>

      <p className="text-caption text-mute">
        {CATEGORIES.length} réglages ·{' '}
        {Object.values(NB_OPTIONS)
          .reduce((a, b) => a * b, 1)
          .toLocaleString('fr-FR')}{' '}
        combinaisons possibles.
      </p>
    </div>
  )
}
