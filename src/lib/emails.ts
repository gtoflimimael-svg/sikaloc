import 'server-only'

import { formaterFCFA } from '@/lib/format'
import { PRIX_STANDARD_FCFA } from '@/lib/plan'

/**
 * Emails transactionnels via Resend — rappels du cycle de grâce (v2.1 §4).
 *
 * Les messages sont volontairement sobres et sans reproche : un bailleur dont
 * le prélèvement a échoué a le plus souvent un problème de solde Mobile Money,
 * pas une intention de partir. Chaque message dit ce qui se passe, ce qui va se
 * passer, et comment y remédier en un clic.
 */

const RESEND_API = 'https://api.resend.com/emails'

export type ModeleEmail =
  | 'grace_j0'
  | 'grace_j3'
  | 'grace_j30'
  | 'purge_j90'
  | 'invitation_locataire'
  // ─── Les trois messages de l'écosystème ──────────────────────────────
  //
  // Les deux premiers s'adressent au LOCATAIRE et ne partent jamais d'eux-
  // mêmes : c'est le bailleur qui appuie, depuis sa quittance ou depuis son
  // écran d'impayés. Sikaloc n'écrit pas à un locataire dans le dos de son
  // bailleur — la relation est la sienne.
  | 'quittance_disponible'
  | 'relance_impaye'
  // Celui-ci va au BAILLEUR, et part tout seul : c'est la réponse à un geste
  // qu'il a fait — inviter quelqu'un — et il n'a aucun autre moyen de savoir
  // que son invitation a abouti.
  | 'locataire_a_rejoint'

export interface VariablesEmail {
  nom?: string
  jours?: number
  date_echec?: string
  [cle: string]: unknown
}

interface Message {
  sujet: string
  titre: string
  corps: string[]
  action?: { libelle: string; url: string }
  ton: 'info' | 'attention' | 'grave'
}

function urlBase(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
}

function urlAbonnement(): string {
  return `${urlBase()}/app/parametres/abonnement`
}

/**
 * L'écran d'export. Les messages de suspension annonçaient des données
 * « exportables » sans jamais dire où — la promesse existait, le chemin non.
 */
function urlExport(): string {
  return `${urlBase()}/app/parametres/donnees`
}

/**
 * Logo en PNG, pas en SVG : Outlook ignore purement et simplement le SVG
 * inline dans un `<img>`. Le fichier est rendu à 3x (voir
 * `scripts/generer-logo-email.ts`) et affiché ici à sa taille /3 — la
 * technique standard pour rester net sur écran Retina en email.
 */
function urlLogo(): string {
  return `${urlBase()}/marque/logo-email.png`
}

