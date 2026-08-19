import { FormulaireSignature } from 'sikaloc-mvp'

export function SansSignature() {
  return <FormulaireSignature signatureExistante={false} />
}

export function AvecSignature() {
  return <FormulaireSignature signatureExistante />
}
