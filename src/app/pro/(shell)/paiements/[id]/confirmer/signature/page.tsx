import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { EtapeSignatureQuittance } from '@/components/app/etape-signature-quittance'
import { regenererQuittance, validerPaiement } from '@/lib/actions/paiements'
import { bailleurCourant } from '@/lib/session'
import { signatureBailleurDisponible } from '@/lib/quittance'
import { creerClientServeur } from '@/lib/supabase/serveur'

export const metadata: Metadata = { title: 'Votre signature' }

type ParametresPage = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ operation?: string | string[]; origine?: string | string[] }>
}

/**
 * Étape de signature dans le parcours de génération. L'intention ne contient
 * que l'action; le paiement et tous ses montants sont relus côté serveur.
 */
export default async function PageSignatureQuittance({ params, searchParams }: ParametresPage) {
  const [{ id }, recherche, bailleur] = await Promise.all([
    params,
    searchParams,
    bailleurCourant(),
  ])
  const operation = typeof recherche.operation === 'string' ? recherche.operation : null
  const origine = recherche.origine === 'quittance' ? 'quittance' : 'confirmation'
  if (operation !== 'valider' && operation !== 'regenerer') notFound()

  const supabase = await creerClientServeur()
  const { data: paiement, error } = await supabase
    .from('paiements')
    // Les données du paiement ne sont pas affichées ici. On relit uniquement
    // ce qui permet de vérifier l'accès et de reprendre l'opération d'origine.
    .select('id,bailleur_id,statut,quittance:quittances(id)')
    .eq('id', id)
    .eq('bailleur_id', bailleur.id)
    .maybeSingle()

  if (error || !paiement || paiement.bailleur_id !== bailleur.id) notFound()

  const quittance = Array.isArray(paiement.quittance)
    ? paiement.quittance[0]
    : paiement.quittance
  if (operation === 'regenerer' && paiement.statut !== 'Validé') notFound()

  const retourHref = operation === 'regenerer' && origine === 'quittance' && quittance?.id
    ? `/pro/quittances/${quittance.id}`
    : `/pro/paiements/${paiement.id}/confirmer`

  // Le fichier, pas seulement le chemin de profil, détermine si une signature
  // utilisable existe. En cas de retour/rechargement, on renvoie à l'opération
  // d'origine plutôt que d'afficher une étape désormais inutile.
  if (await signatureBailleurDisponible(bailleur.signature_chemin)) redirect(retourHref)

  const actionReprise = operation === 'valider'
    ? validerPaiement.bind(null, paiement.id)
    : regenererQuittance.bind(null, paiement.id)

  return (
    <div className="mx-auto w-full max-w-[42rem] space-y-md">
      <Link href={retourHref} className="inline-flex text-body-sm text-mute hover:text-ink">
        ← Retour
      </Link>

      <header className="space-y-xs">
        <h1 className="page-title">Votre signature</h1>
        <p className="text-body-md text-mute">Signez pour finaliser votre quittance.</p>
      </header>

      <section aria-label="Enregistrer votre signature">
        <EtapeSignatureQuittance actionReprise={actionReprise} />
      </section>
    </div>
  )
}
