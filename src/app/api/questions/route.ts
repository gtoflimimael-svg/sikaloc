import { createHmac } from 'node:crypto'
import { isIP } from 'node:net'
import { NextResponse, type NextRequest } from 'next/server'

import { emailOperationnel, envoyerEmail } from '@/lib/emails'
import { schemaQuestionVisiteur } from '@/lib/questions/validation'
import { creerClientAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TAILLE_MAX_CORPS = 12_000

function reponse(erreur: string, statut: number, entetes?: Record<string, string>) {
  return NextResponse.json({ erreur }, {
    status: statut,
    headers: { 'Cache-Control': 'no-store', ...entetes },
  })
}

function origineValide(request: NextRequest): boolean {
  const origine = request.headers.get('origin')
  if (!origine) return false

  try {
    return new URL(origine).origin === request.nextUrl.origin
  } catch {
    return false
  }
}

function adresseReseau(request: NextRequest): string {
  // Quand le proxy fournit x-real-ip, c'est la source prioritaire. Sinon,
  // utiliser l'adresse ajoutée en fin de X-Forwarded-For par le proxy de bord.
  // Ne jamais conserver ces valeurs : elles ne servent qu'au HMAC.
  const adresseReelle = request.headers.get('x-real-ip')?.trim() ?? ''
  const sansZoneReel = adresseReelle.replace(/^\[|\]$/g, '').split('%')[0]
  if (isIP(sansZoneReel)) return sansZoneReel

  const chaine = request.headers.get('x-forwarded-for')
  const candidats = chaine?.split(',').map((entree) => entree.trim()).reverse() ?? []

  for (const candidat of candidats) {
    const sansZone = candidat.replace(/^\[|\]$/g, '').split('%')[0]
    if (isIP(sansZone)) return sansZone
  }

  return 'adresse-indisponible'
}

async function lireCorpsLimite(request: NextRequest): Promise<string | null> {
  const tailleAnnoncee = Number(request.headers.get('content-length') ?? 0)
  if (tailleAnnoncee > TAILLE_MAX_CORPS) return null

  const lecteur = request.body?.getReader()
  if (!lecteur) return ''

  const morceaux: Uint8Array[] = []
  let taille = 0
  try {
    while (true) {
      const { done, value } = await lecteur.read()
      if (done) break
      taille += value.byteLength
      if (taille > TAILLE_MAX_CORPS) {
        await lecteur.cancel()
        return null
      }
      morceaux.push(value)
    }
  } finally {
    lecteur.releaseLock()
  }

  const resultat = new Uint8Array(taille)
  let position = 0
  for (const morceau of morceaux) {
    resultat.set(morceau, position)
    position += morceau.byteLength
  }
  return new TextDecoder().decode(resultat)
}

export async function POST(request: NextRequest) {
  if (!origineValide(request)) return reponse('Cette requête ne peut pas être traitée.', 403)
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    return reponse('Format de requête non pris en charge.', 415)
  }

  const corpsTexte = await lireCorpsLimite(request)
  if (corpsTexte === null) return reponse('Votre demande est trop volumineuse.', 413)

  let corps: unknown
  try {
    corps = JSON.parse(corpsTexte)
  } catch {
    return reponse('Le formulaire contient des informations illisibles.', 400)
  }

  if (typeof corps !== 'object' || corps === null || Array.isArray(corps)) {
    return reponse('Vérifiez les informations du formulaire.', 400)
  }

  const brut = corps as Record<string, unknown>
  if (typeof brut.site_web === 'string' && brut.site_web.trim()) {
    return reponse('Vérifiez les informations du formulaire.', 400)
  }

  const validation = schemaQuestionVisiteur.safeParse(brut)
  if (!validation.success) {
    const premierMessage = validation.error.issues[0]?.message
    return reponse(premierMessage ?? 'Vérifiez les informations du formulaire.', 400)
  }

  const cleService = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!cleService || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return reponse('Le service de contact n’est pas encore configuré. Votre question n’a pas été enregistrée.', 503)
  }

  const empreinte = createHmac('sha256', cleService)
    .update(`sikaloc-question:${adresseReseau(request)}`)
    .digest('hex')

  try {
    const admin = creerClientAdmin()
    const { data: limite, error: erreurLimite } = await admin
      .rpc('consommer_limite_questions', { p_empreinte: empreinte })
      .maybeSingle()

    if (erreurLimite || !limite) {
      console.error('[questions] limitation indisponible', erreurLimite?.code ?? 'aucune réponse')
      return reponse('Le service de contact est momentanément indisponible. Votre question n’a pas été enregistrée.', 503)
    }
    if (!limite.autorisee) {
      return reponse('Trop de demandes ont été envoyées récemment. Réessayez un peu plus tard.', 429, {
        'Retry-After': String(limite.reessayer_apres),
      })
    }

    const question = validation.data
    const { data: enregistrement, error } = await admin
      .from('questions_visiteurs')
      .insert({
        nom: question.nom,
        sujet: question.sujet,
        question: question.question,
        canal_reponse: question.canal,
        coordonnees: question.coordonnees,
        consentement: true,
        consentie_le: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error || !enregistrement) {
      console.error('[questions] enregistrement indisponible', error?.code ?? 'aucune ligne')
      return reponse('Votre question n’a pas pu être enregistrée. Réessayez dans un moment.', 503)
    }

    // Notification facultative : désactivée par défaut et impossible en
    // développement local. Elle ne contient aucun nom, contact ou message.
    const destination = process.env.EMAIL_EXPLOITATION?.trim()
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.SIKALOC_QUESTIONS_NOTIFICATIONS_ACTIVE === 'true' &&
      destination &&
      emailOperationnel()
    ) {
      const notification = await envoyerEmail(
        destination,
        'question_recue',
        {},
        `question-visiteur-${enregistrement.id}`,
      )
      if (!notification.ok) console.error('[questions] notification d’exploitation non envoyée', notification.etat ?? 'erreur')
    }

    return NextResponse.json({ ok: true }, {
      status: 201,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (erreur) {
    console.error('[questions] service indisponible', erreur instanceof Error ? erreur.name : 'erreur inconnue')
    return reponse('Le service de contact est momentanément indisponible. Votre question n’a pas été enregistrée.', 503)
  }
}
