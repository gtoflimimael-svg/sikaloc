'use client'

import { SlidersHorizontal, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'

import { LIBELLES_EQUIPEMENT } from '@/lib/annonces/libelles'
import type { Filtres } from '@/lib/find/recherche'
import { EQUIPEMENTS_ANNONCE, TYPES_LOGEMENT } from '@/lib/types/database'

/**
 * Les filtres de la recherche.
 *
 * ─── Un formulaire, une URL ────────────────────────────────────────────────
 *
 * `method="get"` vers `/find` : le navigateur construit lui-même l'URL, avec
 * les seuls champs remplis. Aucun état client à tenir, une recherche reste
 * partageable, et le bouton « Précédent » fonctionne. `page` n'est pas un
 * champ : changer un filtre ramène donc toujours à la première page.
 *
 * ─── Une seule instance ────────────────────────────────────────────────────
 *
 * Le même formulaire sert au téléphone et au bureau : deux copies auraient
 * dupliqué les identifiants de champs, et un lecteur d'écran aurait annoncé
 * deux fois chaque libellé. Sous `lg`, il s'ouvre par le bouton « Filtrer » ;
 * au-dessus, il est toujours là.
 */
export function FiltresFind({
  filtres,
  lieux,
  nbFiltresActifs,
}: {
  filtres: Filtres
  /** Villes et quartiers réellement publiés — `lieux_publies`. */
  lieux: { ville: string; quartier: string | null }[]
  nbFiltresActifs: number
}) {
  const [ouvert, setOuvert] = useState(false)
  const panneau = useId()
  const declencheur = useRef<HTMLButtonElement>(null)
  const formulaire = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (ouvert && !window.matchMedia('(min-width: 1024px)').matches) formulaire.current?.querySelector('select')?.focus()
  }, [ouvert])

  const villes = [...new Set(lieux.map((l) => l.ville))].sort((a, b) => a.localeCompare(b, 'fr'))
  const quartiers = [
    ...new Set(
      lieux
        .filter((l) => (filtres.ville ? l.ville.toLowerCase() === filtres.ville.toLowerCase() : true))
        .map((l) => l.quartier)
        .filter((q): q is string => Boolean(q)),
    ),
  ].sort((a, b) => a.localeCompare(b, 'fr'))

  return (
    <div>
      <button
        ref={declencheur}
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        aria-controls={panneau}
        className="btn btn-secondary w-full lg:hidden"
      >
        {ouvert ? <X size={18} aria-hidden="true" /> : <SlidersHorizontal size={18} aria-hidden="true" />}
        {ouvert ? 'Fermer les filtres' : 'Filtrer'}
        {nbFiltresActifs > 0 && !ouvert ? ` (${nbFiltresActifs})` : ''}
      </button>

      <form
        id={panneau}
        ref={formulaire}
        onKeyDown={e => {
          if (e.key === 'Escape' && ouvert && !window.matchMedia('(min-width: 1024px)').matches) {
            e.preventDefault(); setOuvert(false); declencheur.current?.focus()
          }
        }}
        method="get"
        action="/find"
        onSubmit={(evenement) => {
          // Un champ vide part quand même dans l'URL (`&type=`), où il ne veut
          // rien dire. On le désactive juste avant l'envoi : le navigateur ne
          // le transmet plus. Sans JavaScript, il est simplement ignoré à la
          // lecture — la recherche fonctionne dans les deux cas.
          for (const champ of Array.from(evenement.currentTarget.elements)) {
            const controle = champ as HTMLInputElement | HTMLSelectElement
            if (controle.name && 'value' in controle && controle.value === '') controle.disabled = true
          }
        }}
        className={`card list-card mt-md space-y-lg lg:mt-0 lg:block ${ouvert ? 'block' : 'hidden'}`}
        aria-label="Filtrer les logements"
      >
        <div>
          <label htmlFor="f-ville" className="field-label">
            Ville
          </label>
          <select id="f-ville" name="ville" defaultValue={filtres.ville ?? ''} className="input">
            <option value="">Toutes les villes</option>
            {villes.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {quartiers.length > 0 ? (
          <div>
            <label htmlFor="f-quartier" className="field-label">
              Quartier
            </label>
            <select id="f-quartier" name="quartier" defaultValue={filtres.quartier ?? ''} className="input">
              <option value="">Tous les quartiers</option>
              {quartiers.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <label htmlFor="f-type" className="field-label">
            Type de bien
          </label>
          <select id="f-type" name="type" defaultValue={filtres.type ?? ''} className="input">
            <option value="">Tous les types</option>
            {TYPES_LOGEMENT.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="min-w-0">
          <legend className="field-label">Loyer mensuel (FCFA)</legend>
          <div className="find-range">
            <div>
              <label htmlFor="f-loyer-min" className="sr-only">
                Loyer minimum en FCFA
              </label>
              <input
                id="f-loyer-min"
                name="loyer_min"
                type="number"
                inputMode="numeric"
                min={0}
                step={1000}
                placeholder="Minimum"
                defaultValue={filtres.loyerMin ?? ''}
                className="input tabular"
              />
            </div>
            <div>
              <label htmlFor="f-loyer-max" className="sr-only">
                Loyer maximum en FCFA
              </label>
              <input
                id="f-loyer-max"
                name="loyer_max"
                type="number"
                inputMode="numeric"
                min={0}
                step={1000}
                placeholder="Maximum"
                defaultValue={filtres.loyerMax ?? ''}
                className="input tabular"
              />
            </div>
          </div>
        </fieldset>

        <div>
          <label htmlFor="f-chambres" className="field-label">
            Chambres
          </label>
          <select id="f-chambres" name="chambres" defaultValue={filtres.chambres?.toString() ?? ''} className="input">
            <option value="">Peu importe</option>
            <option value="0">Entrer-coucher</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} chambre{n > 1 ? 's' : ''} salon
              </option>
            ))}
          </select>
        </div>

        <fieldset className="min-w-0">
          <legend className="field-label">Surface (m²)</legend>
          <div className="find-range">
            <div>
              <label htmlFor="f-surface-min" className="sr-only">
                Surface minimum en mètres carrés
              </label>
              <input
                id="f-surface-min"
                name="surface_min"
                type="number"
                inputMode="numeric"
                min={0}
                max={2000}
                placeholder="Minimum"
                defaultValue={filtres.surfaceMin ?? ''}
                className="input tabular"
              />
            </div>
            <div>
              <label htmlFor="f-surface-max" className="sr-only">
                Surface maximum en mètres carrés
              </label>
              <input
                id="f-surface-max"
                name="surface_max"
                type="number"
                inputMode="numeric"
                min={0}
                max={2000}
                placeholder="Maximum"
                defaultValue={filtres.surfaceMax ?? ''}
                className="input tabular"
              />
            </div>
          </div>
        </fieldset>

        <div>
          <label
            htmlFor="f-disponible"
            className="flex cursor-pointer items-center gap-md rounded-md border border-hairline bg-canvas px-lg py-md"
          >
            <input
              id="f-disponible"
              name="disponible"
              type="checkbox"
              value="maintenant"
              defaultChecked={filtres.disponible === true}
              className="size-5 shrink-0 accent-primary"
            />
            <span className="text-body-md text-ink">Disponible maintenant</span>
          </label>
        </div>

        <details open={filtres.equipements.length > 0}>
          <summary className="min-h-11 cursor-pointer py-sm text-body-sm font-medium text-ink">Équipements</summary>
          <fieldset className="mt-sm min-w-0"><legend className="sr-only">Équipements souhaités</legend>
          {/*
            Chaque case porte le même nom : le navigateur envoie
            `equipements=parking&equipements=climatisation`, sans une ligne de
            JavaScript. `lireFiltres` accepte cette forme comme la forme
            « séparée par des virgules » que produisent nos propres liens.
          */}
          <div className="grid gap-xs sm:grid-cols-2 lg:grid-cols-1">
            {EQUIPEMENTS_ANNONCE.map((e) => (
              <label key={e} className="flex min-h-11 cursor-pointer items-center gap-sm text-body-sm text-ink">
                <input
                  type="checkbox"
                  name="equipements"
                  value={e}
                  defaultChecked={filtres.equipements.includes(e)}
                  className="size-5 shrink-0 accent-primary"
                />
                {LIBELLES_EQUIPEMENT[e]}
              </label>
            ))}
          </div>
          </fieldset>
        </details>

        <div className="flex flex-wrap gap-sm pt-sm">
          <button type="submit" className="btn btn-primary">
            Voir les résultats
          </button>
          {nbFiltresActifs > 0 ? (
            <Link href="/find" className="btn btn-tertiary">
              Réinitialiser
            </Link>
          ) : null}
        </div>
      </form>
    </div>
  )
}
