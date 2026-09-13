'use server'

import { revalidatePath } from 'next/cache'

import { formaterFCFA, formaterPeriode } from '@/lib/format'
import { envoyerEmail } from '@/lib/emails'
import { capacites } from '@/lib/plan'
import { bailleurOnboarde } from '@/lib/session'
import { creerClientAdmin } from '@/lib/supabase/admin'
import { creerClientServeur } from '@/lib/supabase/serveur'
import type { EtatFormulaire } from '@/lib/validation'

/**
 * Les emails que le bailleur adresse à son locataire.
 *
 * ─── Rien ne part tout seul ─────────────────────────────────────────────────
 *
 * Les deux actions de ce fichier s'exécutent parce qu'un bailleur a appuyé sur
 * un bouton. Sikaloc n'écrit pas à un locataire de sa propre initiative : la
 * relation est celle du bailleur, et une relance envoyée automatiquement au
 * mauvais moment abîme ce que le produit est censé protéger.
 *
 * C'est aussi ce qui rend le résultat visible. Un envoi déclenché en arrière-
 * plan échoue en silence ; ici, le bailleur lit ce qui s'est passé.
 *
 * ─── Trois refus possibles, tous dits ───────────────────────────────────────
 *
 *   pas d'adresse        la fiche du locataire n'en porte pas
 *   désabonné            il a demandé à ne plus recevoir d'email
 *   envoi impossible     Resend a refusé
 *
 * Aucun n'est silencieux. Un bailleur qui croit avoir relancé et qui n'a rien
 * envoyé est dans une situation pire que s'il n'avait pas essayé.
 */

const MESSAGE_SANS_ADRESSE =
  'Ce locataire n’a pas d’adresse email enregistrée. Ajoutez-la sur sa fiche pour pouvoir lui écrire.'

const MESSAGE_DESABONNE =
  'Ce locataire a demandé à ne plus recevoir d’email de Sikaloc. Vous pouvez toujours le joindre directement.'

/** Ce qu'il faut savoir du destinataire avant de lui écrire. */
interface Destinataire {
  nom: string
  email: string | null
  notifEmail: boolean
}

/**
 * Le locataire d'un bail, lu sous la session du bailleur.
 *
 * Passe par le client authentifié : les politiques de `baux` et `locataires`
 * font l'autorisation. Un identifiant de bail qui n'est pas le sien ne rend
 * rien, et l'action s'arrête là — sans que ce fichier ait à le vérifier.
 */
async function destinataireDuBail(bailId: string): Promise<Destinataire | null> {
  const supabase = await creerClientServeur()

  const { data } = await supabase
    .from('baux')
    .select('locataire:locataires(nom, email, notif_email)')
    .eq('id', bailId)
    .maybeSingle()

  const brut = data?.locataire
  const locataire = (Array.isArray(brut) ? brut[0] : brut) as
    | { nom: string; email: string | null; notif_email: boolean }
    | undefined

  if (!locataire) return null

  return {
    nom: locataire.nom,
    email: locataire.email,
    notifEmail: locataire.notif_email !== false,
  }
}

function refus(destinataire: Destinataire | null): EtatFormulaire | null {
  if (!destinataire) return { erreur: 'Ce bail est introuvable.' }
  if (!destinataire.email) return { erreur: MESSAGE_SANS_ADRESSE }
  if (!destinataire.notifEmail) return { erreur: MESSAGE_DESABONNE }
  return null
}

// ═══ La quittance ════════════════════════════════════════════════════════════

/**
 * Envoie au locataire l'avis que sa quittance est disponible.
 *
 * ─── Le PDF n'est pas joint, et c'est délibéré ──────────────────────────────
 *
 * Le message porte un lien vers l'espace du locataire. Une pièce jointe serait
 * une copie : elle vieillit, se transfère sans contrôle, et cesse d'être le
 * document du coffre dès que le bailleur corrige le paiement dans les cinq
 * minutes qui suivent. Le lien mène toujours au document dont l'empreinte fait
 * foi.
 */
export async function envoyerQuittanceParEmail(quittanceId: string): Promise<EtatFormulaire> {
  const bailleur = await bailleurOnboarde()
  const supabase = await creerClientServeur()

  // Le bail passe par le paiement : `quittances` ne porte plus de colonne
  // `bail_id`, précisément parce qu'elle pouvait désigner un autre bail que
  // celui du document (voir 20260913000800).
  const { data: quittance } = await supabase
    .from('quittances')
    .select('id, paiement:paiements(bail_id, periode_debut, montant)')
    .eq('id', quittanceId)
    .maybeSingle()

  const brut = quittance?.paiement
  const paiement = (Array.isArray(brut) ? brut[0] : brut) as
    | { bail_id: string; periode_debut: string; montant: number }
    | undefined

  if (!paiement) return { erreur: 'Ce document est introuvable.' }

  const destinataire = await destinataireDuBail(paiement.bail_id)
  const empechement = refus(destinataire)
  if (empechement) return empechement

  const envoi = await envoyerEmail(destinataire!.email!, 'quittance_disponible', {
    nom: destinataire!.nom,
    bailleur_nom: bailleur.nom,
    periode: formaterPeriode(paiement.periode_debut),
    montant: formaterFCFA(paiement.montant),
  })

  if (!envoi.ok) {
    return { erreur: `L’envoi a échoué : ${envoi.message ?? 'raison inconnue'}` }
  }

  return { succes: `Quittance envoyée à ${destinataire!.email}.` }
}

