/**
 * Banc de la fenêtre de correction — le document suit le paiement.
 *
 *   supabase start
 *   set -a && . ./.env.development.local && set +a && npm run banc:correction
 *
 * ─── Ce que ce banc cherche à faire échouer ─────────────────────────────────
 *
 * `quittances` portait sa propre colonne `bail_id`, écrite à l'insertion du
 * document et jamais réécrite ensuite — la branche de régénération de
 * `genererEtStocker` ne met à jour que `type`, `pdf_chemin` et `hash_sha256`.
 *
 * Or la fenêtre de correction de cinq minutes sert précisément à déplacer un
 * paiement d'un bail à l'autre : le formulaire propose tous les baux actifs du
 * bailleur, libellés « Locataire — adresse ». Après une telle correction, la
 * base portait deux réponses à une seule question, et la page du bailleur
 * lisait la mauvaise : elle affichait l'ancien locataire à côté du PDF du
 * nouveau, et composait le lien WhatsApp avec SON numéro.
 *
 * Le scénario rejoué ici est celui-là, de bout en bout et avec le vrai code :
 *
 *   1. un loyer saisi sur le bail d'Alice, validé, document émis
 *   2. correction dans la fenêtre : le paiement passe au bail de Bob
 *   3. re-validation, donc régénération du document
 *
 * Puis la seule question qui compte : après l'étape 3, TOUT désigne-t-il Bob ?
 *
 * ─── Pourquoi le vrai `genererEtStocker`, et pas une imitation ─────────────
 *
 * Le défaut vivait dans sa branche de régénération. Un banc qui rejouerait
 * l'insertion à sa place testerait sa propre imitation, pas le produit — c'est
 * exactement l'erreur que le banc des invitations a payée. On importe donc la
 * fonction elle-même : elle rend un vrai PDF et le dépose dans le coffre local.
 */
import Module from 'node:module'

// `server-only` lève à l'import hors du rendu serveur Next. `quittance.ts` le
// porte à juste titre — il manipule la clé de service — mais un banc en ligne
// de commande est un contexte serveur légitime. Même contournement que
// `scripts/banc-verification.ts`, et pour la même raison.
//
// Résolu AVANT d'installer le hook : le calculer à l'intérieur ferait rentrer
// `require.resolve` dans le hook qu'il est en train de définir.
const CHEMIN_VIDE = require.resolve('server-only').replace(/index\.js$/, 'empty.js')

const resoudre = (Module as unknown as { _resolveFilename: (...a: unknown[]) => string })
  ._resolveFilename
;(Module as unknown as { _resolveFilename: unknown })._resolveFilename = function (
  this: unknown,
  demande: unknown,
  ...reste: unknown[]
) {
  if (demande === 'server-only') return CHEMIN_VIDE
  return resoudre.call(this, demande, ...reste)
}

import { createClient } from '@supabase/supabase-js'

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

// `.env.local` de ce projet pointe sur la PRODUCTION. Un banc qui crée des
// bailleurs de test et dépose des PDF chez de vrais clients serait un incident,
// pas un test.
if (!/127\.0\.0\.1|localhost/.test(SUPABASE ?? '')) {
  console.error(`Refus : ${SUPABASE ?? '(aucune URL)'} n'est pas une pile locale.`)
  process.exit(1)
}

if (!SERVICE) {
  console.error('SUPABASE_SERVICE_ROLE_KEY manquante.')
  console.error('  set -a && . ./.env.development.local && set +a && npm run banc:correction')
  process.exit(1)
}

const admin = createClient(SUPABASE!, SERVICE, { auth: { persistSession: false } })

let echecs = 0
const noter = (nom: string, ok: boolean, detail?: string) => {
  if (!ok) echecs += 1
  console.log(`  ${ok ? '✓' : '✗'} ${nom}${detail ? ' — ' + detail : ''}`)
}
/** Comparaison explicite : `noter(nom, 0)` échouerait là où 0 est la bonne réponse. */
const comparer = (nom: string, obtenu: unknown, attendu: unknown) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu)
  if (!ok) echecs += 1
  console.log(
    `  ${ok ? '✓' : '✗'} ${nom}` +
      (ok
        ? ` — ${JSON.stringify(obtenu)}`
        : `\n      attendu ${JSON.stringify(attendu)}, obtenu ${JSON.stringify(obtenu)}`),
  )
}
const titre = (t: string) => console.log(`\n${t}`)

