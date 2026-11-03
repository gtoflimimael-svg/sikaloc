import Link from 'next/link'
import { ArrowRight, MapPin } from 'lucide-react'

import { LIBELLES_EQUIPEMENT, libelleChambres } from '@/lib/annonces/libelles'
import { formaterDate, formaterFCFA } from '@/lib/format'
import type { AnnoncePublique, EquipementAnnonce } from '@/lib/types/database'

import { PhotoAnnonce } from './photo-annonce'

const EQUIPEMENTS_PRIORITAIRES: EquipementAnnonce[] = [
  'douche_interieure',
  'wc_interieur',
  'cuisine_interieure',
  'cour_cloturee',
  'climatisation',
  'parking',
  'compteur_eau_individuel',
  'compteur_electrique_individuel',
  'eau_courante',
  'electricite',
  'gardien',
]

function disponibilite(disponibleLe: string | null, aujourdhui: string): string {
  if (!disponibleLe || disponibleLe <= aujourdhui) return 'Disponible maintenant'
  return `Disponible le ${formaterDate(disponibleLe)}`
}

/** Une annonce publique construite uniquement à partir de la projection Find. */
export function CarteAnnonce({
  annonce,
  aujourdhui,
  prioritaire = false,
}: {
  annonce: AnnoncePublique
  /** Date civile fixée une seule fois pour toutes les cartes de la page. */
  aujourdhui: string
  /** Les images de la première rangée peuvent commencer à charger immédiatement. */
  prioritaire?: boolean
}) {
  const chambres = libelleChambres(annonce.chambres)
  const localisation = annonce.quartier ? `${annonce.quartier}, ${annonce.ville}` : annonce.ville
  const titre = chambres ? `${annonce.type} · ${chambres}` : annonce.type
  const equipement = EQUIPEMENTS_PRIORITAIRES.find((item) => annonce.equipements.includes(item))
  const photo = annonce.photo_position === null
    ? null
    : `/find/photo/${annonce.reference}/${annonce.photo_position}`

  return (
    <article className="find-property-card">
      <div className="find-property-media">
        <PhotoAnnonce
          src={photo}
          alt={`${titre} à louer à ${localisation}`}
          largeur={annonce.photo_largeur}
          hauteur={annonce.photo_hauteur}
          prioritaire={prioritaire}
        />
        <span className="find-availability">{disponibilite(annonce.disponible_le, aujourdhui)}</span>
      </div>

      <div className="find-property-content">
        <p className="find-property-location">
          <span>{annonce.type}</span>
          <span aria-hidden="true">·</span>
          <MapPin size={15} aria-hidden="true" />
          <span>{localisation}</span>
        </p>

        <h3 className="find-property-title">
          <Link
            href={`/find/${annonce.reference}`}
            className="find-property-link"
            aria-label={`Voir le logement : ${titre}, ${localisation}`}
          >
            {titre}
          </Link>
        </h3>

        <p className="find-property-price">
          <span className="find-property-amount">{formaterFCFA(annonce.loyer)}</span>
          <span className="find-property-period">/ mois</span>
        </p>

        {annonce.charges !== null && annonce.charges > 0 ? (
          <p className="find-property-charges">+ {formaterFCFA(annonce.charges)} de charges par mois</p>
        ) : null}

        <div className="find-property-facts" aria-label="Caractéristiques principales">
          {chambres ? <span>{chambres}</span> : null}
          {annonce.surface_m2 !== null ? <span>{annonce.surface_m2} m²</span> : null}
          {equipement ? <span>{LIBELLES_EQUIPEMENT[equipement]}</span> : null}
        </div>

        <div className="find-property-footer">
          <span className="find-property-reference">Réf. {annonce.reference}</span>
          <span className="find-property-action" aria-hidden="true">
            Voir le logement <ArrowRight size={16} aria-hidden="true" />
          </span>
        </div>
      </div>
    </article>
  )
}
