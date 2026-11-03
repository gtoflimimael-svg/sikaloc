import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import {
  maintenanceDecision,
  maintenanceResponseSpec,
} from '@/lib/maintenance-policy.mjs'
import { cheminProtege, cheminPublic } from '@/lib/roles'
import type { Database } from '@/lib/types/database'

/*
 * Les règles de chemin — ce qui est gardé, ce qui est public — vivent dans
 * `roles.ts`, avec un banc qui les exerce. Écrites ici, elles n'étaient
 * testables que par un navigateur : c'est exactement la raison pour laquelle
 * l'oubli de `/me/invitation` a survécu à deux étapes.
 */

/**
 * Écrans d'authentification : une session ouverte n'y a rien à faire.
 *
 * `/entrer` n'en fait PAS partie, et c'est essentiel : c'est la page de choix,
 * elle s'adresse justement à quelqu'un de connecté qui porte les deux rôles.
 * L'y refuser produirait une boucle entre elle et l'espace vers lequel on le
 * renverrait.
 */
const PAGES_AUTH = ['/connexion', '/inscription']

/**
 * Mode maintenance global. Il est activé par défaut et ne peut être levé que
 * par une valeur explicite définie dans l'environnement Vercel.
 */
const MAINTENANCE_MODE = process.env.SIKALOC_MAINTENANCE_MODE

const PAGE_MAINTENANCE = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow, noarchive">
    <meta name="theme-color" content="#EAF1E7">
    <title>Sikaloc — Maintenance</title>
    <style>
      :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111810; background: #F6F8F5; }
      * { box-sizing: border-box; }
      body { min-height: 100vh; min-height: 100svh; margin: 0; display: grid; place-items: center; padding: 24px; }
      main { width: min(100%, 620px); padding: clamp(28px, 7vw, 56px) 0; border-top: 3px solid #17311C; text-align: left; }
      .brand { margin: 0 0 42px; color: #17311C; font-size: 24px; font-weight: 800; letter-spacing: -.06em; }
      .mark { width: 64px; height: 64px; margin: 0 0 24px; display: grid; place-items: center; border-radius: 50%; background: #EAF1E7; color: #17311C; }
      h1 { max-width: 20ch; margin: 0 0 24px; color: #111810; font-size: clamp(32px, 7vw, 46px); font-weight: 750; line-height: 1.13; letter-spacing: -.035em; }
      p { max-width: 52ch; margin: 12px 0 0; color: #424940; font-size: 16px; line-height: 1.75; }
      .rule { width: 46px; height: 3px; margin: 30px 0 0; border-radius: 99px; background: #B8F36D; }
      @media (max-width: 420px) { body { padding: 16px; } .brand { margin-bottom: 34px; } p { font-size: 15px; } }
    </style>
  </head>
  <body>
    <main>
      <p class="brand" aria-label="Sikaloc">Sikaloc<span aria-hidden="true">_</span></p>
      <div class="mark" aria-hidden="true">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 10.5 12 4l8 6.5V20h-6v-5h-4v5H4v-9.5Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M8 10h.01M12 10h.01M16 10h.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
        </svg>
      </div>
      <h1>Sikaloc est actuellement en maintenance.</h1>
      <p>Nous travaillons à l'amélioration de notre plateforme afin de vous offrir une meilleure expérience.</p>
      <p>Merci de votre compréhension. Nous serons bientôt de retour.</p>
      <div class="rule" aria-hidden="true"></div>
    </main>
  </body>
</html>`

function reponseMaintenance(request: NextRequest) {
  const spec = maintenanceResponseSpec(request.method, PAGE_MAINTENANCE)
  return new NextResponse(spec.body, {
    status: spec.status,
    headers: new Headers(spec.headers),
  })
}

/**
 * Rafraîchit la session à chaque requête et garde les routes privées.
 *
 * Ce fichier s'appelle `proxy.ts` : c'est le nom retenu par Next.js 16 pour ce
 * qui s'appelait `middleware.ts`.
 */
export default async function proxy(request: NextRequest) {
  const chemin = request.nextUrl.pathname

  const decisionMaintenance = maintenanceDecision(
    chemin,
    request.method,
    MAINTENANCE_MODE,
  )

  // Les endpoints techniques gardent leurs propres contrôles de signature ou
  // de secret. Toute autre navigation, API ou Server Action reçoit un 503.
  if (decisionMaintenance !== 'normal') {
    if (decisionMaintenance === 'technical') return NextResponse.next({ request })
    return reponseMaintenance(request)
  }

  let reponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesAEcrire, enTetes) {
          for (const { name, value } of cookiesAEcrire) {
            request.cookies.set(name, value)
          }
          reponse = NextResponse.next({ request })
          for (const [nom, valeur] of Object.entries(enTetes)) reponse.headers.set(nom, valeur)
          for (const { name, value, options } of cookiesAEcrire) {
            reponse.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  // Ne jamais insérer de logique entre createServerClient et getUser : c'est
  // cet appel qui renouvelle le token et réécrit les cookies de session.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Conserver les mutations Auth et ses en-têtes anti-cache sur chaque sortie.
  function rediriger(url: URL) {
    const sortie = NextResponse.redirect(url)
    for (const cookie of reponse.cookies.getAll()) sortie.cookies.set(cookie)
    for (const nom of ['Cache-Control', 'Expires', 'Pragma']) {
      const valeur = reponse.headers.get(nom)
      if (valeur !== null) sortie.headers.set(nom, valeur)
    }
    return sortie
  }

  const publique = cheminPublic(chemin)

  if (!user && !publique && cheminProtege(chemin)) {
    const url = request.nextUrl.clone()
    url.pathname = '/connexion'
    url.searchParams.set('suite', chemin)
    return rediriger(url)
  }

  if (user && PAGES_AUTH.includes(chemin)) {
    // Vers la page de choix, et non plus vers `/pro` : un locataire connecté
    // renvoyé vers l'espace du bailleur rebondirait aussitôt. `/entrer`
    // aiguille chacun vers le sien, ou pose la question à qui porte les deux.
    const url = request.nextUrl.clone()
    url.pathname = '/entrer'
    url.search = ''
    return rediriger(url)
  }

  return reponse
}

export const config = {
  matcher: [
    /*
     * Tout sauf les fichiers statiques et les images — inutile de réveiller
     * l'auth pour servir une icône.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
