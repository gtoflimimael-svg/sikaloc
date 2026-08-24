import 'server-only'

import { COULEUR_MARQUE } from '@/lib/marque'

/**
 * Emails adressés aux PROSPECTS du guide.
 *
 * Module séparé de `src/lib/emails.ts` à dessein. Celui-là s'adresse à des
 * bailleurs et clôt chaque message par « vous recevez ce message parce que vous
 * avez un compte Sikaloc » — une phrase fausse pour quelqu'un qui n'en a pas, et
 * qui ne porte aucun lien de désinscription.
 *
 * Ici, chaque envoi rappelle d'où vient l'adresse et comment s'en retirer en un
 * clic. C'est ce que la loi attend d'un message de prospection, et c'est aussi
 * la moindre des politesses.
 */

const RESEND_API = 'https://api.resend.com/emails'

export interface PieceJointe {
  nom: string
  contenu: Buffer
}

export interface ResultatEnvoi {
  ok: boolean
  message?: string
}

function site(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sikaloc.com').replace(/\/$/, '')
}

/** Échappe le texte inséré dans le gabarit HTML. */
function echapper(texte: string): string {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

interface Contenu {
  sujet: string
  titre: string
  paragraphes: string[]
  bouton?: { libelle: string; url: string }
  /** Absent uniquement pour le message de confirmation, qui n'est pas encore de la prospection. */
  urlDesinscription?: string
}

function rendreHtml({ titre, paragraphes, bouton, urlDesinscription }: Contenu): string {
  const corps = paragraphes
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3A3A3D">${p}</p>`,
    )
    .join('')

  const action = bouton
    ? `<p style="margin:24px 0">
         <a href="${echapper(bouton.url)}"
            style="display:inline-block;background:${COULEUR_MARQUE};color:#FFFFFF;
                   text-decoration:none;padding:13px 22px;border-radius:10px;
                   font-size:15px;font-weight:600">${echapper(bouton.libelle)}</a>
       </p>`
    : ''

  const pied = urlDesinscription
    ? `<p style="margin:0;font-size:12px;line-height:1.6;color:#82828E">
         Vous recevez ce message parce que vous avez demandé le guide sur
         <a href="${site()}" style="color:#82828E">sikaloc.com</a> et confirmé votre adresse.
         <a href="${echapper(urlDesinscription)}" style="color:#82828E">Me désinscrire</a> —
         effet immédiat, sans justification.
       </p>`
    : `<p style="margin:0;font-size:12px;line-height:1.6;color:#82828E">
         Ce message a été envoyé parce que cette adresse a été saisie sur
         <a href="${site()}" style="color:#82828E">sikaloc.com</a>.
         Si ce n'était pas vous, ignorez-le : sans confirmation de votre part,
         l'adresse est effacée et rien d'autre ne vous sera envoyé.
       </p>`

  return `<!doctype html>
<html lang="fr"><body style="margin:0;padding:24px;background:#F4F4FB;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:14px;padding:32px">
    <p style="margin:0 0 24px;font-size:19px;font-weight:700;color:${COULEUR_MARQUE}">Sikaloc</p>
    <h1 style="margin:0 0 18px;font-size:21px;line-height:1.3;color:#131314">${echapper(titre)}</h1>
    ${corps}
    ${action}
    <hr style="border:none;border-top:1px solid #D8D8E6;margin:28px 0 18px">
    ${pied}
  </div>
</body></html>`
}

function rendreTexte({ titre, paragraphes, bouton, urlDesinscription }: Contenu): string {
  const sansBalises = (t: string) => t.replace(/<[^>]+>/g, '')

  return [
    titre,
    '',
    ...paragraphes.map(sansBalises),
    ...(bouton ? ['', `${bouton.libelle} : ${bouton.url}`] : []),
    '',
    '—',
    urlDesinscription
      ? `Vous recevez ce message parce que vous avez demandé le guide sur ${site()} et confirmé votre adresse. Me désinscrire : ${urlDesinscription}`
      : `Cette adresse a été saisie sur ${site()}. Si ce n'était pas vous, ignorez ce message : sans confirmation, l'adresse est effacée.`,
  ].join('\n')
}

/**
 * Journal local, en développement uniquement.
 *
 * Éprouver le parcours d'inscription avec la vraie clé Resend enverrait de vrais
 * messages vers des adresses fictives : rebonds garantis, et réputation
 * d'expéditeur abîmée pour de bon. Quand `GUIDE_EMAILS_JOURNAL` désigne un
 * fichier, l'envoi y est consigné au lieu de partir.
 *
 * Double garde : la variable doit être posée ET la base interrogée doit être
 * locale. La production ne pointe jamais vers `127.0.0.1`, un oubli de
 * configuration en ligne ne peut donc pas transformer des envois réels en
 * écritures silencieuses.
 *
 * `NODE_ENV` ne convient pas comme garde : `next start` le fixe à `production`
 * y compris sur une machine de développement. Une première version reposait
 * dessus, et un message d'essai est réellement parti vers une adresse fictive.
 */
