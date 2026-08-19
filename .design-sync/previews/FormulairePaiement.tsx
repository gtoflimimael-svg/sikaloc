import { FormulairePaiement } from 'sikaloc-mvp'

const action = async () => ({})

const baux = [
  { valeur: 'bail-1', libelle: 'Adjoa Kponou — Villa Aïdjèdo Lot 42', loyerMensuel: 75000 },
  { valeur: 'bail-2', libelle: 'Kossi Amoussou — Appartement Cadjèhoun Lot 7', loyerMensuel: 120000 },
  { valeur: 'bail-3', libelle: 'Rachidatou Bio — Chambre Godomey Lot 15', loyerMensuel: 35000 },
]

export function Standard() {
  return <FormulairePaiement action={action} baux={baux} />
}

export function BailPreselectionne() {
  return (
    <FormulairePaiement
      action={action}
      baux={baux}
      bailPreselectionne="bail-2"
      libelleSoumission="Enregistrer le paiement"
    />
  )
}
