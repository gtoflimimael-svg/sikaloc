import { NextResponse, type NextRequest } from 'next/server'

import { signatureWebhookValide } from '@/lib/fedapay'
import { reglerTransaction } from '@/lib/reglement-abonnement'

/**
 * Notification de paiement FedaPay.
 *
 * Deux contrôles indépendants, dans cet ordre :
 *
 *   1. la signature `X-FEDAPAY-SIGNATURE` avec `FEDAPAY_WEBHOOK_SECRET`
 *      obligatoire — elle atteste que la requête vient bien de FedaPay ;
 *   2. un appel à `GET /transactions/{id}` avec notre clé secrète — c'est lui
 *      qui fait foi.
 *
 * Le second est le rempart réel : le corps d'une requête entrante reste une
 * donnée reçue de l'extérieur, et le crédit d'un abonnement ne doit jamais
 * dépendre de ce qu'elle affirme. De la notification, on ne retient donc qu'un
 * identifiant de transaction — le reste est vérifié à la source.
 *
 * Le règlement lui-même vit dans `reglerTransaction`, partagé avec la
 * réconciliation au retour du guichet : une seule implémentation de la règle,
 * un seul endroit où l'idempotence est garantie.
 *
 * La réponse est 200 même sur transaction refusée, pour ne pas déclencher de
 * renvois inutiles ; seule une erreur de notre côté renvoie 503.
 */
export async function POST(request: NextRequest) {
  const corpsBrut = await request.text()
  const secretWebhook = process.env.FEDAPAY_WEBHOOK_SECRET

  if (!secretWebhook) {
    return NextResponse.json({ erreur: 'Notification indisponible.' }, { status: 503 })
  }

  {
    const signature = request.headers.get('x-fedapay-signature')
    if (!signatureWebhookValide(corpsBrut, signature, secretWebhook)) {
      return NextResponse.json({ erreur: 'Signature invalide.' }, { status: 401 })
    }
  }

  let evenement: Record<string, unknown>
  try {
    evenement = JSON.parse(corpsBrut)
  } catch {
    return NextResponse.json({ recu: true }, { status: 200 })
  }

  if (!evenement || typeof evenement !== 'object' || Array.isArray(evenement)) {
    return NextResponse.json({ recu: true }, { status: 200 })
  }

  const nomEvenement = String(evenement.name ?? evenement.event ?? '')
  const brut = evenement.entity ?? evenement.data
  const entite = brut && typeof brut === 'object' ? brut as Record<string, unknown> : {}
  const transactionId = entite.id ?? (entite as { transaction?: { id?: unknown } }).transaction?.id

  if (!transactionId) {
    return NextResponse.json({ recu: true }, { status: 200 })
  }

  const etat = await reglerTransaction(String(transactionId))

  // Vérification impossible (clé absente, API injoignable, base en erreur) :
  // on ne crédite rien et on laisse FedaPay réessayer.
  if (etat === 'indisponible') {
    return NextResponse.json({ recu: false }, { status: 503 })
  }

  return NextResponse.json({ recu: true, evenement: nomEvenement, etat }, { status: 200 })
}
