import { NextResponse, type NextRequest } from 'next/server'

import { requeteCronAutorisee } from '@/lib/cron-auth'
import { decrireEcarts, verifierSchema } from '@/lib/schema'

/**
 * Contrôle quotidien du schéma de la base.
 *
 * Le 23 août 2026, la génération de quittance était cassée depuis trois jours,
 * en silence : l'erreur était attrapée proprement et rendue au formulaire, donc
 * invisible côté serveur. Personne ne pouvait le savoir sans essayer.
 *
 * Cette tâche ferme ce trou. Elle compare chaque colonne attendue par le code à
 * ce que la base contient réellement, et n'écrit **que si quelque chose
 * manque** — une alerte qui parle tous les jours n'est plus une alerte.
 *
 * Volontairement PAS branchée sur le build : un contrôle exécuté au
 * déploiement ferait échouer une mise en ligne de simple correctif visuel
 * chaque fois que la base serait momentanément injoignable. On échangerait une
 * panne silencieuse contre des déploiements fragiles.
 */

// Rejouer 111 vérifications de colonnes dépasse le délai d'une requête ordinaire.
export const maxDuration = 120

const DESTINATAIRE =
  process.env.EMAIL_EXPLOITATION ?? process.env.EMAIL_FROM ?? 'bonjour@sikaloc.com'

/**
 * Envoi direct, sans passer par les gabarits de `src/lib/emails.ts` : ceux-ci
 * s'adressent à un bailleur (« vous recevez ce message parce que vous avez un
 * compte Sikaloc »). Celui-ci s'adresse à l'exploitant, et doit rester nu.
 */
async function alerter(sujet: string, texte: string): Promise<boolean> {
  const cle = process.env.RESEND_API_KEY
  if (!cle) return false

  const reponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `Sikaloc — surveillance <${process.env.EMAIL_FROM ?? 'no-reply@sikaloc.com'}>`,
      to: [DESTINATAIRE],
      subject: sujet,
      text: texte,
    }),
  })

  return reponse.ok
}

export async function POST(request: NextRequest) {
  if (!requeteCronAutorisee(request.headers)) {
    return NextResponse.json({ erreur: 'Non autorisé.' }, { status: 401 })
  }

  let rapport
  try {
    rapport = await verifierSchema()
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : 'inconnue'
    console.error('[cron/schema] vérification impossible :', message)
    await alerter(
      'Sikaloc — le contrôle de schéma n’a pas pu s’exécuter',
      `Le contrôle quotidien du schéma a échoué avant de rendre son verdict.\n\n` +
        `Raison : ${message}\n\n` +
        `Ce n’est pas nécessairement une panne de la base : cela peut venir d’une\n` +
        `variable d’environnement absente. Mais tant que ce message revient, le\n` +
        `schéma n’est plus surveillé.`,
    )
    return NextResponse.json({ erreur: message }, { status: 500 })
  }

  if (rapport.conforme) {
    // Silence délibéré : pas d'email quand tout va bien.
    return NextResponse.json({
      conforme: true,
      tables: rapport.tablesVerifiees,
      colonnes: rapport.colonnesVerifiees,
    })
  }

  const details = decrireEcarts(rapport)
  console.error('[cron/schema] écarts détectés :\n' + details)

  const envoye = await alerter(
    'Sikaloc — une colonne manque en base de données',
    `Le contrôle quotidien a trouvé un écart entre ce que le code attend et ce\n` +
      `que la base contient.\n\n` +
      `${details}\n\n` +
      `CE QUE ÇA VEUT DIRE\n` +
      `Une migration a probablement été écrite sans être appliquée à la\n` +
      `production. C'est exactement ce qui avait cassé la génération de\n` +
      `quittance pendant trois jours, en août 2026.\n\n` +
      `CE QU'IL FAUT FAIRE\n` +
      `Ajouter la ou les colonnes manquantes dans le SQL Editor de Supabase,\n` +
      `puis relancer « npm run verifier:schema » pour confirmer.\n\n` +
      `Les fonctionnalités qui dépendent de ces colonnes sont probablement\n` +
      `cassées en ce moment même, sans lever la moindre erreur serveur.`,
  )

  return NextResponse.json(
    { conforme: false, ecarts: rapport.ecarts, alerteEnvoyee: envoye },
    { status: 500 },
  )
}
