'use server'

import { randomBytes } from 'node:crypto'

import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'

import { envoyerConfirmation, envoyerGuide } from '@/lib/emails-guide'
import { DocumentGuide } from '@/lib/pdf/document-guide'
import { creerClientAdmin } from '@/lib/supabase/admin'
import { erreursChamps, schemaEmailSeul, type EtatFormulaire } from '@/lib/validation'

/**
 * Inscription au guide — consentement en deux temps.
 *
 * Aucune policy RLS n'ouvre `inscriptions_guide` : tout passe par le client
 * d'administration, côté serveur. Une liste d'adresses email n'a rien à faire
 * dans l'API publique, fût-ce en lecture.
 */

/** Délai minimal entre deux envois de confirmation à la même adresse. */
const DELAI_RENVOI_MS = 10 * 60 * 1000

/**
 * Message rendu quel que soit le cas de figure.
 *
 * Volontairement identique pour une adresse inconnue, une adresse en attente et
 * une adresse déjà inscrite : répondre « cette adresse est déjà inscrite »
 * transformerait le formulaire en outil pour savoir qui figure sur la liste.
 */
const REPONSE_NEUTRE =
  'Si cette adresse est valide, un message vient d’y être envoyé. Cliquez le lien qu’il contient pour recevoir le guide.'

function nouveauJeton(): string {
  return randomBytes(24).toString('base64url')
}

export async function demanderLeGuide(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  // Piège à robots : un champ que seul un automate remplit. Il est masqué à
  // l'écran et retiré du parcours au clavier.
  if (typeof donnees.get('site') === 'string' && donnees.get('site') !== '') {
    return { succes: REPONSE_NEUTRE }
  }

  const analyse = schemaEmailSeul.safeParse({ email: donnees.get('email') })
  if (!analyse.success) {
    return { erreursChamps: erreursChamps(analyse.error) }
  }

  const { email } = analyse.data
  const admin = creerClientAdmin()

  const { data: existante } = await admin
    .from('inscriptions_guide')
    .select('id, statut, jeton, dernier_envoi_le')
    .eq('email', email)
    .maybeSingle()

  // Une désinscription est un choix, pas un oubli : on ne réinscrit pas
  // quelqu'un qui s'est retiré parce qu'il a resaisi son adresse par mégarde.
  if (existante?.statut === 'desinscrit') {
    return { succes: REPONSE_NEUTRE }
  }

  // Anti-abus : sans ce garde-fou, le formulaire enverrait autant de messages
  // que de soumissions vers une adresse qui n'a rien demandé.
  if (existante?.dernier_envoi_le) {
    const ecoule = Date.now() - new Date(existante.dernier_envoi_le).getTime()
    if (ecoule < DELAI_RENVOI_MS) return { succes: REPONSE_NEUTRE }
  }

  const jeton = nouveauJeton()

  // Le jeton est renouvelé à chaque demande : les liens précédemment envoyés
  // cessent de fonctionner.
  const { error } = existante
    ? await admin
        .from('inscriptions_guide')
        .update({ jeton, dernier_envoi_le: new Date().toISOString() })
        .eq('id', existante.id)
    : await admin
        .from('inscriptions_guide')
        .insert({ email, jeton, dernier_envoi_le: new Date().toISOString() })

  if (error) {
    console.error('[guide] enregistrement impossible :', error.message)
    return { erreur: 'Une erreur est survenue. Réessayez dans un instant.' }
  }

  // Une adresse déjà confirmée reçoit directement le guide : lui redemander de
  // confirmer un consentement qu'elle a déjà donné n'aurait aucun sens.
  const envoi =
    existante?.statut === 'confirme'
      ? await envoyerGuide(email, jeton, await renderToBuffer(createElement(DocumentGuide)))
      : await envoyerConfirmation(email, jeton)

  if (!envoi.ok) {
    console.error('[guide] envoi impossible :', envoi.message)
    return { erreur: 'L’envoi a échoué. Réessayez dans un instant.' }
  }

  return { succes: REPONSE_NEUTRE }
}

/** Issue de la confirmation, pour la page qui la rend. */
export type IssueConfirmation = 'confirme' | 'deja_confirme' | 'jeton_invalide' | 'envoi_echoue'

/**
 * Confirme une adresse et envoie le guide.
 *
 * Rend le résultat plutôt que de lever : la page doit savoir quoi afficher, y
 * compris quand le lien est périmé.
 */
export async function confirmerEtEnvoyer(jeton: string): Promise<IssueConfirmation> {
  if (!jeton || jeton.length < 20) return 'jeton_invalide'

  const admin = creerClientAdmin()

  const { data: ligne } = await admin
    .from('inscriptions_guide')
    .select('id, email, statut')
    .eq('jeton', jeton)
    .maybeSingle()

  if (!ligne || ligne.statut === 'desinscrit') return 'jeton_invalide'

  const pdf = await renderToBuffer(createElement(DocumentGuide))
  const envoi = await envoyerGuide(ligne.email, jeton, pdf)

  if (!envoi.ok) {
    console.error('[guide] envoi du guide impossible :', envoi.message)
    return 'envoi_echoue'
  }

  if (ligne.statut === 'confirme') return 'deja_confirme'

  const { error } = await admin
    .from('inscriptions_guide')
    .update({ statut: 'confirme', confirme_le: new Date().toISOString() })
    .eq('id', ligne.id)

  if (error) console.error('[guide] confirmation non enregistrée :', error.message)

  return 'confirme'
}

/**
 * Désinscription.
 *
 * La ligne est conservée, marquée `desinscrit` : l'effacer permettrait de
 * réinscrire l'adresse par erreur, et ne laisserait aucune trace de la date du
 * retrait.
 */
export async function desinscrire(jeton: string): Promise<boolean> {
  if (!jeton || jeton.length < 20) return false

  const admin = creerClientAdmin()

  const { data } = await admin
    .from('inscriptions_guide')
    .update({ statut: 'desinscrit', desinscrit_le: new Date().toISOString() })
    .eq('jeton', jeton)
    .select('id')
    .maybeSingle()

  return Boolean(data)
}