// ═══ La relance ══════════════════════════════════════════════════════════════

/**
 * Relance un loyer en retard par email.
 *
 * ─── Réservé au plan Standard, comme la relance WhatsApp ────────────────────
 *
 * Non par avarice : un email part de l'infrastructure de Sikaloc et lui coûte,
 * là où un lien WhatsApp ne fait qu'ouvrir une application sur le téléphone du
 * bailleur. La règle est déjà celle des relances existantes ; l'appliquer ici
 * évite d'avoir deux réponses à « ai-je droit aux relances ? ».
 *
 * ─── La période est relue, jamais reprise du formulaire ─────────────────────
 *
 * Le montant et le mois qui partent dans le message sont ceux de `v_echeances`,
 * relus sous la session du bailleur. Un formulaire se rejoue : accepter son
 * montant reviendrait à laisser réclamer n'importe quelle somme au nom de
 * n'importe qui.
 */
export async function relancerParEmail(
  bailId: string,
  periodeDebut: string,
): Promise<EtatFormulaire> {
  const bailleur = await bailleurOnboarde()

  if (!capacites(bailleur).relancesWhatsApp) {
    return {
      erreur:
        'Les relances sont réservées au plan Standard. Vous pouvez toujours joindre votre locataire directement.',
    }
  }

  const supabase = await creerClientServeur()

  const { data: echeance } = await supabase
    .from('v_echeances')
    .select('montant_du, periode_debut, etat')
    .eq('bail_id', bailId)
    .eq('periode_debut', periodeDebut)
    .maybeSingle()

  if (!echeance) return { erreur: 'Cette échéance est introuvable.' }

  // Un mois qui n'est pas impayé ne se relance pas. Entre l'affichage de
  // l'écran et le clic, le bailleur a pu enregistrer le règlement dans un
  // autre onglet — et « À déterminer » n'a jamais été une dette.
  if (echeance.etat !== 'Impayé') {
    return {
      erreur: `Ce loyer n’est plus à relancer : il est « ${echeance.etat} ». Rafraîchissez la page.`,
    }
  }

  const destinataire = await destinataireDuBail(bailId)
  const empechement = refus(destinataire)
  if (empechement) return empechement

  const envoi = await envoyerEmail(destinataire!.email!, 'relance_impaye', {
    nom: destinataire!.nom,
    bailleur_nom: bailleur.nom,
    periode: formaterPeriode(echeance.periode_debut),
    montant: formaterFCFA(echeance.montant_du),
  })

  if (!envoi.ok) {
    return { erreur: `L’envoi a échoué : ${envoi.message ?? 'raison inconnue'}` }
  }

  revalidatePath('/app/impayes')
  return { succes: `Relance envoyée à ${destinataire!.email}.` }
}

// ═══ Au bailleur : son invitation a abouti ═══════════════════════════════════

/**
 * Prévient le bailleur qu'un locataire a rejoint son espace.
 *
 * ─── Pourquoi le client d'administration ────────────────────────────────────
 *
 * Cette fonction s'exécute dans la session du LOCATAIRE, au moment où il
 * accepte. Sous cette session, les politiques de `bailleurs` ne rendent rien —
 * il faudrait sinon ouvrir au locataire la lecture du profil de son bailleur
 * pour lui envoyer un message qui ne le concerne pas.
 *
 * L'identifiant du bailleur ne vient pas du navigateur : il est rendu par
 * `accepter_invitation`, qui l'a lu sur l'invitation consommée.
 *
 * ─── Un échec ici ne doit rien casser ───────────────────────────────────────
 *
 * Le rattachement a réussi ; c'est ce qui compte. Si l'email ne part pas, le
 * locataire ne doit pas voir d'erreur pour un message qui ne lui était pas
 * destiné.
 */
export async function prevenirBailleurDuRattachement(
  bailleurId: string,
  locataireId: string,
): Promise<void> {
  try {
    const admin = creerClientAdmin()

    const [{ data: bailleur }, { data: locataire }] = await Promise.all([
      admin.from('bailleurs').select('nom, email, notif_email').eq('id', bailleurId).maybeSingle(),
      admin.from('locataires').select('nom').eq('id', locataireId).maybeSingle(),
    ])

    if (!bailleur?.email || bailleur.notif_email === false) return

    await envoyerEmail(bailleur.email, 'locataire_a_rejoint', {
      nom: bailleur.nom,
      locataire_nom: locataire?.nom ?? 'Votre locataire',
    })
  } catch {
    // Silence volontaire : voir plus haut.
  }
}
