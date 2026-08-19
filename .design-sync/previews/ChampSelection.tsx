import { ChampSelection } from 'sikaloc-mvp'

const LOGEMENTS = [
  { valeur: 'lot-42', libelle: 'Villa Aïdjèdo — Lot 42' },
  { valeur: 'lot-7', libelle: 'Appartement Cadjèhoun — Lot 7' },
  { valeur: 'lot-15', libelle: 'Chambre Godomey — Lot 15' },
]

export function Standard() {
  return <ChampSelection nom="logement" libelle="Logement" options={LOGEMENTS} valeurDefaut="lot-42" requis />
}

export function AvecPlaceholder() {
  return (
    <ChampSelection
      nom="logement"
      libelle="Logement concerné"
      options={LOGEMENTS}
      placeholder="Choisissez un logement"
      aide="Un seul bail actif par logement."
    />
  )
}

export function EnErreur() {
  return (
    <ChampSelection
      nom="periodicite"
      libelle="Périodicité"
      options={[
        { valeur: 'mensuel', libelle: 'Mensuel' },
        { valeur: 'trimestriel', libelle: 'Trimestriel' },
      ]}
      placeholder="Choisissez"
      requis
      erreur="Sélectionnez une périodicité."
    />
  )
}