/**
 * Insère et lève si la base refuse : un `null` muet masquerait la cause.
 *
 * `NonNullable<T>` et pas `T` : supabase-js type `data` comme pouvant déjà
 * valoir `null`, donc l'inférence faisait entrer ce `null` DANS `T` et le
 * rendait au sortir — l'appelant héritait d'un « possibly null » que ce garde
 * vient précisément d'éliminer.
 */
function exige<T>(
  quoi: string,
  { data, error }: { data: T | null; error: { message: string } | null },
): NonNullable<T> {
  if (error || data == null) throw new Error(`${quoi} : ${error?.message ?? 'aucune ligne rendue'}`)
  return data as NonNullable<T>
}

/** La forme exacte que la page du bailleur demande — c'est elle qu'on teste. */
const SELECT_PAGE =
  '*, paiement:paiements(*, bail:baux(loyer_mensuel, logement:logements(adresse, ville, pays, type), locataire:locataires(nom, telephone)))'

const seul = <T>(v: T | T[] | null | undefined): T | undefined =>
  Array.isArray(v) ? v[0] : (v ?? undefined)

;(async () => {
  console.log('\nFenêtre de correction : le document suit le paiement, ou il ment\n')

  // Chargement DYNAMIQUE, et c'est indispensable : esbuild — le transpileur de
  // tsx — remonte tous les imports statiques en tête de fichier, donc avant le
  // hook installé ci-dessus. `quittance.ts` verrait alors le vrai
  // `server-only`, qui lève. Même raison que dans `banc-verification.ts`.
  const { genererEtStocker, rassemblerDonnees } = await import('../src/lib/quittance')

  /*
   * ─── Les polices, et pourquoi ces trois lignes existent ──────────────────
   *
   * `document-quittance.tsx` importe `Font` statiquement et enregistre les
   * familles au chargement ; `rendrePdf` charge `@react-pdf/renderer` par un
   * `import()` différé, parce que le paquet est lourd. Sous tsx, ces deux
   * chemins résolvent DEUX instances du module — la CJS et l'ESM — chacune avec
   * son propre registre. Le rendu partait donc chercher StyreneB dans un
   * registre vide.
   *
   * C'est un artefact du transpileur, pas un défaut du produit : un bundler
   * n'instancie le paquet qu'une fois, et la production émet bien ses documents.
   * On transpose donc le registre au lieu de le redéclarer — rien n'est dupliqué
   * ici, et un changement de police n'aura pas à être répercuté dans ce banc.
   */
  // `createRequire` plutôt qu'un `require` nu : c'est la façon sanctionnée
  // d'atteindre l'instance CJS depuis un module ESM, et c'est bien cette
  // instance-là qu'on vise — tout l'intérêt de ces trois lignes.
  const requerirCJS = Module.createRequire(__filename)
  const { Font: policesEnregistrees } = requerirCJS('@react-pdf/renderer') as {
    Font: { fontFamilies: Record<string, unknown> }
  }
  const { Font: policesDuRendu } = await import('@react-pdf/renderer')
  Object.assign(policesDuRendu.fontFamilies, policesEnregistrees.fontFamilies)

  const suffixe = Date.now()

  // ═══ Décor ════════════════════════════════════════════════════════════════
  //
  // UN bailleur, DEUX baux. C'est la configuration réelle du défaut : le
  // formulaire de correction ne propose que les baux du bailleur lui-même.
  titre('Décor')

  const { data: compte, error: eCompte } = await admin.auth.admin.createUser({
    email: `banc-correction-${suffixe}@exemple.test`,
    password: 'Jonquille7Mn!',
    email_confirm: true,
    user_metadata: { nom: 'Paul Aholou', telephone: '0197000042' },
  })
  if (eCompte || !compte?.user) throw new Error(`bailleur : ${eCompte?.message}`)
  const bailleurId = compte.user.id

  const creerBail = async (marque: string, nomLocataire: string, loyer: number) => {
    const logement = exige<{ id: string }>(
      `logement ${marque}`,
      await admin
        .from('logements')
        .insert({
          bailleur_id: bailleurId,
          adresse: `Rue ${marque}`,
          ville: 'Cotonou',
          pays: 'Bénin',
          type: 'Appartement',
        })
        .select('id')
        .single(),
    )

    const locataire = exige<{ id: string }>(
      `locataire ${marque}`,
      await admin
        .from('locataires')
        .insert({
          bailleur_id: bailleurId,
          nom: nomLocataire,
          telephone: marque === 'A' ? '0190000001' : '0190000002',
          consentement_donnees: true,
          date_consentement: '2026-01-01',
        })
        .select('id')
        .single(),
    )

    const bail = exige<{ id: string }>(
      `bail ${marque}`,
      await admin
        .from('baux')
        .insert({
          bailleur_id: bailleurId,
          logement_id: logement.id,
          locataire_id: locataire.id,
          loyer_mensuel: loyer,
          date_debut: '2026-01-01',
          jour_echeance: 5,
          tolerance_jours: 3,
          statut: 'Actif',
        })
        .select('id')
        .single(),
    )

    return { bailId: bail.id as string, locataireId: locataire.id as string, nom: nomLocataire }
  }

  const bailAlice = await creerBail('A', 'Alice Danon', 60000)
  const bailBob = await creerBail('B', 'Bob Kpossou', 90000)
  noter('un bailleur, deux baux actifs, deux locataires', true)

  // ═══ 1. Saisie sur le mauvais bail, puis validation ═══════════════════════
  titre('1. Le loyer est saisi sur le bail d’Alice, et validé')

  const paiement = exige<{ id: string }>(
    'paiement',
    await admin
      .from('paiements')
      .insert({
        bailleur_id: bailleurId,
        bail_id: bailAlice.bailId,
        date_paiement: '2026-05-05',
        montant: 60000,
        periode_debut: '2026-05-01',
        periode_fin: '2026-05-31',
        mode_paiement: 'Espèces',
        type_paiement: 'Loyer',
        statut: 'Validé',
        valide_le: new Date().toISOString(),
      })
      .select('id')
      .single(),
  )

  const premiere = await genererEtStocker(paiement.id)
  noter(`document émis — ${premiere.type} n° ${premiere.numeroDocument}`, Boolean(premiere.id))

  const avant = await rassemblerDonnees(paiement.id)
  comparer('le PDF nomme bien Alice', avant?.locataireNom, bailAlice.nom)

  // ═══ 2. La correction, dans la fenêtre de cinq minutes ════════════════════
  //
  // C'est l'écriture que fait `corrigerPaiement` : le bailleur choisit un autre
  // bail dans la liste déroulante. Le déclencheur `proteger_paiement_fige` la
  // laisse passer parce que la validation date de moins de cinq minutes.
  titre('2. Correction : le paiement passe au bail de Bob')

  const { error: eCorrection } = await admin
    .from('paiements')
    .update({ bail_id: bailBob.bailId })
    .eq('id', paiement.id)
  noter('la fenêtre accepte le déplacement', !eCorrection, eCorrection?.message)

  // ═══ 3. Re-validation : la régénération ═══════════════════════════════════
  titre('3. Re-validation : le document est refabriqué')

  const seconde = await genererEtStocker(paiement.id)
  comparer(
    'même document, même numéro — la régénération n’en crée pas un second',
    seconde.numeroDocument,
    premiere.numeroDocument,
  )
  comparer('et toujours une seule quittance pour ce paiement', seconde.id, premiere.id)

  const { count: nbQuittances } = await admin
    .from('quittances')
    .select('id', { count: 'exact', head: true })
    .eq('paiement_id', paiement.id)
  comparer('une ligne, pas deux', nbQuittances, 1)

  // ═══ 4. Cohérence finale : tout désigne Bob ═══════════════════════════════
  titre('4. Après correction, tout désigne Bob')

  // 4.a — Le contenu du PDF.
  const apres = await rassemblerDonnees(paiement.id)
  comparer('le PDF nomme Bob', apres?.locataireNom, bailBob.nom)
  comparer('et porte l’adresse de SON logement', apres?.logementAdresse, 'Rue B')
  comparer('et son loyer', apres?.loyerMensuel, 90000)

  // 4.b — Ce que la page du bailleur affiche, par la requête qu'elle fait
  // vraiment. C'est ici que le défaut se voyait : cette même lecture rendait
  // Alice, à côté du PDF de Bob.
  const vuePage = exige<Record<string, unknown>>(
    'lecture de la page',
    await admin.from('quittances').select(SELECT_PAGE).eq('id', seconde.id).single(),
  )

  /*
   * Le typage est posé à chaque étage plutôt qu'inféré : PostgREST rend une
   * relation embarquée tantôt en objet, tantôt en tableau, et `seul()` ne peut
   * pas deviner ce qu'il déballe. Sans ces annotations, TypeScript réduit le
   * niveau suivant à `{}` et la chaîne casse à la compilation.
   */
  type Embarque = Record<string, unknown>
  const paiementEmbarque = seul<Embarque>(vuePage.paiement as Embarque | Embarque[])
  const bailEmbarque = seul<Embarque>(paiementEmbarque?.bail as Embarque | Embarque[])
  const locataireEmbarque = seul<{ nom: string; telephone: string }>(
    bailEmbarque?.locataire as { nom: string; telephone: string },
  )
  const logementEmbarque = seul<{ adresse: string }>(
    bailEmbarque?.logement as { adresse: string },
  )

  comparer('la page affiche Bob', locataireEmbarque?.nom, bailBob.nom)
  comparer('et l’adresse de son logement', logementEmbarque?.adresse, 'Rue B')
  // Le numéro est celui que compose le lien « Envoyer au locataire sur
  // WhatsApp ». Une erreur ici adresse la quittance de Bob au téléphone d'Alice.
  comparer('et c’est SON numéro que le lien WhatsApp composera', locataireEmbarque?.telephone, '+2290190000002')

  // 4.c — Le locataire et le bailleur lisent le même bail, par le même chemin.
  const { data: viaRpc } = await admin.rpc('ma_quittance', { p_quittance_id: seconde.id })
  noter(
    'ma_quittance() reste joignable et joint par le paiement',
    Array.isArray(viaRpc),
    `${viaRpc?.length ?? 0} ligne(s) pour un appel sans session locataire`,
  )

  // ═══ 5. La divergence n'est plus représentable ════════════════════════════
  //
  // Les quatre contrôles ci-dessus passeraient encore si l'on s'était contenté
  // de réécrire la colonne à la régénération. Celui-ci dit pourquoi le défaut
  // ne peut pas revenir par un autre chemin d'écriture : il n'y a plus de
  // second endroit où le bail puisse être dit.
  titre('5. Il n’y a plus deux endroits où le bail est écrit')

  const { error: eColonne } = await admin.from('quittances').select('bail_id').limit(1)
  noter(
    'quittances ne porte plus de colonne bail_id',
    Boolean(eColonne),
    eColonne?.message,
  )

  const { error: eEcriture } = await admin
    .from('quittances')
    .update({ bail_id: bailAlice.bailId })
    .eq('id', seconde.id)
  noter(
    'et rien ne peut plus l’y écrire',
    Boolean(eEcriture),
    eEcriture?.message,
  )

  // ═══ Verdict ══════════════════════════════════════════════════════════════
  console.log(
    echecs === 0
      ? '\n✓ Le document suit son paiement, du PDF jusqu’au lien WhatsApp.\n'
      : `\n✗ ${echecs} contrôle(s) en échec.\n`,
  )
  process.exit(echecs === 0 ? 0 : 1)
})().catch((erreur) => {
  console.error(`\nBanc interrompu : ${erreur instanceof Error ? erreur.message : erreur}\n`)
  process.exit(1)
})
