import type { Metadata } from 'next'
import Link from 'next/link'

import { FormulaireLogement } from '@/components/app/formulaire-logement'
import { Alerte, EnTetePage } from '@/components/ui/retours'
import { creerLogement } from '@/lib/actions/logements'
import { capacites, messageLimiteLogements } from '@/lib/plan'
import { bailleurOnboarde } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

export const metadata: Metadata = { title: 'Nouveau logement' }

export default async function PageNouveauLogement() {
  const supabase = await creerClientServeur()

  const [bailleur, { count }] = await Promise.all([
    bailleurOnboarde(),
    supabase.from('logements').select('id', { count: 'exact', head: true }),
  ])

  const limite = capacites(bailleur).maxLogements
  const enregistres = count ?? 0
  const plafondAtteint = limite !== null && enregistres >= limite
  const restants = limite === null ? null : Math.max(0, limite - enregistres)

  return (
    <div className="mx-auto max-w-[42rem]">
      <EnTetePage
        titre="Nouveau logement"
        description={
          plafondAtteint || restants === null
            ? undefined
            : `${enregistres} logement${enregistres > 1 ? 's' : ''} sur ${limite} enregistré${
                enregistres > 1 ? 's' : ''
              } — il vous en reste ${restants}.`
        }
      />

      {plafondAtteint ? (
        <div className="card card-lg space-y-lg anim-monte">
          {/* Le décompte est dit explicitement : « limité à 2 » sans rappeler
              qu'on en a déjà 2 laisse croire qu'il en reste. */}
          <Alerte ton="attention">{messageLimiteLogements(enregistres)}</Alerte>

          <div className="flex flex-wrap gap-md">
            <Link href="/app/parametres/abonnement" className="btn btn-primary">
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
