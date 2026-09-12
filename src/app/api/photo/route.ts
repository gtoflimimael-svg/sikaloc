import { NextResponse } from 'next/server'

import { creerClientAdmin } from '@/lib/supabase/admin'
import { creerClientServeur } from '@/lib/supabase/serveur'

/**
 * Sert la photo de profil du bailleur connecté.
 *
 * ─── Pourquoi une route plutôt qu'une URL signée ────────────────────────────
 *
 * Le bucket `photos` est privé, comme `quittances`. On aurait pu produire une
 * URL signée à chaque rendu, mais elle porterait une date d'expiration : une
 * page laissée ouverte afficherait un carré vide au bout de quelques minutes,
 * et l'URL — une fois copiée — resterait valable ailleurs jusqu'à son terme.
 *
 * Une route authentifiée n'a ni l'un ni l'autre défaut. C'est le même choix que
 * pour `/api/quittances/[id]/pdf`.
 *
 * ─── Ce qu'elle ne fait pas ─────────────────────────────────────────────────
 *
 * Elle ne prend aucun paramètre. Il n'y a rien à deviner, rien à incrémenter :
 * on ne peut demander que sa propre photo, et l'identité vient du cookie de
 * session, jamais de la requête.
 */

export async function GET() {
  const supabase = await creerClientServeur()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ erreur: 'Non autorisé.' }, { status: 401 })
  }

  // Lecture par le client de session : la RLS fait l'autorisation.
  const { data: bailleur } = await supabase
    .from('bailleurs')
    .select('photo_chemin')
    .eq('id', user.id)
    .maybeSingle()

  if (!bailleur?.photo_chemin) {
    return new NextResponse(null, { status: 404 })
  }

  // Le fichier est servi par le client admin : le coffre est privé et les
  // policies Storage ne s'appliquent pas à un téléchargement serveur.
  const admin = creerClientAdmin()
  const { data, error } = await admin.storage.from('photos').download(bailleur.photo_chemin)

  if (error || !data) {
    return new NextResponse(null, { status: 404 })
  }

  return new NextResponse(await data.arrayBuffer(), {
    headers: {
      'Content-Type': data.type || 'image/jpeg',
      // `private` : un intermédiaire ne doit pas garder le visage d'un bailleur.
      // Quelques minutes suffisent à éviter un rechargement par navigation.
      'Cache-Control': 'private, max-age=300, must-revalidate',
    },
  })
}
