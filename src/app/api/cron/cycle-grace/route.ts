import { NextResponse, type NextRequest } from 'next/server'

import { requeteCronAutorisee } from '@/lib/cron-auth'
import { creerClientAdmin } from '@/lib/supabase/admin'

/**
 * Fait progresser les comptes en impayé d'abonnement.
 *
 *   J+0 grace · J+3 lecture_seule · J+30 suspendu · J+90 supprime
 *
 * Le calcul vit en SQL (`prive.appliquer_cycle_grace`) : les transitions
 * doivent rester justes même si l'application est indisponible. Cette route
 * n'est qu'un déclencheur.
 *
 * pg_cron exécute déjà la même fonction chaque nuit à 03:00 UTC. Avoir les deux
 * n'est pas une erreur : la fonction n'agit que lorsqu'un palier est franchi,
 * donc la seconde exécution du jour ne fait rien. Cela donne une redondance
 * utile — si pg_cron est désactivé sur l'instance, Vercel Cron prend le relais,
 * et inversement.
 *
 * À enchaîner avec /api/cron/notifications, qui expédie les rappels déposés
 * dans la file par cette exécution.
 */
export async function POST(request: NextRequest) {
  if (!requeteCronAutorisee(request.headers)) {
    return NextResponse.json({ erreur: 'Non autorisé.' }, { status: 401 })
  }

  try {
    const admin = creerClientAdmin()
    const { data, error } = await admin.rpc('executer_cycle_grace')

    if (error) {
      return NextResponse.json({ erreur: error.message }, { status: 500 })
    }

    const transitions = (data ?? []) as unknown as {
      bailleur: string
      ancien: string
      nouveau: string
    }[]

    return NextResponse.json({
      transitions: transitions.length,
      details: transitions.map((t) => `${t.ancien} → ${t.nouveau}`),
    })
  } catch (erreur) {
    return NextResponse.json(
      {
        erreur:
          erreur instanceof Error
            ? erreur.message
            : 'Configuration serveur incomplète.',
      },
      { status: 500 },
    )
  }
}

/** Vercel Cron appelle ses routes en GET. */
export async function GET(request: NextRequest) {
  return POST(request)
}
