// Faux FedaPay pour les tests de bout en bout (FN-01).
//
// Imite les quatre appels faits par `src/lib/fedapay.ts` : création de
// transaction, jeton de paiement, lecture d'une transaction et d'une devise,
// avec les mêmes enveloppes (`v1/transaction`) que l'API réelle. Écoute
// uniquement sur 127.0.0.1. Le test pilote le statut de chaque transaction.
import { createHmac } from 'node:crypto'
import http from 'node:http'

export function signerWebhook(corps, secret, horodatage = Math.floor(Date.now() / 1000)) {
  const s = createHmac('sha256', secret).update(`${horodatage}.${corps}`).digest('hex')
  return `t=${horodatage},s=${s}`
}

export async function demarrerFauxFedaPay(port) {
  const transactions = new Map()
  const appels = []
  // Identifiants aléatoires : plusieurs exécutions sur une même base restent distinctes.
  let prochainId = 9_000_000 + Math.floor(Math.random() * 900_000)

  const serveur = http.createServer((req, res) => {
    const morceaux = []
    req.on('data', (m) => morceaux.push(m))
    req.on('end', () => {
      const corps = morceaux.length ? JSON.parse(Buffer.concat(morceaux).toString('utf8') || '{}') : {}
      const { pathname } = new URL(req.url, 'http://127.0.0.1')
      appels.push({ methode: req.method, chemin: pathname, autorisation: Boolean(req.headers.authorization) })
      const repondre = (statut, donnees, type = 'application/json') => {
        res.writeHead(statut, { 'content-type': type })
        res.end(type === 'application/json' ? JSON.stringify(donnees) : donnees)
      }
      if (!req.headers.authorization?.startsWith('Bearer sk_sandbox_') && pathname.startsWith('/v1/')) {
        return repondre(401, { message: 'Clé absente.' })
      }

      if (req.method === 'POST' && pathname === '/v1/transactions') {
        const id = prochainId++
        const transaction = {
          id, reference: `trx-e2e-${id}`, description: corps.description, amount: corps.amount,
          currency: { iso: corps.currency?.iso }, custom_metadata: corps.custom_metadata,
          status: 'pending', operation: 'payment', deleted_at: null, refunded_at: null,
        }
        transactions.set(String(id), transaction)
        return repondre(200, { 'v1/transaction': transaction })
      }
      let m = pathname.match(/^\/v1\/transactions\/(\d+)\/token$/)
      if (req.method === 'POST' && m) {
        if (!transactions.has(m[1])) return repondre(404, { message: 'Transaction inconnue.' })
        return repondre(200, { token: `jeton-${m[1]}`, url: `http://127.0.0.1:${port}/paiement/${m[1]}` })
      }
      m = pathname.match(/^\/v1\/transactions\/(\d+)$/)
      if (req.method === 'GET' && m) {
        const transaction = transactions.get(m[1])
        return transaction ? repondre(200, { 'v1/transaction': transaction }) : repondre(404, { message: 'Transaction inconnue.' })
      }
      m = pathname.match(/^\/paiement\/(\d+)$/)
      if (req.method === 'GET' && m) {
        return repondre(200, `<!doctype html><html lang="fr"><title>Faux FedaPay</title><h1>Paiement ${m[1]}</h1></html>`, 'text/html; charset=utf-8')
      }
      return repondre(404, { message: 'Route inconnue du faux FedaPay.' })
    })
  })

  await new Promise((resolve) => serveur.listen(port, '127.0.0.1', resolve))
  return {
    base: `http://127.0.0.1:${port}/v1`,
    transactions,
    appels,
    definirStatut(id, statut) {
      const transaction = transactions.get(String(id))
      if (!transaction) throw new Error(`transaction ${id} inconnue`)
      transaction.status = statut
    },
    fermer: () => new Promise((resolve) => serveur.close(resolve)),
  }
}