export function composer(modele: ModeleEmail, variables: VariablesEmail): Message {
  const prenom = String(variables.nom ?? '').trim().split(/\s+/)[0] || 'Bonjour'
  const action = { libelle: 'Régler mon abonnement', url: urlAbonnement() }

  switch (modele) {
    // ─── Invitation d'un locataire à Sikaloc_Me ───────────────────────
    //
    // Le ton n'est pas celui des rappels d'impayé : c'est le premier message
    // que Sikaloc adresse à cette personne, et elle n'a rien demandé. Il dit
    // qui invite, pourquoi, et ce que le lien ouvre — avant de le proposer.
    //
    // Le nom du bailleur est en tête : c'est lui qui rend le message légitime.
    // Un email d'un service inconnu se supprime ; un email de son propriétaire
    // se lit.
    case 'invitation_locataire': {
      const bailleurNom = String(variables.bailleur_nom ?? 'Votre bailleur')
      const logement = String(variables.logement ?? '').trim()

      return {
        ton: 'info',
        sujet: `${bailleurNom} vous invite sur Sikaloc`,
        titre: `${prenom}, votre espace locataire est prêt`,
        corps: [
          `${bailleurNom} utilise Sikaloc pour la gestion de ${logement || 'votre logement'}, et vous ouvre un accès.`,
          'Vous y retrouverez votre bail, vos loyers, vos paiements et vos quittances — les mêmes documents que votre bailleur, pas des copies.',
          `Ce lien vous est personnel et expire dans ${String(variables.validite_jours ?? 7)} jours.`,
        ],
        action: {
          libelle: 'Accéder à mon espace',
          url: String(variables.lien ?? urlBase()),
        },
      }
    }

    // ─── Au locataire : sa quittance ──────────────────────────────────
    //
    // Le document lui-même n'est PAS joint. Un PDF en pièce jointe se perd
    // dans une boîte, se transfère sans contrôle, et surtout n'est plus celui
    // du coffre si le bailleur corrige le paiement dans les cinq minutes. Le
    // lien mène au document réel, celui dont l'empreinte fait foi.
    case 'quittance_disponible': {
      const bailleurNom = String(variables.bailleur_nom ?? 'Votre bailleur')
      const periode = String(variables.periode ?? '')

      return {
        ton: 'info',
        sujet: `Votre quittance de ${periode}`,
        titre: `${prenom}, votre quittance est disponible`,
        corps: [
          `${bailleurNom} a enregistré votre règlement de ${periode}${
            variables.montant ? ` — ${String(variables.montant)}` : ''
          }.`,
          'La quittance correspondante est disponible dans votre espace Sikaloc_Me, avec l’ensemble de vos documents.',
        ],
        action: {
          libelle: 'Voir ma quittance',
          url: `${urlBase()}/me/paiements`,
        },
      }
    }

    // ─── Au locataire : un loyer en retard ────────────────────────────
    //
    // Le message le plus délicat du produit. Il réclame de l'argent à
    // quelqu'un, au nom de quelqu'un d'autre, et il peut se tromper : le
    // loyer a pu être réglé en espèces sans que le bailleur l'ait saisi.
    //
    // Il dit donc ce que Sikaloc SAIT — aucun règlement enregistré — et jamais
    // ce qu'il suppose. Et il laisse une porte : « si vous avez déjà réglé ».
    // Un rappel qui n'envisage pas son propre tort est une accusation.
    case 'relance_impaye': {
      const bailleurNom = String(variables.bailleur_nom ?? 'Votre bailleur')
      const periode = String(variables.periode ?? '')

      return {
        ton: 'attention',
        sujet: `Loyer de ${periode} — rappel de ${bailleurNom}`,
        titre: `${prenom}, le loyer de ${periode} n’est pas enregistré`,
        corps: [
          `${bailleurNom} n’a pas enregistré de règlement pour ${periode}${
            variables.montant ? `, soit ${String(variables.montant)}` : ''
          }.`,
          'Si vous avez déjà réglé ce loyer, signalez-le à votre bailleur : lui seul peut l’enregistrer, et ce rappel s’arrêtera.',
          'Le détail de vos loyers, mois par mois, est dans votre espace.',
        ],
        action: {
          libelle: 'Voir mes loyers',
          url: `${urlBase()}/me/loyers`,
        },
      }
    }

    // ─── Au bailleur : son invitation a abouti ────────────────────────
    //
    // Sans ce message, une invitation part et plus rien n'en revient. Le
    // bailleur ne saurait pas si son locataire a ouvert le lien, et
    // renverrait — ou n'oserait plus.
    case 'locataire_a_rejoint': {
      const locataireNom = String(variables.locataire_nom ?? 'Votre locataire')

      return {
        ton: 'info',
        sujet: `${locataireNom} a rejoint Sikaloc`,
        titre: `${prenom}, ${locataireNom} a rejoint son espace`,
        corps: [
          `${locataireNom} a accepté votre invitation et accède désormais à son logement, ses loyers et ses quittances.`,
          'Vos deux espaces partagent les mêmes documents : ce que vous enregistrez apparaît chez votre locataire, sans copie ni synchronisation.',
        ],
        action: {
          libelle: 'Voir mes locataires',
          url: `${urlBase()}/app/locataires`,
        },
      }
    }

    case 'grace_j0':
      return {
        ton: 'info',
        sujet: 'Sikaloc — votre paiement n’a pas abouti',
        titre: `${prenom}, votre dernier paiement n’a pas abouti`,
        corps: [
          `Le prélèvement de votre abonnement Sikaloc (${formaterFCFA(PRIX_STANDARD_FCFA)}) n’a pas pu être effectué.`,
          'Il s’agit le plus souvent d’un solde Mobile Money insuffisant au moment du débit. Vous pouvez régulariser en quelques secondes.',
          'Votre compte reste pleinement accessible pour le moment.',
        ],
        action,
      }

    case 'grace_j3':
      return {
        ton: 'attention',
        sujet: 'Sikaloc — votre compte passe en lecture seule',
        titre: `${prenom}, votre compte est passé en lecture seule`,
        corps: [
          'Faute de règlement, votre compte Sikaloc est désormais en lecture seule.',
          'Vous pouvez toujours consulter vos baux, vos paiements et vos quittances, et les télécharger. En revanche, l’enregistrement de nouveaux paiements et l’émission de quittances sont suspendus.',
          'Tout revient à la normale dès le règlement.',
        ],
        action,
      }

    case 'grace_j30':
      return {
        ton: 'grave',
        sujet: 'Sikaloc — compte suspendu',
        titre: `${prenom}, votre compte est suspendu`,
        corps: [
          'Votre abonnement est impayé depuis 30 jours : votre compte Sikaloc est suspendu.',
          `Vos données restent consultables et téléchargeables : vous pouvez récupérer à tout moment une archive complète de vos quittances et de vos paiements depuis ${urlExport()}. Sans régularisation, elles seront définitivement supprimées 90 jours après le premier impayé.`,
          'Un règlement rétablit immédiatement l’accès complet.',
        ],
        action,
      }

    case 'purge_j90':
      return {
        ton: 'grave',
        sujet: 'Sikaloc — suppression de vos données personnelles',
        titre: `${prenom}, vos données personnelles ont été supprimées`,
        corps: [
          'Votre abonnement étant impayé depuis 90 jours, les données personnelles de vos locataires ont été supprimées, conformément à notre politique de confidentialité.',
          'Vos baux et vos paiements sont conservés comme pièces comptables, mais les noms et coordonnées de vos locataires ne figurent plus dans nos systèmes.',
          'Vous pouvez rouvrir un compte à tout moment.',
        ],
      }
  }
}

