'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { aujourdhuiISO } from '@/lib/format'
import { bailleurAvecEcriture, bailleurCourant } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import { DESCRIPTION_FORMAT, reconnaitreFormat } from '@/lib/signature/fichier'
import { erreursChamps, schemaLocataire, type EtatFormulaire } from '@/lib/validation'

const TAILLE_MAX_SIGNATURE = 2 * 1024 * 1024

function lireFormulaire(donnees: FormData) {
  return schemaLocataire.safeParse({
    nom: donnees.get('nom'),
    telephone: donnees.get('telephone'),
    email: donnees.get('email') ?? '',
    consentement: donnees.get('consentement') === 'on' || donnees.get('consentement') === 'true',
    avatar: donnees.get('avatar') ?? '',
  })
}

export async function creerLocataire(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const analyse = lireFormulaire(donnees)
  if (!analyse.success) return { erreursChamps: erreursChamps(analyse.error) }

  const acces = await bailleurAvecEcriture()
  if (!acces.ok) return acces.etat
  const bailleur = acces.bailleur
  const supabase = await creerClientServeur()

  const { error } = await supabase.from('locataires').insert({
    bailleur_id: bailleur.id,
    nom: analyse.data.nom,
    telephone: analyse.data.telephone,
    email: analyse.data.email || null,
    consentement_donnees: true,
    date_consentement: aujourdhuiISO(),
    avatar: analyse.data.avatar || null,
  })

  if (error) return { erreur: `Enregistrement impossible : ${error.message}` }

  revalidatePath('/app/locataires')
  redirect('/app/locataires')
}

export async function modifierLocataire(
  id: string,
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const analyse = lireFormulaire(donnees)
  if (!analyse.success) return { erreursChamps: erreursChamps(analyse.error) }

  const supabase = await creerClientServeur()

  // Pas de filtre sur bailleur_id : les RLS s'en chargent, et un id volé
  // renverrait simplement zéro ligne modifiée.
  const { error } = await supabase
    .from('locataires')
    .update({
      nom: analyse.data.nom,
      telephone: analyse.data.telephone,
      email: analyse.data.email || null,
      avatar: analyse.data.avatar || null,
    })
    .eq('id', id)

  if (error) return { erreur: `Mise à jour impossible : ${error.message}` }

  revalidatePath('/app/locataires')
  redirect('/app/locataires')
}

export async function supprimerLocataire(id: string): Promise<EtatFormulaire> {
  const supabase = await creerClientServeur()
  const { error } = await supabase.from('locataires').delete().eq('id', id)

  if (error) {
    // FK RESTRICT depuis `baux` : un locataire sous bail n'est pas supprimable.
    if (error.code === '23503') {
      return {
        erreur:
          'Ce locataire est rattaché à un bail. Résiliez puis supprimez le bail avant de le retirer.',
      }
    }
    return { erreur: `Suppression impossible : ${error.message}` }
  }

  revalidatePath('/app/locataires')
  return { succes: 'Locataire supprimé.' }
}

// ─── Signature du locataire ─────────────────────────────────────────────────
//
// Recueillie par le bailleur depuis la fiche du locataire, au même titre que
// sa propre signature en Paramètres (§6.1.10) : le locataire n'a pas de
// compte Sikaloc, il ne peut donc pas la téléverser lui-même. Une fois
// enregistrée, elle est réutilisée sur chaque quittance de ce locataire.

export async function televerserSignatureLocataire(
  locataireId: string,
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const fichier = donnees.get('signature')

  if (!(fichier instanceof File) || fichier.size === 0) {
    return { erreur: 'Sélectionnez une image de signature.' }
  }

  if (fichier.size > TAILLE_MAX_SIGNATURE) {
    return { erreur: 'L’image ne doit pas dépasser 2 Mo.' }
  }

  // Le format est jugé sur les octets de tête, jamais sur `fichier.type` : ce
  // champ n'est qu'une chaîne envoyée par le client, au même titre que le nom du
  // fichier. C'est aussi lui qui décidera de l'extension et du `contentType`
  // enregistrés, pour qu'aucune valeur d'origine cliente ne subsiste.
  const format = await reconnaitreFormat(fichier)

  if (!format) {
    return { erreur: 'Formats acceptés : PNG, JPEG ou WebP.' }
  }

  const { type: typeReel, extension } = DESCRIPTION_FORMAT[format]

  const bailleur = await bailleurCourant()
  const supabase = await creerClientServeur()

  // Les RLS vérifient déjà que le locataire appartient au bailleur ; on relit
  // son chemin actuel pour purger un ancien fichier si l'extension change.
  const { data: locataire } = await supabase
    .from('locataires')
    .select('signature_chemin')
    .eq('id', locataireId)
    .maybeSingle()

  if (!locataire) return { erreur: 'Locataire introuvable.' }

  const chemin = `${bailleur.id}/locataires/${locataireId}.${extension}`

  const { error: erreurUpload } = await supabase.storage
    .from('signatures')
    .upload(chemin, fichier, { contentType: typeReel, upsert: true })

  if (erreurUpload) return { erreur: `Téléversement impossible : ${erreurUpload.message}` }

  if (locataire.signature_chemin && locataire.signature_chemin !== chemin) {
    await supabase.storage.from('signatures').remove([locataire.signature_chemin])
  }

  const { error } = await supabase
    .from('locataires')
    .update({ signature_chemin: chemin })
    .eq('id', locataireId)

  if (error) return { erreur: `Enregistrement impossible : ${error.message}` }

  revalidatePath(`/app/locataires/${locataireId}/modifier`)
  return { succes: 'Signature du locataire enregistrée. Elle apparaîtra sur ses prochaines quittances.' }
}

export async function supprimerSignatureLocataire(locataireId: string): Promise<EtatFormulaire> {
  const supabase = await creerClientServeur()

  const { data: locataire } = await supabase
    .from('locataires')
    .select('signature_chemin')
    .eq('id', locataireId)
    .maybeSingle()

  if (!locataire) return { erreur: 'Locataire introuvable.' }

  if (locataire.signature_chemin) {
    await supabase.storage.from('signatures').remove([locataire.signature_chemin])
  }

  const { error } = await supabase
    .from('locataires')
    .update({ signature_chemin: null })
    .eq('id', locataireId)

  if (error) return { erreur: `Suppression impossible : ${error.message}` }

  revalidatePath(`/app/locataires/${locataireId}/modifier`)
  return { succes: 'Signature du locataire supprimée.' }
}
