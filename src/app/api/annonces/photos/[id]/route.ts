import { NextResponse } from 'next/server'

import { BUCKET_PHOTOS_ANNONCES } from '@/lib/annonces/depot-photos'
import { creerClientAdmin } from '@/lib/supabase/admin'
import { creerClientServeur } from '@/lib/supabase/serveur'

/**
 * Sert une photo d'annonce à SON bailleur, dans l'espace Pro.
 *
 * Ce n'est pas la route publique de Sikaloc_Find (S5/S6), qui passera par la
 * référence publique et ne servira que les annonces publiées. Celle-ci sert
 * toutes les photos du bailleur connecté — brouillons compris — et à lui seul.
 *
 * Même choix que `/api/photo` : une route authentifiée plutôt qu'une URL
 * signée, qui expirerait sur une page restée ouverte et resterait valable
 * ailleurs une fois copiée.
 *
 * L'autorisation est faite par la session : la ligne n'est lisible que par son
 * bailleur. Une photo d'un autre renvoie la même 404 qu'une photo inexistante.
 * Le chemin de stockage ne quitte jamais le serveur.
 */
export async function GET(_requete: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return new NextResponse(null, { status: 404 })
  }

  const supabase = await creerClientServeur()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non autorisé.' }, { status: 401 })

  const { data: photo } = await supabase
    .from('annonce_photos')
    .select('chemin, type_mime')
    .eq('id', id)
    .maybeSingle()
  if (!photo) return new NextResponse(null, { status: 404 })

  const { data, error } = await creerClientAdmin()
    .storage.from(BUCKET_PHOTOS_ANNONCES)
    .download(photo.chemin)
  if (error || !data) return new NextResponse(null, { status: 404 })

  return new NextResponse(await data.arrayBuffer(), {
    headers: {
      'Content-Type': photo.type_mime,
      // `private` : la photo d'un brouillon n'a rien à faire dans un cache
      // partagé. Un fichier ne change jamais sous le même identifiant.
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
