import { EnTetePage } from 'sikaloc-mvp'

export function AvecActionEtDescription() {
  return (
    <EnTetePage
      titre="Paiements"
      description="Enregistrez les loyers encaissés et générez les quittances correspondantes."
      action={<button type="button" className="btn btn-primary">Enregistrer un paiement</button>}
    />
  )
}

export function TitreSeul() {
  return <EnTetePage titre="Tableau de bord" />
}
