import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { FormulairePaiement } from '@/components/app/formulaire-paiement'
import { Alerte, EnTetePage } from '@/components/ui/retours'
import { corrigerPaiement } from '@/lib/actions/paiements'
import { estCorrigeable } from '@/lib/paiement-utils'
import { bailleurOnboarde } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

export const metadata: Metadata = { title: 'Corriger le paiement' }

/**
 * Correction d'un paiement — spec §6.1.7 : possible pendant 5 minutes après
 * validation, ensuite le paiement est figé.
 */
export default async function PageCorrigerPaiement({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await bailleurOnboarde()
  const { id } = await params
  const supabase = await creerClientServeur()

  const [{ data: paiement }, { data: baux }] = await Promise.all([
    supabase.from('paiements').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('baux')
      .select('id, loyer_mensuel, logement:logements(adresse), locataire:locataires(nom)')
      .eq('statut', 'Actif')
      .order('created_at', { ascending: false }),
  ])

  if (!paiement) notFound()

  const corrigeable = estCorrigeable(paiement.valide_le, paiement.statut)

  const options = (baux ?? []).map((b) => {
    const logement = Array.isArray(b.logement) ? b.logement[0] : b.logement
    const locataire = Array.isArray(b.locataire) ? b.locataire[0] : b.locataire

    return {
      valeur: b.id,
      libelle: `${locataire?.nom ?? 'Locataire'} — ${logement?.adresse ?? 'logement'}`,
      loyerMensuel: Number(b.loyer_mensuel),
    }
  })

  if (!corrigeable) {
    return (
      <div className="mx-auto max-w-[42rem] space-y-lg">
        <EnTetePage titre="Paiement figé" />
        <Alerte ton="attention">
          La fenêtre de correction de 5 minutes est écoulée. Ce paiement ne peut
          plus être modifié : c&apos;est ce qui rend la quittance déjà émise
          opposable. Pour corriger une erreur, enregistrez un paiement
          rectificatif.
        </Alerte>
        <div className="flex flex-wrap gap-md">
          <Link href="/app/paiements" className="btn btn-secondary">
            Retour à l&apos;historique
          </Link>
          <Link href="/app/paiements/nouveau" className="btn btn-primary">
            Nouveau paiement
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[42rem] space-y-lg">
      <EnTetePage
        titre="Corriger le paiement"
        description="La correction repasse le paiement en brouillon : vous devrez le confirmer à nouveau pour réémettre le document."
      />

      <FormulairePaiement
        action={corrigerPaiement.bind(null, id)}
        baux={options}
        paiement={paiement}
        libelleSoumission="Enregistrer la correction"
      />
    </div>
  )
}
