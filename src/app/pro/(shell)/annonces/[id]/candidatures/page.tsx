import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ActionConfirmee, BoutonAction } from '@/components/ui/action-confirmee'
import { Alerte, Badge, EnTetePage, EtatVide } from '@/components/ui/retours'
import { repondreCandidature } from '@/lib/actions/candidatures-pro'
import { LIBELLES_STATUT, libelleChambres } from '@/lib/annonces/libelles'
import { LIBELLES_STATUT_CANDIDATURE, TON_STATUT_CANDIDATURE } from '@/lib/candidatures/messages'
import { formaterDate } from '@/lib/format'
import { bailleurOnboarde } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import type { CandidatureDuBailleur, StatutAnnonce } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Candidatures reçues' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Une page à la fois. On en demande 25 pour savoir s'il y en a une suivante. */
const PAR_PAGE = 24

/**
 * Les candidatures reçues sur une annonce.
 *
 * ─── Pourquoi une page à part, et pas un bloc dans la fiche ───────────────
 *
 * La fiche d'annonce porte déjà le formulaire complet, les photos et les
 * actions de publication. Y ajouter une liste dont chaque ligne a ses propres
 * boutons enterrerait les deux. Ici, `[id]` reste l'identifiant interne :
 * l'espace Pro le connaît, la référence publique appartient à Find.
 *
 * ─── Ce que cette page ne décide pas ──────────────────────────────────────
 *
 * Ni ce que le bailleur a le droit de lire — `candidatures_de_mes_annonces`
 * ne rend que les candidatures de SES annonces —, ni ce qu'il a le droit de
 * changer : les boutons affichés suivent les transitions de S8-A, mais c'est
 * la base qui refuse, pas l'écran. Un bouton absent n'est pas une protection.
 *
 * ─── Ce qu'elle ne montre pas ─────────────────────────────────────────────
 *
 * Le téléphone et l'email du candidat. Ils existent dans `candidats`, la
 * fonction ne les rend pas, et cette page ne va pas les chercher ailleurs.
 */
