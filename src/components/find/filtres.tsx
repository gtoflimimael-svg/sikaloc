'use client'

import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'

import { LIBELLES_EQUIPEMENT } from '@/lib/annonces/libelles'
import type { Filtres } from '@/lib/find/recherche'
import { EQUIPEMENTS_ANNONCE, TYPES_LOGEMENT } from '@/lib/types/database'

/**
 * Recherche publique Find : critères principaux visibles, critères avancés
 * dans un panneau repliable. Le GET natif garde l’URL partageable et la
 * recherche côté serveur reste l’unique source des résultats.
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
  const filtresAvancesActifs =
    Number(Boolean(filtres.quartier)) +
    Number(filtres.chambres !== undefined) +
    Number(filtres.surfaceMin !== undefined) +
    Number(filtres.surfaceMax !== undefined) +
    Number(Boolean(filtres.disponible)) +
    filtres.equipements.length
  const [ouvert, setOuvert] = useState(filtresAvancesActifs > 0)
  const panneau = useId()
  const declencheur = useRef<HTMLButtonElement>(null)
  const formulaire = useRef<HTMLFormElement>(null)
  const focaliserPremierFiltre = useRef(false)

  const villes = [...new Set(lieux.map((lieu) => lieu.ville))].sort((a, b) => a.localeCompare(b, 'fr'))
  const quartiers = [
    ...new Set(
      lieux
        .filter((lieu) => (filtres.ville ? lieu.ville.toLowerCase() === filtres.ville.toLowerCase() : true))
        .map((lieu) => lieu.quartier)
        .filter((quartier): quartier is string => Boolean(quartier)),
    ),
  ].sort((a, b) => a.localeCompare(b, 'fr'))

  useEffect(() => {
    if (!ouvert || !focaliserPremierFiltre.current) return
    formulaire.current?.querySelector<HTMLElement>('[data-first-advanced="true"]')?.focus()
    focaliserPremierFiltre.current = false
  }, [ouvert])

  function basculerFiltres() {
    if (ouvert) {
      setOuvert(false)
      declencheur.current?.focus()
      return
    }
    focaliserPremierFiltre.current = true
    setOuvert(true)
  }

  function fermerFiltres() {
    setOuvert(false)
    declencheur.current?.focus()
  }

  return (
    <form
      ref={formulaire}
      method="get"
      action="/find"
      className="find-search-form"
      role="search"
      aria-label="Rechercher un logement"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && ouvert) {
          event.preventDefault()
          fermerFiltres()
        }
      }}
      onSubmit={(event) => {
        // Les champs vides ne doivent pas polluer l’URL. Le navigateur
        // construit et soumet toujours la recherche par GET.
        for (const element of Array.from(event.currentTarget.elements)) {
          const control = element as HTMLInputElement | HTMLSelectElement
          if (control.name && 'value' in control && control.value === '') control.disabled = true
        }
      }}
    >
      <div className="find-search-primary">
        <div className="find-search-field">
          <label htmlFor={`${panneau}-ville`} className="find-search-label">Ville</label>
          <select
            id={`${panneau}-ville`}
            name="ville"
            defaultValue={filtres.ville ?? ''}
            className="input find-search-input"
          >
            <option value="">Toutes les villes</option>
            {villes.map((ville) => <option key={ville} value={ville}>{ville}</option>)}
          </select>
        </div>

        <div className="find-search-field">
          <label htmlFor={`${panneau}-type`} className="find-search-label">Type de logement</label>
          <select
            id={`${panneau}-type`}
            name="type"
            defaultValue={filtres.type ?? ''}
            className="input find-search-input"
          >
            <option value="">Tous les types</option>
            {TYPES_LOGEMENT.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>

        <fieldset className="find-search-field find-budget-field">
          <legend className="find-search-label">Budget mensuel (FCFA)</legend>
          <div className="find-budget-inputs">
            <label className="sr-only" htmlFor={`${panneau}-loyer-min`}>Loyer minimum en FCFA</label>
            <input
              id={`${panneau}-loyer-min`}
              name="loyer_min"
              type="number"
              inputMode="numeric"
              min={0}
              max={999_999_999}
              step={1000}
              placeholder="Min."
              defaultValue={filtres.loyerMin ?? ''}
              className="input find-search-input tabular"
            />
            <span className="find-budget-separator" aria-hidden="true">à</span>
            <label className="sr-only" htmlFor={`${panneau}-loyer-max`}>Loyer maximum en FCFA</label>
            <input
              id={`${panneau}-loyer-max`}
              name="loyer_max"
              type="number"
              inputMode="numeric"
              min={0}
              max={999_999_999}
              step={1000}
              placeholder="Max."
              defaultValue={filtres.loyerMax ?? ''}
              className="input find-search-input tabular"
            />
          </div>
        </fieldset>

        <button type="submit" className="btn btn-primary find-search-submit">
          <Search size={18} aria-hidden="true" />
          Rechercher
        </button>
      </div>

      <div className="find-search-tools">
        <button
          ref={declencheur}
          type="button"
          onClick={basculerFiltres}
          aria-expanded={ouvert}
          aria-controls={panneau}
          className="find-filter-toggle"
        >
          <SlidersHorizontal size={17} aria-hidden="true" />
          <span>Tous les filtres</span>
          {nbFiltresActifs > 0 ? <span className="find-filter-count">{nbFiltresActifs}</span> : null}
          <ChevronDown size={16} aria-hidden="true" className={ouvert ? 'is-open' : ''} />
        </button>
        <p className="find-search-note">Les résultats correspondent aux annonces publiées.</p>
      </div>

      <section id={panneau} hidden={!ouvert} aria-label="Filtres avancés" className="find-advanced-panel">
        <div className="find-advanced-grid">
          {quartiers.length > 0 ? (
            <div className="find-search-field">
              <label htmlFor={`${panneau}-quartier`} className="find-search-label">Quartier</label>
              <select
                id={`${panneau}-quartier`}
                name="quartier"
                defaultValue={filtres.quartier ?? ''}
                className="input find-search-input"
                data-first-advanced="true"
              >
                <option value="">Tous les quartiers</option>
                {quartiers.map((quartier) => <option key={quartier} value={quartier}>{quartier}</option>)}
              </select>
            </div>
          ) : null}

          <div className="find-search-field">
            <label htmlFor={`${panneau}-chambres`} className="find-search-label">Chambres</label>
            <select
              id={`${panneau}-chambres`}
              name="chambres"
              defaultValue={filtres.chambres?.toString() ?? ''}
              className="input find-search-input"
              data-first-advanced={quartiers.length === 0 ? 'true' : undefined}
            >
              <option value="">Peu importe</option>
              <option value="0">Entrer-coucher</option>
              {[1, 2, 3, 4, 5].map((nombre) => (
                <option key={nombre} value={nombre}>{nombre} chambre{nombre > 1 ? 's' : ''} salon</option>
              ))}
            </select>
          </div>

          <fieldset className="find-search-field">
            <legend className="find-search-label">Surface (m²)</legend>
            <div className="find-budget-inputs">
              <label className="sr-only" htmlFor={`${panneau}-surface-min`}>Surface minimum en mètres carrés</label>
              <input
                id={`${panneau}-surface-min`}
                name="surface_min"
                type="number"
                inputMode="numeric"
                min={0}
                max={2000}
                step={1}
                placeholder="Min."
                defaultValue={filtres.surfaceMin ?? ''}
                className="input find-search-input tabular"
              />
              <span className="find-budget-separator" aria-hidden="true">à</span>
              <label className="sr-only" htmlFor={`${panneau}-surface-max`}>Surface maximum en mètres carrés</label>
              <input
                id={`${panneau}-surface-max`}
                name="surface_max"
                type="number"
                inputMode="numeric"
                min={0}
                max={2000}
                step={1}
                placeholder="Max."
                defaultValue={filtres.surfaceMax ?? ''}
                className="input find-search-input tabular"
              />
            </div>
          </fieldset>

          <label htmlFor={`${panneau}-disponible`} className="find-availability-option">
            <input
              id={`${panneau}-disponible`}
              name="disponible"
              type="checkbox"
              value="maintenant"
              defaultChecked={filtres.disponible === true}
              className="size-5 shrink-0 accent-primary"
            />
            <span>Disponible immédiatement</span>
          </label>

          <details open={filtres.equipements.length > 0} className="find-equipment-details">
            <summary>Équipements souhaités</summary>
            <fieldset className="find-equipment-options">
              <legend className="sr-only">Équipements souhaités</legend>
              {EQUIPEMENTS_ANNONCE.map((equipement) => (
                <label key={equipement}>
                  <input
                    type="checkbox"
                    name="equipements"
                    value={equipement}
                    defaultChecked={filtres.equipements.includes(equipement)}
                    className="size-4 shrink-0 accent-primary"
                  />
                  <span>{LIBELLES_EQUIPEMENT[equipement]}</span>
                </label>
              ))}
            </fieldset>
          </details>
        </div>

        <div className="find-advanced-actions">
          <button type="submit" className="btn btn-primary">Appliquer les filtres</button>
          <Link href="/find" className="btn btn-secondary">Réinitialiser</Link>
          <button type="button" onClick={fermerFiltres} className="find-filter-close">
            <X size={16} aria-hidden="true" />
            Fermer
          </button>
        </div>
      </section>
    </form>
  )
}
