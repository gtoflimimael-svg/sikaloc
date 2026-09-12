'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { enregistrerTentative, verifierBlocage } from '@/lib/rate-limit'
import { creerClientServeur } from '@/lib/supabase/serveur'
import {
  erreursChamps,
  refusMotDePasseContextuel,
  schemaConnexion,
  schemaEmailSeul,
  schemaInscription,
  schemaNouveauMotDePasse,
  type EtatFormulaire,
} from '@/lib/validation'
import { poserTemoinVerification } from '@/lib/verification/temoin'

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
      // Le gabarit d'email n'envoie plus de lien de confirmation mais un code
      // à six chiffres (voir `supabase/templates/confirmation.html`). Cette
      // adresse de retour n'est conservée que pour le bouton « Saisir mon
      // code » du message, qui ouvre l'écran de saisie sans rien valider.
      emailRedirectTo: `${await urlDeBase()}/verification`,
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

  // ── Vers la vérification, pas vers l'application ────────────────────────
  //
  // Un compte fraîchement créé n'est vérifié sur rien : ni l'adresse email, ni
  // le numéro. Il n'a donc pas à atteindre `/app/onboarding`, et `session.ts`
  // l'en empêcherait de toute façon.
  //
  // Le témoin porte l'adresse jusqu'à l'écran de saisie : GoTrue n'ouvre pas
  // de session avant la validation du code, il n'y a donc rien d'autre pour
  // savoir à qui le code a été envoyé.
  await poserTemoinVerification(email)

  revalidatePath('/', 'layout')

  // `data.session` est renseignée si la confirmation d'email est désactivée sur
  // le projet. Le parcours reste le même : la vérification du téléphone n'est
  // pas faite, et c'est `/verification` qui la conduit.
  void data
  redirect('/verification')
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
    // Email non confirmé : GoTrue refuse la connexion, et ce n'est pas un
    // mauvais mot de passe. Dire « identifiants incorrects » enverrait le
    // bailleur vérifier un mot de passe qui est bon, sans lui donner le moindre
    // moyen de s'en sortir. On l'emmène là où il peut finir sa vérification.
    //
    // Ce n'est pas une fuite d'information : le compte a déjà été annoncé comme
    // existant au moment de l'inscription, à celui-là même qui vient de fournir
    // le bon mot de passe.
    if (/email not confirmed|not confirmed/i.test(error.message)) {
      await poserTemoinVerification(email)
      redirect('/verification')
    }

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

  // Le formulaire de réinitialisation ne porte que deux champs : c'est ici, une
  // fois la session du lien ouverte, qu'on sait à qui appartient le compte.
  const refus = refusMotDePasseContextuel(analyse.data.motDePasse, [
    user.email,
    typeof user.user_metadata?.nom === 'string' ? user.user_metadata.nom : null,
  ])
  if (refus) return { erreursChamps: { motDePasse: refus } }

  const { error } = await supabase.auth.updateUser({ password: analyse.data.motDePasse })

  if (error) {
    return { erreur: `La mise à jour a échoué : ${error.message}` }
  }

  revalidatePath('/', 'layout')
  redirect('/app')
}
