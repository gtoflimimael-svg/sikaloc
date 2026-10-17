import { CheckCircle2 } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  FormulaireInscriptionCandidat,
  FormulaireMessageCandidature,
  FormulaireProfilCandidat,
} from '@/components/find/candidature'
import { EnTeteFind, PiedDePageFind } from '@/components/find/navigation'
import { Alerte, Badge } from '@/components/ui/retours'
import {
  enregistrerProfilCandidat,
  envoyerCandidature,
  inscrireCandidat,
} from '@/lib/actions/candidatures'
import { LIBELLES_STATUT_CANDIDATURE, TON_STATUT_CANDIDATURE } from '@/lib/candidatures/messages'
import { libelleChambres } from '@/lib/annonces/libelles'
import { formaterFCFA } from '@/lib/format'
import { rolesDuCompte } from '@/lib/session'
import { creerClientServeur, obtenirUtilisateur } from '@/lib/supabase/serveur'
import type { AnnoncePublique, CandidatureDuCandidat } from '@/lib/types/database'

/**
 * Candidater à une annonce — le parcours, d'un bout à l'autre.
 *
 * ─── Une page, quatre états ────────────────────────────────────────────────
 *
 *   visiteur              → créer un compte, ou se connecter en gardant
 *                           l'annonce dans `suite`
 *   connecté, sans profil → nom et téléphone, rien de plus
 *   candidat              → son message au bailleur
 *   déjà candidaté        → l'état de sa candidature, et pas un second envoi
 *
 * ─── Ce que la page ne décide pas ──────────────────────────────────────────
 *
 * Elle lit l'annonce par `annonce_publiee` : une annonce en brouillon,
 * suspendue ou clôturée n'existe pas pour elle, et répond 404 comme la fiche.
 * Mais c'est `soumettre_candidature` qui tranche au moment de l'envoi — entre
 * l'affichage et le clic, une annonce peut changer d'état.
 *
 * Non indexable : c'est un parcours, pas une page de contenu.
 */

export const metadata: Metadata = {
  title: 'Candidater',
  robots: { index: false, follow: true },
}

const REFERENCE = /^[0-9a-hjkmnp-tv-z]{10}$/

