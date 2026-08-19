import { NextResponse, type NextRequest } from 'next/server'

import { requeteCronAutorisee } from '@/lib/cron-auth'
import { creerClientAdmin } from '@/lib/supabase/admin'

/**
 * Volet « fichiers » de la purge J+90.
 *
 * Supabase interdit la suppression directe dans `storage.objects` : seule
 * l'API Storage peut effacer un objet. La fonction SQL
 * `prive.purger_donnees_personnelles()` a donc anonymisé les locataires et
 * relevé les chemins à effacer dans `journal_purges.fichiers_a_supprimer` ;
 * cette route les supprime réellement.
 *
 * Le découpage rend l'opération rejouable : si l'effacement échoue, il sera
 * repris au prochain passage sans jamais re-purger les données déjà traitées.
 */
export async function POST(request: NextRequest) {
  if (!requeteCronAutorisee(request.headers)) {
    return NextResponse.json({ erreur: 'Non autorisé.' }, { status: 401 })
  }

  const admin = creerClientAdmin()

  // Volet base : anonymisation des locataires et relevé des fichiers. La
  // fonction ne traite que les comptes dépassant 90 jours d'impayé et n'ayant
  // pas déjà été purgés — elle est donc sûre à rejouer.
  const { error: erreurPurge } = await admin.rpc('executer_purge_j90')

  if (erreurPurge) {
    return NextResponse.json({ erreur: erreurPurge.message }, { status: 500 })
  }

  const { data: aTraiter, error } = await admin
    .from('journal_purges')
    .select('id, fichiers_a_supprimer')
    .is('fichiers_supprimes_le', null)
    .limit(20)

  if (error) {
    return NextResponse.json({ erreur: error.message }, { status: 500 })
  }

  let supprimes = 0
  const problemes: string[] = []

  for (const purge of aTraiter ?? []) {
    const fichiers = (purge.fichiers_a_supprimer ?? []) as string[]

    // Les chemins sont stockés « bucket/chemin » : on regroupe par bucket pour
    // n'émettre qu'un appel de suppression par coffre.
    const parBucket = new Map<string, string[]>()
    for (const entree of fichiers) {
      const separateur = entree.indexOf('/')
      if (separateur < 0) continue

      const bucket = entree.slice(0, separateur)
      const chemin = entree.slice(separateur + 1)
      parBucket.set(bucket, [...(parBucket.get(bucket) ?? []), chemin])
    }

    let toutOk = true

    for (const [bucket, chemins] of parBucket) {
      const { error: erreurSuppression } = await admin.storage.from(bucket).remove(chemins)

      if (erreurSuppression) {
        toutOk = false
        problemes.push(`${bucket} : ${erreurSuppression.message}`)
      } else {
        supprimes += chemins.length
      }
    }

    // Le journal n'est marqué que si tous les fichiers sont partis : sinon la
    // ligne repasse au prochain tour.
    if (toutOk) {
      await admin
        .from('journal_purges')
        .update({ fichiers_supprimes_le: new Date().toISOString() })
        .eq('id', purge.id)
    }
  }

  return NextResponse.json({
    purges_traitees: (aTraiter ?? []).length,
    fichiers_supprimes: supprimes,
    ...(problemes.length ? { problemes } : {}),
  })
}

export async function GET(request: NextRequest) {
  return POST(request)
}