/**
 * Échappe le HTML — seul `message.titre` en a besoin : c'est le seul champ du
 * gabarit à embarquer une valeur fournie par le bailleur (son prénom, extrait
 * de `nom`). Un nom contenant `<script>` ou une balise `<img onerror=…>` ne
 * doit pas pouvoir s'exécuter dans le client mail de son propriétaire — les
 * autres champs (`corps`, l'URL d'action) sont entièrement composés par le
 * serveur et n'ont pas besoin de ce traitement.
 */
function echapperHtml(valeur: string): string {
  return valeur
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/** Gabarit HTML — tokens du design system, en styles inline (contrainte email). */
function rendreHtml(message: Message): string {
  const accent =
    message.ton === 'grave' ? '#A63A3A' : message.ton === 'attention' ? '#A37B12' : '#5555BC'

  const paragraphes = message.corps
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#3A3A3D;">${p}</p>`,
    )
    .join('')

  const bouton = message.action
    ? `<a href="${message.action.url}"
          style="display:inline-block;background:#5555BC;color:#FFFFFF;text-decoration:none;
                 font-weight:600;font-size:16px;padding:14px 24px;border-radius:24px;">
         ${message.action.libelle}
       </a>`
    : ''

  return `<!doctype html>
<html lang="fr"><body style="margin:0;padding:0;background:#E8E8F5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#E8E8F5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:560px;background:#F4F4FB;border:1px solid #D8D8E6;border-radius:24px;">
        <tr><td style="padding:32px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

          <img src="${urlLogo()}" width="124" height="28" alt="Sikaloc"
               style="display:block;width:124px;height:28px;border:0;" />

          <div style="height:4px;width:48px;background:${accent};border-radius:2px;margin:24px 0;"></div>

          <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;line-height:1.3;
                     color:#131314;letter-spacing:-0.5px;">${echapperHtml(message.titre)}</h1>

          ${paragraphes}
          ${bouton}

          <p style="margin:32px 0 0;padding-top:16px;border-top:1px solid #D8D8E6;
                    font-size:12px;line-height:1.5;color:#82828E;">
            Sikaloc — gestion locative au Bénin. Vous recevez ce message parce que
            vous avez un compte Sikaloc. Données hébergées en Europe.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function rendreTexte(message: Message): string {
  const lignes = [message.titre, '', ...message.corps]
  if (message.action) lignes.push('', `${message.action.libelle} : ${message.action.url}`)
  lignes.push('', '— Sikaloc, gestion locative au Bénin')

  return lignes.join('\n')
}

export interface ResultatEnvoi {
  ok: boolean
  id?: string
  message?: string
}

/**
 * Envoie un email via Resend.
 *
 * `idempotence` est transmis à Resend : si la file est rejouée après un
 * incident, le même message ne part pas deux fois.
 */
export async function envoyerEmail(
  destinataire: string,
  modele: ModeleEmail,
  variables: VariablesEmail,
  idempotence?: string,
): Promise<ResultatEnvoi> {
  const cle = process.env.RESEND_API_KEY

  if (!cle) {
    return { ok: false, message: 'RESEND_API_KEY absente : envoi impossible.' }
  }

  const expediteur = process.env.EMAIL_FROM ?? 'onboarding@resend.dev'
  const nomExpediteur =
    process.env.EMAIL_FROM_NAME ?? process.env.APP_NAME ?? 'Sikaloc'
  const message = composer(modele, variables)

  try {
    const reponse = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cle}`,
        'Content-Type': 'application/json',
        ...(idempotence ? { 'Idempotency-Key': idempotence } : {}),
      },
      body: JSON.stringify({
        from: `${nomExpediteur} <${expediteur}>`,
        to: [destinataire],
        subject: message.sujet,
        html: rendreHtml(message),
        text: rendreTexte(message),
      }),
    })

    const donnees = await reponse.json().catch(() => ({}))

    if (!reponse.ok) {
      return {
        ok: false,
        message: donnees?.message ?? `Resend a répondu ${reponse.status}.`,
      }
    }

    return { ok: true, id: donnees?.id }
  } catch (erreur) {
    return {
      ok: false,
      message:
        erreur instanceof Error
          ? `Contact impossible avec Resend : ${erreur.message}`
          : 'Contact impossible avec Resend.',
    }
  }
}