export default async function PageCandidater({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>
  searchParams: Promise<{ envoyee?: string }>
}) {
  const [{ reference }, { envoyee }] = await Promise.all([params, searchParams])
  if (!REFERENCE.test(reference)) notFound()

  const supabase = await creerClientServeur()
  const [{ data: lignes, error: erreurAnnonce }, utilisateur] = await Promise.all([
    supabase.rpc('annonce_publiee', { p_reference: reference }),
    obtenirUtilisateur(),
  ])
  if (erreurAnnonce) throw new Error('Cette annonce ne peut pas être chargée pour le moment.')
  const annonce = (lignes ?? [])[0] as AnnoncePublique | undefined
  if (!annonce) notFound()

  const titre = libelleChambres(annonce.chambres)
    ? `${annonce.type} · ${libelleChambres(annonce.chambres)}`
    : annonce.type
  const lieu = annonce.quartier ? `${annonce.quartier}, ${annonce.ville}` : annonce.ville

  // L'état du compte, quand il y en a un.
  let profilCandidat = false
  let candidature: CandidatureDuCandidat | undefined
  let nom: string | undefined
  let telephone: string | undefined

  if (utilisateur) {
    const roles = await rolesDuCompte()
    profilCandidat = roles.estCandidat

    if (profilCandidat) {
      const [{ data: profil, error: erreurProfil }, { data: candidatures, error: erreurCandidatures }] = await Promise.all([
        supabase.from('candidats').select('nom, telephone').eq('id', utilisateur.id).maybeSingle(),
        supabase.rpc('mes_candidatures'),
      ])
      if (erreurProfil || erreurCandidatures) throw new Error('Le parcours de candidature est momentanément indisponible.')
      nom = profil?.nom
      telephone = profil?.telephone
      candidature = ((candidatures ?? []) as CandidatureDuCandidat[]).find(
        (c) => c.reference === reference,
      )
    }
  }

  return (
    <div className="min-h-screen bg-canvas-soft">
      <EnTeteFind connecte={Boolean(utilisateur)} />

      <main id="contenu" className="mx-auto max-w-[44rem] app-main">
        <Link href={`/find/${reference}`} className="text-body-sm text-mute hover:text-ink">
          ← Revenir à l’annonce
        </Link>

        <section className="mt-lg card card-lg">
          <p className="text-caption font-medium text-mute">
            Candidater à cette annonce
          </p>
          <h1 className="mt-xs page-title">{titre}</h1>
          <p className="mt-xs list-copy text-body-md text-body">
            {lieu} · {formaterFCFA(annonce.loyer)} / mois · Réf. {annonce.reference}
          </p>
        </section>

        <section className="mt-xl card card-lg">
          {!utilisateur ? (
            <>
              <h2 className="section-title">Créez votre compte</h2>
              <p className="mt-sm mb-lg text-body-md text-body">
                Il vous permet de suivre vos candidatures. Votre email et votre téléphone ne sont
                pas transmis au bailleur.
              </p>
              <FormulaireInscriptionCandidat
                action={inscrireCandidat.bind(null, reference)}
                connexion={`/connexion?suite=${encodeURIComponent(`/find/${reference}/candidater`)}`}
              />
            </>
          ) : !profilCandidat ? (
            <>
              <h2 className="section-title">Complétez votre profil</h2>
              <p className="mt-sm mb-lg text-body-md text-body">
                Deux informations suffisent pour candidater.
              </p>
              <FormulaireProfilCandidat action={enregistrerProfilCandidat.bind(null, reference)} />
            </>
          ) : candidature ? (
            <>
              <div className="flex items-start gap-md rounded-md border border-positive/30 bg-positive-pale p-lg">
                <CheckCircle2 size={20} aria-hidden="true" className="mt-xxs shrink-0 text-positive-deep" />
                <p className="text-body-sm text-positive-deep">
                  {envoyee === '1'
                    ? 'Votre candidature est envoyée. Le bailleur la verra dans son espace.'
                    : 'Vous avez déjà candidaté à cette annonce.'}
                </p>
              </div>
              <div className="mt-lg flex flex-wrap items-center gap-md">
                <Badge ton={TON_STATUT_CANDIDATURE[candidature.statut]}>
                  {LIBELLES_STATUT_CANDIDATURE[candidature.statut]}
                </Badge>
                <span className="text-body-sm text-mute">
                  Envoyée le {new Date(candidature.deposee_le).toLocaleDateString('fr-FR')}
                </span>
              </div>
              <p className="mt-lg text-body-sm text-body">
                Sikaloc ne garantit pas de réponse : c’est le bailleur qui décide, et quand il le
                décide. Vous retrouverez l’état de votre candidature à tout moment.
              </p>
              <div className="mt-lg flex flex-wrap gap-md">
                <Link href="/me/candidatures" className="btn btn-primary">
                  Mes candidatures
                </Link>
                <Link href="/find" className="btn btn-secondary">
                  Voir d’autres logements
                </Link>
              </div>
            </>
          ) : (
            <>
              <h2 className="section-title">Votre candidature</h2>
              <p className="mt-sm mb-lg text-body-md text-body">
                Le bailleur verra votre nom et votre message. <strong>Ni votre téléphone, ni
                votre email</strong> ne lui sont transmis.
              </p>
              <FormulaireMessageCandidature action={envoyerCandidature.bind(null, reference)} />
              <Alerte ton="info">
                Une candidature s’envoie une seule fois par annonce. Vous pourrez la retirer, mais
                pas en déposer une seconde.
              </Alerte>
              {nom ? (
                <p className="mt-lg text-caption text-mute">
                  Vous candidatez en tant que {nom}
                  {telephone ? ` · ${telephone}` : ''}.{' '}
                  <Link href="/me/candidatures" className="underline">
                    Modifier mon profil
                  </Link>
                </p>
              ) : null}
            </>
          )}
        </section>
      </main>

      <PiedDePageFind />
    </div>
  )
}
