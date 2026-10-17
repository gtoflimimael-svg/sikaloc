import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ResumeListe, TableauListe } from '@/components/ui/listes'
import { Illustration } from '@/components/ui/illustration'
import { Alerte, Badge, EnTetePage, EtatVide } from '@/components/ui/retours'
import {
  formaterDateCourte,
  formaterFCFA,
  formaterPeriode,
} from '@/lib/format'
import { bailleurOnboarde } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

export const metadata: Metadata = { title: 'Historique des paiements' }

export default async function PageHistoriquePaiements({
  searchParams,
}: {
  searchParams: Promise<{ bail?: string; statut?: string; page?: string }>
}) {
  await bailleurOnboarde()
  const { bail: bailFiltre, statut, page: pageBrute } = await searchParams
  const page = pageBrute && /^[1-9]\d{0,5}$/.test(pageBrute) ? Number(pageBrute) : 1
  const parPage = 50
  const urlPage = (numero: number) => {
    const params = new URLSearchParams()
    if (bailFiltre) params.set('bail', bailFiltre)
    if (statut) params.set('statut', statut)
    if (numero > 1) params.set('page', String(numero))
    return '/pro/paiements' + (params.size ? '?' + params.toString() : '')
  }
  const supabase = await creerClientServeur()

  let requete = supabase
    .from('paiements')
    .select(
      '*, bail:baux(id, locataire:locataires(nom), logement:logements(adresse)), quittance:quittances(id, numero_document, type)',
      { count: 'exact' },
    )
    // `nullsFirst: false` : un paiement historique n'a pas de date, et
    // Postgres place les NULL en tête d'un tri décroissant. Sans cela, les
    // loyers d'avant Sikaloc ouvriraient la liste des paiements récents. On
    // retombe sur la période pour les départager entre eux.
    .order('date_paiement', { ascending: false, nullsFirst: false })
    .order('periode_debut', { ascending: false })
    .order('id', { ascending: false })
    .range((page - 1) * parPage, page * parPage - 1)

  if (bailFiltre) requete = requete.eq('bail_id', bailFiltre)
  if (statut === 'Brouillon' || statut === 'Validé') requete = requete.eq('statut', statut)

  const [{ data: paiements, error: erreurPaiements, count: nombre, status: statutLecture }, { data: baux, error: erreurBaux }] = await Promise.all([
    requete,
    supabase
      .from('baux')
      .select('id, locataire:locataires(nom), logement:logements(adresse)')
      .order('created_at', { ascending: false }),
  ])

  // PostgREST répond 416 pour une plage située après la dernière ligne.
  // Relire uniquement le total autorisé évite d’interpréter ce cas comme une panne.
  if (statutLecture === 416) {
    let compteur = supabase.from('paiements').select('id', { count: 'exact', head: true })
    if (bailFiltre) compteur = compteur.eq('bail_id', bailFiltre)
    if (statut === 'Brouillon' || statut === 'Validé') compteur = compteur.eq('statut', statut)
    const mesure = await compteur
    if (!mesure.error && mesure.count !== null) redirect(urlPage(Math.max(1, Math.ceil(mesure.count / parPage))))
  }
  const pages = Math.max(1, Math.ceil((nombre ?? 0) / parPage))
  if (!erreurPaiements && page > pages) redirect(urlPage(pages))
  const liste = paiements ?? []
  const total = liste
    .filter((p) => p.statut === 'Validé')
    .reduce((somme, p) => somme + Number(p.montant), 0)

  return (
    <div>
      <EnTetePage
        titre="Historique des paiements"
        description="Tous les encaissements enregistrés, du plus récent au plus ancien."
        action={
          <Link href="/pro/paiements/nouveau" className="btn btn-primary">
            Nouveau paiement
          </Link>
        }
      />

      {/* ── Filtres ────────────────────────────────────────────────────── */}
      {erreurBaux ? <div className="mb-md"><Alerte ton="attention">La liste des baux est indisponible. Le filtre de bail actuel est conservé.</Alerte></div> : null}
      <form method="get" aria-label="Filtrer les paiements" className="filter-bar">
        <div>
          <label htmlFor="bail" className="field-label">
            Bail
          </label>
          {erreurBaux ? <input type="hidden" name="bail" value={bailFiltre ?? ''} /> : null}
          <select id="bail" name="bail" defaultValue={bailFiltre ?? ''} disabled={Boolean(erreurBaux)} className="input">
            {erreurBaux ? <option value={bailFiltre ?? ''}>{bailFiltre ? 'Bail sélectionné (liste indisponible)' : 'Liste des baux indisponible'}</option> : <option value="">Tous les baux</option>}
            {(baux ?? []).map((b) => {
              const locataire = Array.isArray(b.locataire) ? b.locataire[0] : b.locataire
              const logement = Array.isArray(b.logement) ? b.logement[0] : b.logement

              return (
                <option key={b.id} value={b.id}>
                  {locataire?.nom ?? 'Locataire'} — {logement?.adresse ?? 'logement'}
                </option>
              )
            })}
          </select>
        </div>

        <div>
          <label htmlFor="statut" className="field-label">
            Statut
          </label>
          <select id="statut" name="statut" defaultValue={statut ?? ''} className="input">
            <option value="">Tous</option>
            <option value="Validé">Validés</option>
            <option value="Brouillon">Brouillons</option>
          </select>
        </div>

        <div className="flex flex-wrap items-end gap-sm">
          <button type="submit" className="btn btn-secondary">
            Filtrer
          </button>
          {bailFiltre || statut ? (
            <Link href="/pro/paiements" className="btn btn-secondary">
              Réinitialiser
            </Link>
          ) : null}
        </div>
      </form>

      {erreurPaiements ? (
        <Alerte ton="erreur">Les paiements ne peuvent pas être chargés. Actualisez la page pour réessayer.</Alerte>
      ) : liste.length === 0 ? (
        <EtatVide
          icone={<Illustration nom="courses" taille={200} decorative />}
          titre={bailFiltre || statut ? "Aucun paiement pour ces filtres" : "Aucun paiement"}
          description={bailFiltre || statut ? "Modifiez les filtres pour consulter les autres paiements." : "Les paiements enregistrés apparaîtront ici, avec leur quittance."}
          action={
            <Link href="/pro/paiements/nouveau" className="btn btn-primary">
              Enregistrer un paiement
            </Link>
          }
        />
      ) : (
        <>
          <ResumeListe>
            <span>
              {nombre ?? liste.length} paiement{(nombre ?? liste.length) > 1 ? 's' : ''} · {liste.length} affiché{liste.length > 1 ? 's' : ''}
            </span>

            <span>
              Total validé affiché :{' '}
              <strong className="money font-semibold text-ink">{formaterFCFA(total)}</strong>
            </span>
          </ResumeListe>

          <TableauListe id="paiements" libelle="Historique des paiements">
            <table className="data-table table-paiements">
              <caption className="sr-only">Paiements affichés, avec leur statut et leur document</caption>
              <thead>
                <tr>
                  <th scope="col">Locataire</th>
                  <th scope="col">Période</th>
                  <th scope="col" className="hidden sm:table-cell">
                    Date
                  </th>
                  <th scope="col" className="hidden lg:table-cell">
                    Mode
                  </th>
                  <th scope="col">Statut</th>
                  <th scope="col" className="text-right">
                    Montant
                  </th>
                  <th scope="col" className="text-right">
                    Document
                  </th>
                </tr>
              </thead>
              <tbody>
                {liste.map((paiement) => {
                  const bail = Array.isArray(paiement.bail) ? paiement.bail[0] : paiement.bail
                  const locataire = Array.isArray(bail?.locataire)
                    ? bail?.locataire[0]
                    : bail?.locataire
                  const quittance = Array.isArray(paiement.quittance)
                    ? paiement.quittance[0]
                    : paiement.quittance

                  return (
                    <tr key={paiement.id}>
                      <td className="font-semibold">{locataire?.nom ?? '—'}</td>
                      <td>{formaterPeriode(paiement.periode_debut)}</td>
                      <td className="hidden sm:table-cell">
                        {paiement.historique ? (
                          // La date n'est pas connue, et l'inventer serait
                          // affirmer un encaissement qui n'a pas eu lieu ce
                          // jour-là. On dit ce qu'on sait : c'était avant.
                          <span className="text-mute">Avant Sikaloc</span>
                        ) : (
                          formaterDateCourte(paiement.date_paiement)
                        )}
                      </td>
                      <td className="hidden lg:table-cell">{paiement.mode_paiement}</td>
                      <td>
                        {paiement.statut === 'Validé' ? (
                          <Badge ton={paiement.est_partiel ? 'warning' : 'positive'}>
                            {paiement.est_partiel ? 'Partiel' : 'Payé'}
                          </Badge>
                        ) : (
                          <Badge ton="warning">Brouillon</Badge>
                        )}
                        {/*
                          Dire d'où vient ce paiement évite de laisser croire
                          que Sikaloc était en service au moment de
                          l'encaissement — et donc qu'il en a été témoin.
                        */}
                        {paiement.historique ? (
                          <span className="mt-xxs block text-caption text-mute">
                            Paiement historique
                          </span>
                        ) : null}
                      </td>
                      <td className="money text-right font-semibold">
                        {formaterFCFA(paiement.montant)}
                      </td>
                      <td className="text-right">
                        {quittance ? (
                          <Link
                            href={`/pro/quittances/${quittance.id}`}
                            aria-label={`Voir ${quittance.type} — ${locataire?.nom ?? 'locataire'}, ${formaterPeriode(paiement.periode_debut)}`}
                            className="font-semibold text-ink underline"
                          >
                            {quittance.type}
                          </Link>
                        ) : paiement.historique ? (
                          /*
                            Surtout pas « À confirmer » : ce lien mène à
                            l'écran qui émet une quittance, et une quittance de
                            janvier portant la date d'aujourd'hui serait une
                            pièce qui n'a jamais existé. Ce paiement n'attend
                            rien de personne — on le dit, sans proposer d'agir.
                          */
                          <span className="text-caption text-mute">
                            Aucune quittance
                          </span>
                        ) : (
                          <Link
                            href={`/pro/paiements/${paiement.id}/confirmer`}
                            aria-label={`À confirmer — ${locataire?.nom ?? 'locataire'}, ${formaterPeriode(paiement.periode_debut)}`}
                            className="font-semibold text-warning-content underline"
                          >
                            À confirmer
                          </Link>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableauListe>
          {pages > 1 ? (
            <nav aria-label="Pagination des paiements" className="mt-lg flex flex-wrap items-center justify-between gap-sm">
              {page > 1 ? <Link href={urlPage(page - 1)} rel="prev" className="btn btn-secondary">← Page précédente</Link> : <span />}
              <p aria-current="page" className="text-body-sm text-mute">Page {page} sur {pages}</p>
              {page < pages ? <Link href={urlPage(page + 1)} rel="next" className="btn btn-secondary">Page suivante →</Link> : <span />}
            </nav>
          ) : null}
        </>
      )}
    </div>
  )
}
