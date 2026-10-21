import { NextResponse } from 'next/server'

import { BUCKET_PHOTOS_ANNONCES } from '@/lib/annonces/depot-photos'
import { creerClientAdmin } from '@/lib/supabase/admin'

/**
 * Une photo d'annonce publiée, servie au public.
 *
 * ─── Le chemin ne sort jamais ──────────────────────────────────────────────
 *
 * Le visiteur désigne la photo par ce qui est déjà public : la référence de
 * l'annonce et une position (0 à 7). La fonction `photo_publiee`, exécutable
 * par la seule clé de service, traduit ce couple en chemin interne — et
 * seulement si l'annonce est publiée. Le fichier est lu dans le coffre privé,
 * renvoyé tel quel : il a été nettoyé et ré-encodé à l'envoi (S3).
 *
 * ─── Une seule réponse pour tous les « non » ───────────────────────────────
 *
 * Référence mal formée, inconnue, annonce en brouillon, suspendue ou
 * clôturée, position vide ou hors bornes : la même 404, sans corps. Rien ne
 * permet de distinguer une annonce qui existe d'une annonce qui n'existe pas.
 *
 * ─── Le cache ──────────────────────────────────────────────────────────────
 *
 * Un FICHIER ne change jamais sous son chemin, mais l'URL désigne une
 * POSITION : la photo en position 0 change quand la principale est retirée,
 * et elle doit disparaître quand l'annonce est suspendue. D'où un cache
 * court, au navigateur seulement (`max-age=60`, pas de `s-maxage`) : une
 * minute de retard au plus, jamais une photo retirée servie par un CDN
 * pendant des heures.
 */

const REFERENCE = /^[0-9a-hjkmnp-tv-z]{10}$/
const POSITION = /^[0-7]$/

const introuvable = () =>
  new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'no-store' } })

export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ reference: string; position: string }> },
) {
  const { reference, position } = await params
  if (!REFERENCE.test(reference) || !POSITION.test(position)) return introuvable()

  const admin = creerClientAdmin()
  const { data, error } = await admin.rpc('photo_publiee', {
    p_reference: reference,
    p_position: Number(position),
  })
  if (error) {
    console.error('[find] photo_publiee', error.code, error.message)
    return introuvable()
  }
  const photo = data?.[0]
  if (!photo) return introuvable()

  const { data: fichier, error: erreurFichier } = await admin.storage
    .from(BUCKET_PHOTOS_ANNONCES)
    .download(photo.chemin)
  if (erreurFichier || !fichier) {
    console.error('[find] photo introuvable dans le coffre pour', reference, position)
    return introuvable()
  }

  return new NextResponse(await fichier.arrayBuffer(), {
    headers: {
      'Content-Type': photo.type_mime,
      'Cache-Control': 'public, max-age=60, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
