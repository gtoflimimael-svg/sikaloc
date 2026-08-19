import type { Metadata } from 'next'

import { FormulairePaiement } from '@/components/app/formulaire-paiement'
import { EnTetePage } from '@/components/ui/retours'
import { enregistrerPaiement } from '@/lib/actions/paiements'
import { bailleurOnboarde } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

export const metadata: Metadata = { title: 'Enregistrer un paiement' }

export default async function PageNouveauPaiement({
  searchParams,
}: {
  searchParams: Promise<{ bail?: string }>
}) {
  await bailleurOnboarde()
  const { bail } = await searchParams
  const supabase = await creerClientServeur()

  const { data: baux } = await supabase
    .from('baux')
    .select('id, loyer_mensuel, logement:logements(adresse), locataire:locataires(nom)')
    .eq('statut', 'Actif')
    .order('created_at', { ascending: false })

  const options = (baux ?? []).map((b) => {
    const logement = Array.isArray(b.logement) ? b.logement[0] : b.logement
    const locataire = Array.isArray(b.locataire) ? b.locataire[0] : b.locataire

    return {
      valeur: b.id,
      libelle: `${locataire?.nom ?? 'Locataire'} — ${logement?.adresse ?? 'logement'}`,
      loyerMensuel: Number(b.loyer_mensuel),
    }
  })

  return (
    <div className="mx-auto max-w-[42rem]">
      <EnTetePage
        titre="Enregistrer un paiement"
        description="Vous verrez un récapitulatif avant validation. La quittance est générée à la confirmation."
      />

      <FormulairePaiement
        action={enregistrerPaiement}
        baux={options}
        bailPreselectionne={bail}
      />
    </div>
  )
}
