import type { Metadata } from 'next'
import Link from 'next/link'

import { FormulaireLogement } from '@/components/app/formulaire-logement'
import { Alerte, EnTetePage } from '@/components/ui/retours'
import { creerLogement } from '@/lib/actions/logements'
import { capacites, MESSAGE_LIMITE_LOGEMENTS } from '@/lib/plan'
import { bailleurOnboarde } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

export const metadata: Metadata = { title: 'Nouveau logement' }

export default async function PageNouveauLogement() {
  const bailleur = await bailleurOnboarde()
  const supabase = await creerClientServeur()

  const limite = capacites(bailleur).maxLogements
  const { count } = await supabase
    .from('logements')
    .select('id', { count: 'exact', head: true })

  const plafondAtteint = limite !== null && (count ?? 0) >= limite

  return (
    <div className="mx-auto max-w-[42rem]">
      <EnTetePage titre="Nouveau logement" />

      {plafondAtteint ? (
        <div className="space-y-lg">
          <Alerte ton="attention">{MESSAGE_LIMITE_LOGEMENTS}</Alerte>
          <div className="flex flex-wrap gap-md">
            <Link href="/app/parametres?onglet=abonnement" className="btn btn-primary">
              Passer au plan Standard
            </Link>
            <Link href="/app/logements" className="btn btn-secondary">
              Retour aux logements
            </Link>
          </div>
        </div>
      ) : (
        <FormulaireLogement action={creerLogement} />
      )}
    </div>
  )
}
