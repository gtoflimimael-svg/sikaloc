import { NextResponse } from 'next/server'

import { exporterDonnees } from '@/lib/export'
import { creerClientServeur } from '@/lib/supabase/serveur'

/**
 * Téléchargement de l'export complet du bailleur connecté.
 *
 * Le contrôle d'accès se limite à « être connecté », volontairement. Les autres
 * routes vérifient en plus le statut d'abonnement ; celle-ci ne le fait pas,
 * parce que `src/lib/acces.ts` décrit l'export comme le SEUL droit qui survit à
 * la suspension puis à la suppression :
 *
 *   suspendu   export uniquement
 *   supprime   export uniquement, données personnelles purgées
 *
 * Ajouter ici une vérification de statut fermerait la porte au moment précis où
 * elle doit rester ouverte — et rendrait fausse, une deuxième fois, la promesse
 * de la politique de confidentialité.
 *
 * L'identifiant du bailleur vient de la session, jamais de la requête : aucun
 * paramètre ne permet de demander l'export de quelqu'un d'autre.
 */

// L'archive dépend de la session : elle ne peut être ni prérendue ni mise en
// cache par le CDN.
export const dynamic = 'force-dynamic'

// Rassembler des centaines de PDF depuis le stockage dépasse largement le
// délai par défaut d'une lecture de page.
export const maxDuration = 300

export async function GET() {
  const supabase = await creerClientServeur()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ erreur: 'Authentification requise.' }, { status: 401 })
  }

  try {
    const { archive, nomFichier } = await exporterDonnees(user.id)

    return new NextResponse(archive as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${nomFichier}"`,
        'Content-Length': String(archive.byteLength),
        // Des données personnelles : ni cache navigateur, ni cache partagé.
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (erreur) {
    // Le message brut n'est pas renvoyé au client : il peut contenir des
    // détails d'infrastructure. Il part dans les journaux de la fonction.
    console.error('[export] échec pour le bailleur', user.id, erreur)
    return NextResponse.json(
      { erreur: 'La préparation de votre export a échoué. Réessayez dans un instant.' },
      { status: 500 },
    )
  }
}