async function journaliser(
  destinataire: string,
  contenu: Contenu,
  pieces?: PieceJointe[],
): Promise<boolean> {
  const fichier = process.env.GUIDE_EMAILS_JOURNAL
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  if (!fichier || !/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(base)) return false

  const { appendFile } = await import('node:fs/promises')
  await appendFile(
    fichier,
    JSON.stringify({
      destinataire,
      sujet: contenu.sujet,
      piecesJointes: pieces?.length ?? 0,
      desinscription: contenu.urlDesinscription ?? null,
      horodatage: new Date().toISOString(),
    }) + '\n',
    'utf8',
  )

  return true
}

async function envoyer(
  destinataire: string,
  contenu: Contenu,
  pieces?: PieceJointe[],
): Promise<ResultatEnvoi> {
  if (await journaliser(destinataire, contenu, pieces)) return { ok: true }

  const cle = process.env.RESEND_API_KEY
  if (!cle) return { ok: false, message: 'RESEND_API_KEY absente : envoi impossible.' }

  const expediteur = process.env.EMAIL_FROM ?? 'onboarding@resend.dev'
  const nom = process.env.EMAIL_FROM_NAME ?? process.env.APP_NAME ?? 'Sikaloc'

  try {
    const reponse = await fetch(RESEND_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${nom} <${expediteur}>`,
        to: [destinataire],
        subject: contenu.sujet,
        html: rendreHtml(contenu),
        text: rendreTexte(contenu),
        ...(contenu.urlDesinscription
          ? {
              // En-têtes standard : le lien « se désinscrire » du client mail
              // fonctionne alors sans que le lecteur ait à chercher dans le pied
              // de page.
              headers: {
                'List-Unsubscribe': `<${contenu.urlDesinscription}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
              },
            }
          : {}),
        ...(pieces?.length
          ? {
              attachments: pieces.map((p) => ({
                filename: p.nom,
                content: p.contenu.toString('base64'),
              })),
            }
          : {}),
      }),
    })

    if (!reponse.ok) {
      const detail = await reponse.text().catch(() => '')
      return { ok: false, message: `Resend a refusé l'envoi (${reponse.status}). ${detail.slice(0, 160)}` }
    }

    return { ok: true }
  } catch (erreur) {
    return { ok: false, message: erreur instanceof Error ? erreur.message : 'Envoi impossible.' }
  }
}

/**
 * Premier message : demande de confirmation.
 *
 * Le guide n'y est PAS joint. C'est tout l'intérêt du procédé — tant que le
 * destinataire n'a pas cliqué, rien ne prouve qu'il a demandé quoi que ce soit.
 */
export function envoyerConfirmation(email: string, jeton: string): Promise<ResultatEnvoi> {
  return envoyer(email, {
    sujet: 'Confirmez votre adresse pour recevoir le guide',
    titre: 'Une dernière étape',
    paragraphes: [
      'Vous avez demandé le guide <strong>« Ce que contient une quittance Sikaloc »</strong>.',
      'Cliquez ci-dessous pour confirmer votre adresse. Le guide vous sera envoyé dans la foulée, en pièce jointe.',
      'Ce lien est valable une seule fois.',
    ],
    bouton: { libelle: 'Confirmer et recevoir le guide', url: `${site()}/guide/confirmer?jeton=${jeton}` },
  })
}

/** Second message : le guide, une fois le consentement recueilli. */
export function envoyerGuide(
  email: string,
  jeton: string,
  pdf: Buffer,
): Promise<ResultatEnvoi> {
  return envoyer(
    email,
    {
      sujet: 'Votre guide — Ce que contient une quittance Sikaloc',
      titre: 'Voici votre guide',
      paragraphes: [
        'Merci d’avoir confirmé votre adresse. Le guide est joint à ce message, en PDF.',
        'Il décrit, ligne par ligne, ce que Sikaloc écrit sur les documents qu’il produit. Tout y est vérifiable sur un document réel, sans créer de compte.',
        `Vous pouvez d’ailleurs en ouvrir un tout de suite : <a href="${site()}/exemple-quittance" style="color:${COULEUR_MARQUE}">${site().replace(/^https?:\/\//, '')}/exemple-quittance</a>`,
      ],
      bouton: { libelle: 'Découvrir Sikaloc', url: `${site()}/?utm_source=guide` },
      urlDesinscription: `${site()}/guide/desinscription?jeton=${jeton}`,
    },
    [{ nom: 'Guide-Sikaloc-Ce-que-contient-une-quittance.pdf', contenu: pdf }],
  )
}
