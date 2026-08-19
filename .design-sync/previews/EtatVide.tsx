import { EtatVide } from 'sikaloc-mvp'

function IconeMaison() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 11 12 5l8 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10.5V19h12v-8.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function AvecAction() {
  return (
    <EtatVide
      icone={<IconeMaison />}
      titre="Aucun logement pour l'instant"
      description="Ajoutez votre premier logement pour commencer à suivre les loyers et générer des quittances."
      action={<button type="button" className="btn btn-primary">Ajouter un logement</button>}
    />
  )
}

export function SansAction() {
  return (
    <EtatVide
      titre="Aucun impayé"
      description="Tous vos loyers du mois ont été encaissés. Rien à relancer."
    />
  )
}
