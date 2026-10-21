import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { FormulaireLocataire } from '@/components/app/formulaire-locataire'
import { SignatureLocataire } from '@/components/app/signature-locataire'
import { Alerte, EnTetePage } from '@/components/ui/retours'
import { modifierLocataire } from '@/lib/actions/locataires'
import { bailleurOnboarde } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

export const metadata: Metadata = { title: 'Modifier le locataire' }

export default async function PageModifierLocataire({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await creerClientServeur()

  // Les RLS filtrent : un identifiant appartenant à un autre bailleur ne
  // renvoie rien, et la page tombe en 404.
  const [, reponseLocataire] = await Promise.all([
    bailleurOnboarde(),
    supabase.from('locataires').select('*').eq('id', id).maybeSingle(),
  ])
  const { data: locataire, error } = reponseLocataire

  if (error) {
    return <Alerte ton="erreur">Le locataire n’a pas pu être chargé. Actualisez la page pour réessayer.</Alerte>
  }
  if (!locataire) notFound()

  return (
    <div className="mx-auto max-w-[42rem] space-y-xl">
      <EnTetePage titre="Modifier le locataire" />
      <FormulaireLocataire
        action={modifierLocataire.bind(null, id)}
        locataire={locataire}
      />
      <SignatureLocataire
        locataireId={id}
        signatureExistante={Boolean(locataire.signature_chemin)}
      />
    </div>
  )
}
