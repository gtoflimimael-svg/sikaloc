import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { FormulaireLocataire } from '@/components/app/formulaire-locataire'
import { EnTetePage } from '@/components/ui/retours'
import { modifierLocataire } from '@/lib/actions/locataires'
import { bailleurOnboarde } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

export const metadata: Metadata = { title: 'Modifier le locataire' }

export default async function PageModifierLocataire({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await bailleurOnboarde()
  const { id } = await params
  const supabase = await creerClientServeur()

  // Les RLS filtrent : un identifiant appartenant à un autre bailleur ne
  // renvoie rien, et la page tombe en 404.
  const { data: locataire } = await supabase
    .from('locataires')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!locataire) notFound()

  return (
    <div className="mx-auto max-w-[42rem]">
      <EnTetePage titre="Modifier le locataire" />
      <FormulaireLocataire
        action={modifierLocataire.bind(null, id)}
        locataire={locataire}
      />
    </div>
  )
}