export default async function PageCandidaturesRecues({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const [{ id }, { page }] = await Promise.all([params, searchParams])
  if (!UUID.test(id)) notFound()

  const numeroPage = Math.max(1, Number.parseInt(page ?? '1', 10) || 1)

  const supabase = await creerClientServeur()
  const [, { data: annonce }] = await Promise.all([
    bailleurOnboarde(),
    // Scopée par les politiques de S1 : l'annonce d'un autre bailleur
    // n'existe pas pour cette session, et la page répond 404.
    supabase
      .from('annonces')
      .select('id, reference, statut, type, ville, quartier, chambres')
      .eq('id', id)
      .maybeSingle(),
  ])
  if (!annonce) notFound()

  const { data, error } = await supabase.rpc('candidatures_de_mes_annonces', {
    p_reference: annonce.reference,
    p_limite: PAR_PAGE + 1,
    p_decalage: (numeroPage - 1) * PAR_PAGE,
  })

  if (error) console.error('[candidatures-pro] liste', error.code, error.message)

  const lues = (data ?? []) as CandidatureDuBailleur[]
  const suivante = lues.length > PAR_PAGE
  const candidatures = suivante ? lues.slice(0, PAR_PAGE) : lues

  const titre = `${libelleChambres(annonce.chambres) ?? annonce.type}${annonce.quartier ? ` · ${annonce.quartier}` : ''}`

  return (
    <div className="mx-auto max-w-[56rem] space-y-xl">
      <div>
        <Link href={`/pro/annonces/${annonce.id}`} className="text-body-sm text-mute hover:text-ink">
          ← {titre}
        </Link>
      </div>

      <EnTetePage
        titre="Candidatures reçues"
        description={`${annonce.type} · ${annonce.ville} · Réf. ${annonce.reference}`}
      />

      {error ? (
        <Alerte ton="erreur">
          La liste n’a pas pu être chargée. Rechargez la page dans un instant.
        </Alerte>
      ) : null}

      {/*
        L'état de l'annonce se dit même quand la liste n'est pas vide : une
        annonce suspendue qui a déjà reçu trois candidatures n'en recevra plus,
        et rien d'autre sur cette page ne le laisse deviner.
      */}
      {annonce.statut !== 'publiee' ? (
        <Alerte ton={annonce.statut === 'brouillon' ? 'info' : 'attention'}>
          {attente(annonce.statut)}
        </Alerte>
      ) : null}

      <p className="text-body-sm text-mute">
        Le candidat vous a transmis son nom et son message. Son téléphone et son adresse email ne
        vous sont pas communiqués, et Sikaloc ne le prévient pas encore de votre réponse.
      </p>

      {candidatures.length === 0 ? (
        <EtatVide
          titre="Aucune candidature"
          description={
            annonce.statut === 'publiee'
              ? attente(annonce.statut)
              : 'Aucune candidature n’a été reçue sur cette annonce.'
          }
        />
      ) : (
        <ul className="space-y-md">
          {candidatures.map((c) => (
            <Candidature key={c.candidature_id} candidature={c} />
          ))}
        </ul>
      )}

      {numeroPage > 1 || suivante ? (
        <nav className="flex items-center justify-between gap-md" aria-label="Pagination">
          {numeroPage > 1 ? (
            <Link
              href={`/pro/annonces/${annonce.id}/candidatures${numeroPage > 2 ? `?page=${numeroPage - 1}` : ''}`}
              className="btn btn-secondary btn-sm"
            >
              ← Précédentes
            </Link>
          ) : (
            <span />
          )}
          {suivante ? (
            <Link
              href={`/pro/annonces/${annonce.id}/candidatures?page=${numeroPage + 1}`}
              className="btn btn-secondary btn-sm"
            >
              Suivantes →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  )
}

/** Ce qu'il faut dire quand la liste est vide, selon l'état de l'annonce. */
function attente(statut: StatutAnnonce): string {
  if (statut === 'publiee') {
    return 'Les candidatures reçues depuis Sikaloc_Find apparaîtront ici.'
  }
  if (statut === 'brouillon') {
    return 'Cette annonce est encore un brouillon : elle n’est visible par personne. Publiez-la pour recevoir des candidatures.'
  }
  if (statut === 'suspendue') {
    return 'Cette annonce est suspendue : elle ne figure plus dans Sikaloc_Find, et ne reçoit donc plus de candidature. Reprenez la publication quand vous le souhaitez.'
  }
  return `Cette annonce est ${LIBELLES_STATUT.cloturee.toLowerCase()} : elle ne reçoit plus de candidature.`
}

function Candidature({ candidature: c }: { candidature: CandidatureDuBailleur }) {
  const repondre = repondreCandidature.bind(null, c.candidature_id)
  // Les mêmes transitions qu'en S8-A, à l'écran cette fois. « Acceptée » et
  // « retirée » n'en ont aucune : la première est définitive, la seconde
  // appartient au candidat.
  const enEtude = c.statut === 'envoyee'
  const decidable = c.statut === 'envoyee' || c.statut === 'en_etude'
  const reetudiable = c.statut === 'refusee'

  return (
    <li className="card space-y-md">
      <div className="flex flex-wrap items-start justify-between gap-sm">
        <div className="min-w-0">
          <p className="text-body-md font-semibold text-ink">
            {c.candidat_nom ?? <span className="font-normal text-mute">Candidat supprimé</span>}
          </p>
          <p className="text-caption text-mute">
            Candidature du {formaterDate(c.deposee_le)}
            {c.repondue_le ? ` · réponse le ${formaterDate(c.repondue_le)}` : ''}
          </p>
        </div>
        <Badge ton={TON_STATUT_CANDIDATURE[c.statut]}>
          {LIBELLES_STATUT_CANDIDATURE[c.statut]}
        </Badge>
      </div>

      {c.message ? (
        // Du texte, jamais du HTML : le message est écrit par le candidat.
        <p className="whitespace-pre-line rounded-md bg-canvas-soft p-md text-body-sm text-body">
          {c.message}
        </p>
      ) : (
        <p className="text-body-sm text-mute">Sans message.</p>
      )}

      {c.statut === 'retiree' ? (
        <p className="text-body-sm text-mute">
          Le candidat a retiré sa candidature. Elle reste ici, mais ne se modifie plus.
        </p>
      ) : c.statut === 'acceptee' ? (
        <p className="text-body-sm text-mute">
          Candidature acceptée. Vous pouvez en accepter plusieurs sur la même annonce : accepter
          n’engage aucune réservation et ne crée pas de bail.
        </p>
      ) : (
        <div className="flex flex-wrap items-start gap-md">
          {enEtude ? (
            <BoutonAction
              action={repondre.bind(null, 'en_etude')}
              libelle="Mettre à l’étude"
              libelleEnCours="Enregistrement…"
              variante="secondary"
              compact
            />
          ) : null}
          {reetudiable ? (
            <BoutonAction
              action={repondre.bind(null, 'en_etude')}
              libelle="Remettre à l’étude"
              libelleEnCours="Enregistrement…"
              variante="secondary"
              compact
            />
          ) : null}
          {decidable ? (
            <>
              <ActionConfirmee
                action={repondre.bind(null, 'acceptee')}
                libelle="Accepter"
                variante="primary"
                varianteDeclencheur="secondary"
                titreConfirmation="Êtes-vous sûr de vouloir accepter cette candidature ?"
                messageConfirmation="L’acceptation est définitive : elle ne se modifie plus. Elle ne crée pas de bail, ne réserve pas le logement, et le candidat n’en est pas averti par Sikaloc."
                libelleConfirmation="Accepter"
              />
              <ActionConfirmee
                action={repondre.bind(null, 'refusee')}
                libelle="Refuser"
                variante="danger"
                varianteDeclencheur="tertiary"
                titreConfirmation="Êtes-vous sûr de vouloir refuser cette candidature ?"
                messageConfirmation="Vous pourrez la remettre à l’étude plus tard. Le candidat n’en est pas averti par Sikaloc."
                libelleConfirmation="Refuser"
              />
            </>
          ) : null}
        </div>
      )}
    </li>
  )
}
