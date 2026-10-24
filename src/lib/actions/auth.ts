'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { enregistrerTentative, verifierBlocage } from '@/lib/rate-limit'
import { normaliserSuiteConnexion } from '@/lib/auth-contexte'
import { LONGUEUR_MAXIMALE, LONGUEUR_MINIMALE } from '@/lib/mot-de-passe'
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

function reponseErreurInscription(error: {
  status?: number
  code?: string
  message: string
}): EtatFormulaire {
  const status = error.status ?? 0
  const code = error.code ?? ''
  const messageTechnique = error.message.toLowerCase()
  const codeJournal = /^[a-z0-9_-]{1,64}$/i.test(code) ? code : 'other'

  // Ne journalise ni le message brut, ni l'adresse, ni le mot de passe. Les
  // journaux restent utiles pour distinguer un refus Auth d'une panne.
  console.error('[auth.signup] Supabase Auth rejected signup', {
    status,
    code: codeJournal,
  })

  if (
    status === 422 &&
    /password should contain|password.*(letter|digit|character|length)|mot de passe/.test(
      messageTechnique,
    )
  ) {
    return {
      erreursChamps: {
        motDePasse:
          `Le mot de passe doit contenir entre ${LONGUEUR_MINIMALE} et ${LONGUEUR_MAXIMALE} caractères, avec au moins une lettre latine et un chiffre.`,
      },
    }
  }

  if (status === 422 && /password|mot de passe/.test(messageTechnique)) {
    return {
      erreursChamps: {
        motDePasse:
          'Le service a refusé ce mot de passe. Choisissez-en un inédit, conforme aux critères affichés et difficile à deviner.',
      },
    }
  }

  if (
    ['email_exists', 'user_already_exists', 'user_exists'].includes(code) ||
    /already registered|already exists/.test(messageTechnique)
  ) {
    return {
      erreur:
        'Nous ne pouvons pas finaliser cette inscription avec ces informations. Si vous avez déjà un compte, connectez-vous ou utilisez la récupération du mot de passe depuis la page de connexion.',
    }
  }

  if (status === 429 || code === 'over_email_send_rate_limit') {
    return {
      erreur:
        'Trop de demandes ont été effectuées en peu de temps. Patientez quelques minutes avant de réessayer.',
    }
  }

  if (status >= 500) {
    return {
      erreur:
        'Le service n’a pas pu confirmer l’issue de l’inscription. Vérifiez votre boîte e-mail avant de réessayer ; le compte a peut-être déjà été créé.',
    }
  }

  return {
    erreur:
      'L’inscription n’a pas pu aboutir. Vérifiez les champs signalés ou réessayez ; si vous avez déjà un compte, connectez-vous.',
  }
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
  })

  if (!analyse.success) {
    return { erreursChamps: erreursChamps(analyse.error) }
  }

  const { nom, email, telephone, motDePasse, codeParrain } = analyse.data
  let erreurAuth: { status?: number; code?: string; message: string } | null = null
  let requeteAuthLancee = false

  try {
    const supabase = await creerClientServeur()
    const emailRedirectTo = `${await urlDeBase()}/verification`
    requeteAuthLancee = true
    const resultat = await supabase.auth.signUp({
      email,
      password: motDePasse,
      options: {
        // Le gabarit d'email envoie un code à six chiffres. L'inscription
        // continue vers l'écran existant de vérification, sans ouvrir l'accès.
        emailRedirectTo,
        // Le trigger crée le profil avec le plan Gratuit par défaut ; ces
        // métadonnées ne déterminent aucune autorisation.
        data: {
          nom,
          telephone,
          code_parrain: codeParrain ? codeParrain.toUpperCase() : null,
        },
      },
    })
    erreurAuth = resultat.error
  } catch (cause) {
    console.error('[auth.signup] Signup request could not be confirmed', {
      name: cause instanceof Error ? cause.name : 'UnknownError',
      phase: requeteAuthLancee ? 'auth_request' : 'setup',
    })
    return {
      erreur: requeteAuthLancee
        ? 'La réponse du service d’inscription n’a pas pu être confirmée. Vérifiez votre boîte e-mail avant de réessayer ; le compte a peut-être déjà été créé.'
        : 'Le service d’inscription n’a pas pu démarrer. Vos informations n’ont pas été envoyées ; réessayez dans un instant.',
    }
  }

  if (erreurAuth) return reponseErreurInscription(erreurAuth)

  // ── Vers la vérification, pas vers l'application ────────────────────────
  //
  // Un compte fraîchement créé n'est pas encore confirmé par email. L'email
  // reste obligatoire pour ouvrir l'espace bailleur ; le téléphone n'est pas
  // une preuve par sa seule saisie et ne bloque pas l'activation tant qu'aucun
  // fournisseur réel n'est opérationnel.
  //
  // Le témoin porte l'adresse jusqu'à l'écran de saisie : GoTrue n'ouvre pas
  // de session avant la validation du code, il n'y a donc rien d'autre pour
  // savoir à qui le code a été envoyé.
  await poserTemoinVerification(email)

  revalidatePath('/', 'layout')

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

  const blocage = await verifierBlocage(email)
  if (blocage.bloque) {
    return {
      erreur:
        `Trop de tentatives de connexion. Réessayez dans ${blocage.minutesRestantes} minute` +
        `${blocage.minutesRestantes > 1 ? 's' : ''}.`,
    }
  }

  let error: { message: string } | null = null
  try {
    const supabase = await creerClientServeur()
    const resultat = await supabase.auth.signInWithPassword({ email, password: motDePasse })
    error = resultat.error
  } catch (cause) {
    // Une panne de transport ou de configuration ne doit pas devenir une
    // réponse HTML 500 illisible par le protocole des Server Actions.
    console.error('[auth.login] Supabase Auth request failed', {
      name: cause instanceof Error ? cause.name : 'UnknownError',
      phase: cause instanceof Error ? 'auth_request' : 'setup',
    })
    return {
      erreur:
        'Le service de connexion est momentanément indisponible. Vérifiez votre connexion puis réessayez.',
    }
  }

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
  // Le retour conserve une destination interne connue. Si le champ caché a
  // été modifié, l'orientation normale dépend des rôles calculés côté serveur.
  // Les gardes des routes restent responsables des autorisations.
  const suite = normaliserSuiteConnexion(donnees.get('suite'))
  redirect(suite ?? '/entrer')
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
  const suite = normaliserSuiteConnexion(donnees.get('suite')) ?? '/entrer'
  const callback = new URL('/auth/callback', await urlDeBase())
  callback.searchParams.set('next', '/reinitialiser-mot-de-passe')
  callback.searchParams.set('suite', suite)
  await supabase.auth.resetPasswordForEmail(analyse.data.email, {
    redirectTo: callback.toString(),
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
  const suite = normaliserSuiteConnexion(donnees.get('suite'))
  redirect(suite ?? '/entrer')
}
