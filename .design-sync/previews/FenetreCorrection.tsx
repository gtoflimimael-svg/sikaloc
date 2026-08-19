import { FenetreCorrection } from 'sikaloc-mvp'

// La fenêtre de correction dépend de la date de validation : récente = encore
// corrigeable, ancienne = délai dépassé.
export function Recente() {
  return <FenetreCorrection valideLe={new Date().toISOString()} paiementId="p-1042" />
}

export function DelaiDepasse() {
  return <FenetreCorrection valideLe="2025-11-02T10:00:00Z" paiementId="p-0871" />
}
