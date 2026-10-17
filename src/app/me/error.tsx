'use client'

import Link from 'next/link'
import { Alerte } from '@/components/ui/retours'

export default function ErreurMe({ retry }: { retry: () => void }) {
  return (
    <main className="app-main mx-auto max-w-[42rem] space-y-lg">
      <h1 className="page-title">Informations indisponibles</h1>
      <Alerte ton="erreur">Vos informations n’ont pas pu être chargées. Aucun solde ni état de paiement ne peut être confirmé pour le moment.</Alerte>
      <div className="flex flex-wrap gap-sm">
        <button type="button" className="btn btn-primary" onClick={retry}>Réessayer</button>
        <Link href="/me" className="btn btn-secondary">Retour à mon espace</Link>
      </div>
    </main>
  )
}
