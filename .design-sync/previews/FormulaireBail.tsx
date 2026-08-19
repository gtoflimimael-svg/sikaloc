import { FormulaireBail } from 'sikaloc-mvp'

const action = async () => ({})

const logements = [
  { valeur: 'lot-42', libelle: 'Villa Aïdjèdo — Lot 42' },
  { valeur: 'lot-7', libelle: 'Appartement Cadjèhoun — Lot 7' },
  { valeur: 'lot-15', libelle: 'Chambre Godomey — Lot 15' },
]

const locataires = [
  { valeur: 'loc-1', libelle: 'Adjoa Kponou' },
  { valeur: 'loc-2', libelle: 'Kossi Amoussou' },
  { valeur: 'loc-3', libelle: 'Rachidatou Bio' },
]

export function Creation() {
  return <FormulaireBail action={action} logements={logements} locataires={locataires} />
}
