'use client'

import Link from 'next/link'
import { Alerte } from '@/components/ui/retours'

export default function ErreurFind({ retry }: { retry: () => void }) {
  return <main id="contenu" className="app-main mx-auto max-w-[42rem] space-y-lg"><h1 className="page-title">Recherche indisponible</h1><Alerte ton="erreur">Nous n’avons pas pu charger ces informations. Ce message ne signifie pas que le logement n’existe plus.</Alerte><div className="flex flex-wrap gap-sm"><button type="button" onClick={retry} className="btn btn-primary">Réessayer</button><Link href="/find" className="btn btn-secondary">Retour aux logements</Link></div></main>
}
