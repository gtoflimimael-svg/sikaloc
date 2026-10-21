import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { FormulaireLogement } from '@/components/app/formulaire-logement'
import { Alerte, EnTetePage } from '@/components/ui/retours'
import { modifierLogement } from '@/lib/actions/logements'
import { bailleurOnboarde } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

export const metadata: Metadata = { title: 'Modifier le logement' }

export default async function PageModifierLogement({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await creerClientServeur()

  const [, reponseLogement] = await Promise.all([
    bailleurOnboarde(),
    supabase.from('logements').select('*').eq('id', id).maybeSingle(),
  ])
  const { data: logement, error } = reponseLogement

  if (error) {
    return <Alerte ton="erreur">Le logement n’a pas pu être chargé. Actualisez la page pour réessayer.</Alerte>
  }
  if (!logement) notFound()

  return (
    <div className="mx-auto max-w-[42rem]">
      <EnTetePage titre="Modifier le logement" />
      <FormulaireLogement action={modifierLogement.bind(null, id)} logement={logement} />
    </div>
  )
}
