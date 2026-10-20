'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { capacites, messageLimiteLogements } from '@/lib/plan'
import { bailleurAvecEcriture } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import { erreursChamps, schemaLogement, type EtatFormulaire } from '@/lib/validation'

function lireFormulaire(donnees: FormData) {
  return schemaLogement.safeParse({
    adresse: donnees.get('adresse'),
    type: donnees.get('type'),
    ville: donnees.get('ville'),
    pays: donnees.get('pays') || 'Bénin',
  })
}

export async function creerLogement(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const analyse = lireFormulaire(donnees)
  if (!analyse.success) return { erreursChamps: erreursChamps(analyse.error) }

  const acces = await bailleurAvecEcriture()
  if (!acces.ok) return acces.etat
  const bailleur = acces.bailleur
  const supabase = await creerClientServeur()

  // Plafond du plan Gratuit (§4.2) : contrôlé à la création, pas à l'affichage.
  const limite = capacites(bailleur).maxLogements
  if (limite !== null) {
    const { count } = await supabase
      .from('logements')
      .select('id', { count: 'exact', head: true })

    if ((count ?? 0) >= limite) return { erreur: messageLimiteLogements(count ?? 0) }
  }

  const { error } = await supabase.from('logements').insert({
    bailleur_id: bailleur.id,
    adresse: analyse.data.adresse,
    type: analyse.data.type,
    ville: analyse.data.ville,
    pays: analyse.data.pays,
  })

  if (error) return { erreur: `Enregistrement impossible : ${error.message}` }

  revalidatePath('/pro/logements')
  redirect('/pro/logements')
}

export async function modifierLogement(
  id: string,
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const analyse = lireFormulaire(donnees)
  if (!analyse.success) return { erreursChamps: erreursChamps(analyse.error) }

  const acces = await bailleurAvecEcriture()
  if (!acces.ok) return acces.etat
  const supabase = await creerClientServeur()
  const { data: modifie, error } = await supabase
    .from('logements')
    .update({
      adresse: analyse.data.adresse,
      type: analyse.data.type,
      ville: analyse.data.ville,
      pays: analyse.data.pays,
    })
    .eq('id', id)
    .eq('bailleur_id', acces.bailleur.id)
    .select('id')
    .maybeSingle()

  if (error) return { erreur: `Mise à jour impossible : ${error.message}` }
  if (!modifie) return { erreur: 'Modification impossible : logement introuvable ou non autorisé.' }

  revalidatePath('/pro/logements')
  redirect('/pro/logements')
}

export async function supprimerLogement(id: string): Promise<EtatFormulaire> {
  const acces = await bailleurAvecEcriture()
  if (!acces.ok) return acces.etat
  const supabase = await creerClientServeur()
  const { data: supprime, error } = await supabase.from('logements').delete()
    .eq('id', id).eq('bailleur_id', acces.bailleur.id).select('id').maybeSingle()

  if (error) {
    if (error.code === '23503') {
      return {
        erreur:
          'Ce logement porte un bail. Supprimez le bail associé avant de retirer le logement.',
      }
    }
    // Une annonce vivante (brouillon, publiée, suspendue) retient son
    // logement : `annonces_logement_si_vivante`. Une annonce clôturée, elle,
    // lui survit et ne bloque rien.
    if (error.code === '23514' && error.message.includes('annonces_logement_si_vivante')) {
      return {
        erreur:
          'Ce logement a une annonce en cours. Supprimez le brouillon ou clôturez l’annonce avant de retirer le logement.',
      }
    }
    return { erreur: `Suppression impossible : ${error.message}` }
  }

  if (!supprime) return { erreur: 'Suppression impossible : logement introuvable ou non autorisé.' }

  revalidatePath('/pro/logements')
  return { succes: 'Logement supprimé.' }
}
