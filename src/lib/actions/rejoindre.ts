'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { accepterInvitation } from '@/lib/actions/invitations'
import { MESSAGES_INVITATION } from '@/lib/invitations'
import { creerClientServeur } from '@/lib/supabase/serveur'
import {
  erreursChamps,
  refusMotDePasseContextuel,
  schemaInscription,
  type EtatFormulaire,
} from '@/lib/validation'
import {
  lireTemoinInvitation,
  poserTemoinInvitation,
  poserTemoinVerification,
  retirerTemoinInvitation,
} from '@/lib/verification/temoin'

/**
 * Rejoindre Sikaloc_Me depuis une invitation.
 *
 * ─── Deux chemins, une seule destination ────────────────────────────────────
 *
 *   `rattacherCompteConnecte`  on a déjà un compte : il ne reste qu'à le relier
 *   `rejoindreAvecInvitation`  on n'en a pas : on le crée, puis on relie
 *
 * ─── L'ordre compte ─────────────────────────────────────────────────────────
 *
 * Créer le compte AVANT de consommer l'invitation. L'inverse — consommer puis
 * créer — laisserait le locataire dehors si la création échouait : son
 * invitation aurait été brûlée par une tentative qui n'a rien produit, et il
 * faudrait que le bailleur en renvoie une.
 *
 * ─── L'adresse ne se choisit pas ────────────────────────────────────────────
 *
 * Le compte se crée sur l'adresse de l'invitation, relue en base à partir du
 * jeton — jamais sur celle que le formulaire envoie. Sans cela, un lien reçu
 * par erreur pourrait être détourné vers un compte qu'on contrôle, et donner
 * accès aux quittances de quelqu'un d'autre.
 */

// ═══ On a déjà un compte ═════════════════════════════════════════════════════

export async function rattacherCompteConnecte(
  jeton: string,
  _etat: EtatFormulaire,
  _donnees: FormData,
): Promise<EtatFormulaire> {
  const supabase = await creerClientServeur()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { erreur: MESSAGES_INVITATION.authentification_requise }

  const resultat = await accepterInvitation(jeton)
  if (!resultat.ok) return { erreur: resultat.message }

  revalidatePath('/', 'layout')
  redirect('/me')
}

// ═══ On crée le compte ═══════════════════════════════════════════════════════

export async function rejoindreAvecInvitation(
  jeton: string,
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  // L'adresse vient de l'invitation, pas du formulaire. Le champ affiché est
  // en lecture seule, mais un formulaire se rejoue : on ne s'y fie pas.
  const supabase = await creerClientServeur()

  const analyse = schemaInscription.safeParse({
    nom: donnees.get('nom'),
    email: donnees.get('email'),
    telephone: donnees.get('telephone'),
    motDePasse: donnees.get('motDePasse'),
    codeParrain: '',
    avatar: '',
  })

  if (!analyse.success) return { erreursChamps: erreursChamps(analyse.error) }

  const { nom, email, telephone, motDePasse } = analyse.data

  const refus = refusMotDePasseContextuel(motDePasse, [nom, email, telephone])
  if (refus) return { erreursChamps: { motDePasse: refus } }

  // ── Le compte, avec son rôle ─────────────────────────────────────────────
  //
  // `role: 'locataire'` empêche `prive.gerer_nouvel_utilisateur` de créer un
  // profil bailleur. Sans cette mention, ce locataire recevrait un code de
  // parrainage et l'accès à l'espace de gestion.
  const { error } = await supabase.auth.signUp({
    email,
    password: motDePasse,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/verification`,
      data: { nom, telephone, role: 'locataire' },
    },
  })

  if (error) {
    if (error.message.toLowerCase().includes('already registered')) {
      return {
        erreur:
          'Un compte existe déjà avec cette adresse. Connectez-vous, puis rouvrez le lien de votre invitation.',
      }
    }
    return { erreur: `La création du compte a échoué : ${error.message}` }
  }

  // La confirmation d'email est active : aucune session n'est ouverte ici. Le
  // rattachement ne peut donc pas se faire maintenant — il attend que le code
  // soit saisi, et le témoin porte l'adresse jusque-là.
  await poserTemoinVerification(email)

  revalidatePath('/', 'layout')

  // Le jeton voyage par témoin, jamais par l'URL : il ouvre l'accès aux
  // documents de loyer d'une personne, et une URL se retrouve dans
  // l'historique, les journaux et l'en-tête `Referer`.
  await poserTemoinInvitation(jeton)

  redirect('/verification')
}

/**
 * Le rattachement différé, une fois la session ouverte.
 *
 * Appelé par l'écran de vérification : c'est le premier moment où le compte
 * existe vraiment. Rend `true` si le rattachement a eu lieu.
 *
 * Le témoin est retiré dans tous les cas — réussite comme échec. Un jeton qui
 * traînerait relancerait la tentative à chaque passage sur l'écran.
 */
export async function finaliserInvitationEnAttente(): Promise<boolean> {
  const jeton = await lireTemoinInvitation()
  if (!jeton) return false

  const resultat = await accepterInvitation(jeton)
  await retirerTemoinInvitation()

  return resultat.ok
}
