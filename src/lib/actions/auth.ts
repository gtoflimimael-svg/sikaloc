'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { enregistrerTentative, verifierBlocage } from '@/lib/rate-limit'
import { creerClientServeur } from '@/lib/supabase/serveur'
import {
  erreursChamps,
  schemaConnexion,
  schemaEmailSeul,
  schemaInscription,
  schemaNouveauMotDePasse,
  type EtatFormulaire,
} from '@/lib/validation'

async function urlDeBase(): Promise<string> {
  const enTetes = await headers()
  const hote = enTetes.get('host') ?? 'localhost:3000'
  const protocole = hote.startsWith('localhost') || hote.startsWith('127.') ? 'http' : 'https'

  return process.env.NEXT_PUBLIC_SITE_URL ?? `${protocole}://${hote}`
}

async function adresseIp(): Promise<string | null> {
  const enTetes = await headers()
  return enTetes.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
}

// ─── Inscription ────────────────────────────────────────────────────────────

export async function inscrire(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const analyse = schemaInscription.safeParse({
    nom: donnees.get('nom'),
    email: donnees.get('email'),
    telephone: donnees.get('telephone'),
    motDePasse: donnees.get('motDePasse'),
    codeParrain: donnees.get('codeParrain') ?? '',
    nbLogements: donnees.get('nbLogements') || undefined,
    avatar: donnees.get('avatar') ?? '',
  })

  if (!analyse.success) {
    return { erreursChamps: erreursChamps(analyse.error) }
  }

  const { nom, email, telephone, motDePasse, codeParrain, nbLogements, avatar } =
    analyse.data
  const supabase = await creerClientServeur()

  const { data, error } = await supabase.auth.signUp({
    email,
    password: motDePasse,
    options: {
      emailRedirectTo: `${await urlDeBase()}/auth/callback`,
      // Données de profil uniquement : le trigger `creer_profil_bailleur` les
      // recopie dans public.bailleurs. Aucune n'entre dans une décision
      // d'autorisation — `plan` reste 'Gratuit' par défaut côté base.
      data: {
        nom,
        telephone,
        code_parrain: codeParrain ? codeParrain.toUpperCase() : null,
        nb_logements: nbLogements ?? null,
        // Recopié dans public.bailleurs par `prive.gerer_nouvel_utilisateur`.
        avatar: avatar || null,
      },
    },
  })

  if (error) {
    if (error.message.toLowerCase().includes('already registered')) {
      return { erreur: 'Un compte existe déjà avec cette adresse email.' }
    }
    return { erreur: `La création du compte a échoué : ${error.message}` }
  }

  // Confirmation d'email activée : aucune session n'est ouverte à ce stade.
  if (!data.session) {
    return {
      succes:
        'Compte créé. Vérifiez votre boîte mail et cliquez sur le lien de confirmation pour continuer.',
    }
  }

  revalidatePath('/', 'layout')
  redirect('/app/onboarding')
}

// ─── Connexion ──────────────────────────────────────────────────────────────

export async function connecter(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const analyse = schemaConnexion.safeParse({
    email: donnees.get('email'),
    motDePasse: donnees.get('motDePasse'),
  })

  if (!analyse.success) {
    return { erreursChamps: erreursChamps(analyse.error) }
  }

  const { email, motDePasse } = analyse.data
  const suite = (donnees.get('suite') as string) || '/app'

  const blocage = await verifierBlocage(email)
  if (blocage.bloque) {
    return {
      erreur:
        `Trop de tentatives de connexion. Réessayez dans ${blocage.minutesRestantes} minute` +
        `${blocage.minutesRestantes > 1 ? 's' : ''}.`,
    }
  }

  const supabase = await creerClientServeur()
  const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse })

  if (error) {
    await enregistrerTentative(email, false, await adresseIp())
    return { erreur: 'Email ou mot de passe incorrect.' }
  }

  await enregistrerTentative(email, true, await adresseIp())

  revalidatePath('/', 'layout')
  // Une destination fournie par l'URL ne doit jamais pouvoir pointer ailleurs
  // que sur ce site : on n'accepte qu'un chemin relatif.
  redirect(suite.startsWith('/') && !suite.startsWith('//') ? suite : '/app')
}

// ─── Déconnexion ────────────────────────────────────────────────────────────

export async function deconnecter() {
  const supabase = await creerClientServeur()
  await supabase.auth.signOut()

  revalidatePath('/', 'layout')
  redirect('/connexion')
}

// ─── Réinitialisation du mot de passe ───────────────────────────────────────

export async function demanderReinitialisation(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const analyse = schemaEmailSeul.safeParse({ email: donnees.get('email') })

  if (!analyse.success) {
    return { erreursChamps: erreursChamps(analyse.error) }
  }

  const supabase = await creerClientServeur()
  await supabase.auth.resetPasswordForEmail(analyse.data.email, {
    redirectTo: `${await urlDeBase()}/auth/callback?next=/reinitialiser-mot-de-passe`,
  })

  // Réponse identique que le compte existe ou non : révéler la différence
  // permettrait d'énumérer les adresses inscrites.
  return {
    succes:
      'Si un compte existe pour cette adresse, un lien de réinitialisation vient de vous être envoyé.',
  }
}

export async function definirNouveauMotDePasse(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const analyse = schemaNouveauMotDePasse.safeParse({
    motDePasse: donnees.get('motDePasse'),
    confirmation: donnees.get('confirmation'),
  })

  if (!analyse.success) {
    return { erreursChamps: erreursChamps(analyse.error) }
  }

  const supabase = await creerClientServeur()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      erreur:
        'Ce lien de réinitialisation a expiré. Demandez-en un nouveau depuis la page de connexion.',
    }
  }

  const { error } = await supabase.auth.updateUser({ password: analyse.data.motDePasse })

  if (error) {
    return { erreur: `La mise à jour a échoué : ${error.message}` }
  }

  revalidatePath('/', 'layout')
  redirect('/app')
}
