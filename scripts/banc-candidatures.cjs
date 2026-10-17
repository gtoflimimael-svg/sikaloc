/**
 * Banc des candidatures — Sikaloc_Find, S8-A.
 *
 *   supabase start · environnement pointant sur la pile LOCALE
 *   npm run banc:candidatures
 *
 * ─── Ce qu'il surveille ─────────────────────────────────────────────────────
 *
 *   1. Le schéma : profils, candidatures, contraintes, unicité, horodatage.
 *   2. L'isolation : candidat A contre candidat B, bailleur A contre bailleur B,
 *      et un visiteur qui ne touche rien.
 *   3. L'usurpation : personne ne choisit son `candidat_id`, ni l'annonce d'un
 *      autre.
 *   4. Les transitions : qui peut faire quoi, et ce qui est définitif.
 *   5. La concurrence : cinq envois simultanés, une seule candidature.
 *   6. L'histoire : suspension, clôture, suppression d'un compte — rien ne
 *      s'efface, l'identité seule s'en va.
 *   7. L'étanchéité : rien de tout cela n'atteint la vitrine publique.
 *
 * Aucune interface : S8-A s'arrête aux fondations.
 */
const { randomUUID } = require('node:crypto')
const { createClient } = require('@supabase/supabase-js')
const sharp = require('sharp')

const { exigerPileLocale } = require('./garde-locale.cjs')
const { rangerComptes } = require('./menage-comptes.cjs')

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

exigerPileLocale('Ce banc')

const admin = createClient(SUPABASE, SERVICE, { auth: { persistSession: false } })
const visiteur = createClient(SUPABASE, ANON, { auth: { persistSession: false } })
const MDP = 'Jonquille7Mn!'

const etapes = []
const noter = (nom, ok, detail) => {
  etapes.push(ok)
  console.log(`  ${ok ? '✓' : '✗'} ${nom}${detail ? ' — ' + detail : ''}`)
}
const titre = (t) => console.log(`\n${t}`)
const comptes = []

/**
 * Vide le coffre d'un compte AVANT de le supprimer : supprimer un compte
 * efface ses lignes, pas ses fichiers (trou connu, relevé en S3).
 */
async function viderCoffre(id) {
  const { data: dossiers } = await admin.storage.from('annonces').list(id, { limit: 100 })
  for (const dossier of dossiers ?? []) {
    const { data: f } = await admin.storage.from('annonces').list(`${id}/${dossier.name}`)
    if (f?.length) await admin.storage.from('annonces').remove(f.map((x) => `${id}/${dossier.name}/${x.name}`))
  }
}

/** Le motif rendu par une fonction, ou le code de l'erreur. */
const motifDe = (reponse) => reponse.error?.code ?? reponse.data?.[0]?.motif ?? '(vide)'

async function compte(cle, nom) {
  const email = `banc-cand-${cle}-${Date.now()}@exemple.test`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: MDP,
    email_confirm: true,
    user_metadata: { nom, telephone: '+2290190000020' },
  })
  if (error) throw new Error(`${cle} : ${error.message}`)
  comptes.push(data.user.id)
  const db = createClient(SUPABASE, ANON, { auth: { persistSession: false } })
  await db.auth.signInWithPassword({ email, password: MDP })
  return { id: data.user.id, email, db }
}

;(async () => {
  console.log('\nSikaloc_Find — candidats et candidatures (S8-A)\n')

  const bailleurA = await compte('bailleur-a', 'Bailleur A')
  const bailleurB = await compte('bailleur-b', 'Bailleur B')
  const candidatA = await compte('candidat-a', 'Candidat A')
  const candidatB = await compte('candidat-b', 'Candidat B')

  const fichier = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: '#7a5c3e' } })
    .jpeg({ quality: 70 })
    .toBuffer()

  /** Une annonce complète du bailleur donné, amenée au statut voulu. */
  async function annonce(b, statut, ville = 'Bohicon') {
    const { data: logement } = await admin
      .from('logements')
      .insert({ bailleur_id: b.id, adresse: 'Lot 4, quartier Ahouansori', type: 'Appartement', ville })
      .select('id')
      .single()
    const { data: a } = await admin
      .from('annonces')
      .insert({
        bailleur_id: b.id,
        logement_id: logement.id,
        type: 'Appartement',
        ville,
        quartier: 'Ahouansori',
        chambres: 2,
        loyer: 95000,
        description: 'Logement du banc, deux chambres salon, cour clôturée.',
      })
      .select('id, reference')
      .single()
    const chemin = `${b.id}/${a.id}/${randomUUID()}.jpg`
    await admin.storage.from('annonces').upload(chemin, fichier, { contentType: 'image/jpeg' })
    await admin.from('annonce_photos').insert({
      annonce_id: a.id, bailleur_id: b.id, chemin, position: 0,
      largeur: 1600, hauteur: 1200, type_mime: 'image/jpeg', poids: fichier.length,
    })
    if (statut !== 'brouillon') await admin.from('annonces').update({ statut: 'publiee' }).eq('id', a.id)
    if (statut === 'suspendue') await admin.from('annonces').update({ statut: 'suspendue' }).eq('id', a.id)
    if (statut === 'cloturee') await admin.from('annonces').update({ statut: 'cloturee', motif_cloture: 'retiree' }).eq('id', a.id)
    return a
  }

  const publiee = await annonce(bailleurA, 'publiee')
  const publiee2 = await annonce(bailleurA, 'publiee')
  const publiee3 = await annonce(bailleurA, 'publiee')
  const brouillon = await annonce(bailleurA, 'brouillon')
  const suspendue = await annonce(bailleurA, 'suspendue')
  const cloturee = await annonce(bailleurA, 'cloturee')
  const chezB = await annonce(bailleurB, 'publiee', 'Lokossa')

  // ═══ 1. Le profil candidat ═══════════════════════════════════════════════
  titre('1. Le profil candidat')

  noter('Un compte crée son profil', motifDe(await candidatA.db.rpc('enregistrer_profil_candidat', { p_nom: 'Afi Kouassi', p_telephone: '+22997000001' })) === 'ok')
  noter('Le même compte rappelé : toujours un seul profil', motifDe(await candidatA.db.rpc('enregistrer_profil_candidat', { p_nom: 'Afi K. Kouassi', p_telephone: '+22997000001' })) === 'ok')
  const { count: profils } = await admin.from('candidats').select('id', { count: 'exact', head: true }).eq('id', candidatA.id)
  noter('…une seule ligne, mise à jour', profils === 1)
  const { data: profilA } = await admin.from('candidats').select('*').eq('id', candidatA.id).single()
  // Le Bénin est passé à dix chiffres : `prive.canoniser_telephone` ajoute le
  // préfixe `01`, comme pour un bailleur ou un locataire.
  noter('Le téléphone est canonisé, comme partout ailleurs', profilA.telephone === '+2290197000001', profilA.telephone)
  noter('Horodatage posé', Boolean(profilA.created_at) && Boolean(profilA.mis_a_jour_le))

  noter('Nom trop court : refusé, sans erreur SQL', motifDe(await candidatA.db.rpc('enregistrer_profil_candidat', { p_nom: 'A', p_telephone: '+22997000001' })) === 'nom_invalide')
  noter('Téléphone trop court : refusé', motifDe(await candidatA.db.rpc('enregistrer_profil_candidat', { p_nom: 'Afi Kouassi', p_telephone: '123' })) === 'telephone_invalide')
  await candidatB.db.rpc('enregistrer_profil_candidat', { p_nom: 'Yao Dossou', p_telephone: '+22997000002' })

  const { data: vuParA } = await candidatA.db.from('candidats').select('id').eq('id', candidatB.id)
  noter('A ne lit pas le profil de B', (vuParA ?? []).length === 0)
  const { data: modifParA } = await candidatA.db.from('candidats').update({ nom: 'Usurpé' }).eq('id', candidatB.id).select()
  const { data: profilB } = await admin.from('candidats').select('nom').eq('id', candidatB.id).single()
  noter('A ne modifie pas le profil de B', (modifParA ?? []).length === 0 && profilB.nom === 'Yao Dossou')
  const anonProfil = await visiteur.from('candidats').select('id').limit(1)
  noter('Un visiteur ne lit aucun profil', Boolean(anonProfil.error), anonProfil.error?.code)
  noter('Un visiteur n’appelle pas les fonctions de candidature', Boolean((await visiteur.rpc('soumettre_candidature', { p_reference: publiee.reference })).error))

  // ═══ 2. Déposer une candidature ═════════════════════════════════════════
  titre('2. Déposer une candidature')

  const depot = await candidatA.db.rpc('soumettre_candidature', { p_reference: publiee.reference, p_message: '  Bonjour, je suis intéressé.  ' })
  noter('Annonce publiée : candidature déposée', motifDe(depot) === 'ok' && Boolean(depot.data[0].candidature_id))
  const { data: ligne } = await admin.from('candidatures').select('*').eq('id', depot.data[0].candidature_id).single()
  noter('Statut initial « envoyée », sans date de réponse', ligne.statut === 'envoyee' && ligne.repondue_le === null)
  noter('Le candidat est celui de la session, l’annonce est l’identifiant interne', ligne.candidat_id === candidatA.id && ligne.annonce_id === publiee.id)
  noter('Le message est conservé, espaces en trop retirés', ligne.message === 'Bonjour, je suis intéressé.')

  noter('Deux fois la même annonce : refusé', motifDe(await candidatA.db.rpc('soumettre_candidature', { p_reference: publiee.reference })) === 'deja_candidate')
  noter('Compte sans profil candidat : refusé', motifDe(await bailleurB.db.rpc('soumettre_candidature', { p_reference: publiee.reference })) === 'profil_absent')
  noter('Message trop long : refusé', motifDe(await candidatA.db.rpc('soumettre_candidature', { p_reference: publiee2.reference, p_message: 'x'.repeat(1001) })) === 'message_trop_long')

  const indisponibles = [
    ['Brouillon', brouillon.reference],
    ['Suspendue', suspendue.reference],
    ['Clôturée', cloturee.reference],
    ['Référence inconnue', '0000000000'],
    ['Référence mal formée', 'ILLOU00000'],
    ['Identifiant interne à la place de la référence', publiee.id],
  ]
  for (const [cas, reference] of indisponibles) {
    noter(`${cas} : la même réponse, « annonce indisponible »`, motifDe(await candidatA.db.rpc('soumettre_candidature', { p_reference: reference })) === 'annonce_indisponible')
  }

  // ═══ 3. Usurpation ══════════════════════════════════════════════════════
  titre('3. Personne ne choisit son candidat ni son annonce')

  const auNomDeB = await candidatA.db.from('candidatures').insert({ candidat_id: candidatB.id, annonce_id: publiee2.id })
  noter('A ne dépose pas au nom de B', Boolean(auNomDeB.error), auNomDeB.error?.code)
  const surBrouillon = await candidatA.db.from('candidatures').insert({ candidat_id: candidatA.id, annonce_id: brouillon.id })
  noter('Écriture directe sur une annonce non publiée : refusée', Boolean(surBrouillon.error), surBrouillon.error?.code)
  const depotB = await candidatB.db.rpc('soumettre_candidature', { p_reference: publiee.reference })
  const candidatureB = depotB.data[0].candidature_id
  const { data: vuesParA } = await candidatA.db.from('candidatures').select('id').eq('id', candidatureB)
  noter('A ne voit pas la candidature de B', (vuesParA ?? []).length === 0)
  const { data: touchéeParA } = await candidatA.db.from('candidatures').update({ statut: 'retiree' }).eq('id', candidatureB).select()
  noter('A ne retire pas la candidature de B', (touchéeParA ?? []).length === 0)
  noter('…même par la fonction', motifDe(await candidatA.db.rpc('retirer_candidature', { p_candidature_id: candidatureB })) === 'introuvable')

  const { data: vuesParBailleurB } = await bailleurB.db.from('candidatures').select('id').eq('annonce_id', publiee.id)
  noter('Le bailleur B ne voit pas les candidatures des annonces de A', (vuesParBailleurB ?? []).length === 0)
  noter('…et ne peut pas y répondre', motifDe(await bailleurB.db.rpc('repondre_candidature', { p_candidature_id: depot.data[0].candidature_id, p_statut: 'acceptee' })) === 'introuvable')
  const anonCandidatures = await visiteur.from('candidatures').select('id').limit(1)
  noter('Un visiteur ne lit aucune candidature', Boolean(anonCandidatures.error), anonCandidatures.error?.code)

  // ═══ 4. Transitions ═════════════════════════════════════════════════════
  titre('4. Qui peut faire quoi')

  const c1 = depot.data[0].candidature_id
  noter('Le bailleur met en étude', motifDe(await bailleurA.db.rpc('repondre_candidature', { p_candidature_id: c1, p_statut: 'en_etude' })) === 'ok')
  noter('Le bailleur accepte', motifDe(await bailleurA.db.rpc('repondre_candidature', { p_candidature_id: c1, p_statut: 'acceptee' })) === 'ok')
  const { data: acceptee } = await admin.from('candidatures').select('statut, repondue_le').eq('id', c1).single()
  noter('…la date de réponse est posée', acceptee.statut === 'acceptee' && Boolean(acceptee.repondue_le))
  noter('Une candidature acceptée ne se refuse plus', motifDe(await bailleurA.db.rpc('repondre_candidature', { p_candidature_id: c1, p_statut: 'refusee' })) === 'transition_refusee')
  noter('…ni ne se retire', motifDe(await candidatA.db.rpc('retirer_candidature', { p_candidature_id: c1 })) === 'retrait_impossible')

  noter('Le bailleur refuse la candidature de B', motifDe(await bailleurA.db.rpc('repondre_candidature', { p_candidature_id: candidatureB, p_statut: 'refusee' })) === 'ok')
  noter('Un refus peut se reconsidérer', motifDe(await bailleurA.db.rpc('repondre_candidature', { p_candidature_id: candidatureB, p_statut: 'en_etude' })) === 'ok')
  const { data: reconsideree } = await admin.from('candidatures').select('repondue_le').eq('id', candidatureB).single()
  noter('…et la date de réponse repart à zéro', reconsideree.repondue_le === null)

  noter('Le bailleur ne « retire » pas une candidature', motifDe(await bailleurA.db.rpc('repondre_candidature', { p_candidature_id: candidatureB, p_statut: 'retiree' })) === 'reponse_invalide')
  noter('Le candidat ne répond pas à sa propre candidature', motifDe(await candidatB.db.rpc('repondre_candidature', { p_candidature_id: candidatureB, p_statut: 'acceptee' })) === 'introuvable')
  noter('Le candidat retire la sienne', motifDe(await candidatB.db.rpc('retirer_candidature', { p_candidature_id: candidatureB })) === 'ok')
  const { data: retiree } = await admin.from('candidatures').select('statut').eq('id', candidatureB).single()
  noter('…elle reste en base, marquée « retirée »', retiree.statut === 'retiree')
  noter('Après un retrait, on ne recandidate pas à la même annonce', motifDe(await candidatB.db.rpc('soumettre_candidature', { p_reference: publiee.reference })) === 'deja_candidate')

  const immuable = await admin.from('candidatures').update({ message: 'réécrit' }).eq('id', c1).select()
  noter('Le message d’une candidature ne se réécrit pas', Boolean(immuable.error), immuable.error?.code)
  const deplacee = await admin.from('candidatures').update({ annonce_id: publiee2.id }).eq('id', c1).select()
  noter('Une candidature ne change pas d’annonce', Boolean(deplacee.error), deplacee.error?.code)

  // ═══ 5. Concurrence ═════════════════════════════════════════════════════
  titre('5. Cinq envois simultanés')

  const simultanes = await Promise.all(
    Array.from({ length: 5 }, () => candidatA.db.rpc('soumettre_candidature', { p_reference: publiee3.reference })),
  )
  const motifs = simultanes.map(motifDe)
  const { count: deposees } = await admin.from('candidatures').select('id', { count: 'exact', head: true }).eq('annonce_id', publiee3.id).eq('candidat_id', candidatA.id)
  noter('Une seule acceptée, quatre refusées proprement', motifs.filter((m) => m === 'ok').length === 1 && motifs.filter((m) => m === 'deja_candidate').length === 4, motifs.join(', '))
  noter('…et une seule ligne en base', deposees === 1)

  // ═══ 6. Ce que chacun voit ══════════════════════════════════════════════
  titre('6. Ce que chacun voit')

  const { data: mes } = await candidatA.db.rpc('mes_candidatures')
  noter('Le candidat voit ses candidatures, avec l’annonce visée', mes.length === 2 && mes.every((c) => [publiee.reference, publiee3.reference].includes(c.reference)))
  noter('…et rien de celles de B', !mes.some((c) => c.candidature_id === candidatureB))
  noter('La projection du candidat ne contient aucun identifiant interne', JSON.stringify(Object.keys(mes[0])) === JSON.stringify(['candidature_id','statut','message','deposee_le','repondue_le','reference','annonce_type','annonce_ville','annonce_quartier','annonce_loyer','annonce_statut']))

  const { data: recues } = await bailleurA.db.rpc('candidatures_de_mes_annonces')
  noter('Le bailleur voit les candidatures de SES annonces', recues.length === 3 && recues.every((c) => [publiee.reference, publiee3.reference].includes(c.reference)))
  noter('…avec le nom du candidat', recues.some((c) => c.candidat_nom === 'Afi K. Kouassi'))
  noter(
    '…mais ni téléphone, ni email, ni identifiant de candidat',
    JSON.stringify(Object.keys(recues[0])) === JSON.stringify(['candidature_id','reference','statut','message','deposee_le','repondue_le','candidat_nom']) &&
      !JSON.stringify(recues).includes('+229') && !JSON.stringify(recues).includes('@exemple.test') && !JSON.stringify(recues).includes(candidatA.id),
  )
  const { data: recuesB } = await bailleurB.db.rpc('candidatures_de_mes_annonces')
  noter('Le bailleur B ne voit rien de celles de A', (recuesB ?? []).length === 0)
  const { data: filtrees } = await bailleurA.db.rpc('candidatures_de_mes_annonces', { p_reference: chezB.reference })
  noter('…ni en demandant l’annonce d’un autre par sa référence', (filtrees ?? []).length === 0)

  // ═══ 7. L'histoire de l'annonce ═════════════════════════════════════════
  titre('7. Suspension, clôture, suppression')

  await admin.from('annonces').update({ statut: 'suspendue' }).eq('id', publiee.id)
  noter('Annonce suspendue : plus de nouvelle candidature', motifDe(await candidatA.db.rpc('soumettre_candidature', { p_reference: publiee.reference })) === 'annonce_indisponible')
  const { data: apresSuspension } = await bailleurA.db.rpc('candidatures_de_mes_annonces', { p_reference: publiee.reference })
  noter('…mais les candidatures déposées restent lisibles', apresSuspension.length === 2)

  await admin.from('annonces').update({ statut: 'cloturee', motif_cloture: 'louee_ailleurs' }).eq('id', publiee.id)
  const { data: apresCloture } = await bailleurA.db.rpc('candidatures_de_mes_annonces', { p_reference: publiee.reference })
  noter('Annonce clôturée : l’historique est intact', apresCloture.length === 2)
  noter('…et aucune nouvelle candidature n’est possible', motifDe(await candidatB.db.rpc('soumettre_candidature', { p_reference: publiee.reference })) === 'annonce_indisponible')

  // L'annonce ne peut pas disparaître sous ses candidatures.
  await admin.from('annonces').update({ statut: 'brouillon', motif_cloture: null, cloturee_le: null }).eq('id', publiee.id)
  const suppression = await admin.from('annonces').delete().eq('id', publiee.id).select()
  noter('Une annonce qui porte des candidatures ne se supprime pas', Boolean(suppression.error), suppression.error?.code)

  await viderCoffre(candidatB.id)
  const { error: eSuppression } = await admin.auth.admin.deleteUser(candidatB.id)
  comptes.splice(comptes.indexOf(candidatB.id), 1)
  const { data: profilSupprime } = await admin.from('candidats').select('id').eq('id', candidatB.id)
  const { data: candidatureSurvivante } = await admin.from('candidatures').select('candidat_id, statut').eq('id', candidatureB).single()
  noter('Le compte du candidat B est supprimé', !eSuppression && (profilSupprime ?? []).length === 0)
  noter('…sa candidature reste, anonymisée', candidatureSurvivante !== null && candidatureSurvivante.candidat_id === null && candidatureSurvivante.statut === 'retiree')
  const { data: vuesApres } = await bailleurA.db.rpc('candidatures_de_mes_annonces', { p_reference: publiee.reference })
  noter('…le bailleur garde l’historique, sans le nom', vuesApres.length === 2 && vuesApres.some((c) => c.candidat_nom === null))

  await viderCoffre(bailleurB.id)
  const { error: eBailleur } = await admin.auth.admin.deleteUser(bailleurB.id)
  comptes.splice(comptes.indexOf(bailleurB.id), 1)
  noter('Le compte d’un bailleur reste supprimable', !eBailleur, eBailleur?.message)
  const { data: annonceB } = await admin.from('annonces').select('id').eq('id', chezB.id)
  noter('…ses annonces partent avec lui, et les candidatures qui les visaient', (annonceB ?? []).length === 0)

  // ═══ 8. Étanchéité de la vitrine ════════════════════════════════════════
  titre('8. Rien de tout cela n’est public')

  const publiques = ['annonces_publiees', 'annonce_publiee', 'annonces_recherche', 'profil_public_bailleur', 'photos_publiees', 'annonces_publiees_sitemap', 'lieux_publies']
  const reponses = {
    annonces_publiees: await visiteur.rpc('annonces_publiees', { p_limite: 48 }),
    annonce_publiee: await visiteur.rpc('annonce_publiee', { p_reference: publiee3.reference }),
    // `chezB` a disparu avec son bailleur : on interroge ce qui reste.

    annonces_recherche: await visiteur.rpc('annonces_recherche', { p_limite: 48 }),
    profil_public_bailleur: await visiteur.rpc('profil_public_bailleur', { p_reference: publiee3.reference }),
    photos_publiees: await visiteur.rpc('photos_publiees', { p_reference: publiee3.reference }),
    annonces_publiees_sitemap: await visiteur.rpc('annonces_publiees_sitemap'),
    lieux_publies: await visiteur.rpc('lieux_publies'),
  }
  const texte = JSON.stringify(reponses)
  noter('Aucune fonction publique ne laisse filtrer une candidature', !/candidat|candidature|Afi |Yao /i.test(texte))
  noter('…ni un identifiant de candidat', !texte.includes(candidatA.id) && !texte.includes(candidatB.id))
  noter('Les fonctions publiques répondent toujours', publiques.every((f) => !reponses[f].error))
  for (const fonction of ['soumettre_candidature', 'mes_candidatures', 'candidatures_de_mes_annonces', 'retirer_candidature', 'repondre_candidature', 'enregistrer_profil_candidat']) {
    const r = await visiteur.rpc(fonction, fonction === 'soumettre_candidature' ? { p_reference: publiee3.reference } : fonction === 'retirer_candidature' ? { p_candidature_id: c1 } : fonction === 'repondre_candidature' ? { p_candidature_id: c1, p_statut: 'acceptee' } : fonction === 'enregistrer_profil_candidat' ? { p_nom: 'X Y', p_telephone: '+22997000009' } : {})
    noter(`Un visiteur n’exécute pas \`${fonction}\``, Boolean(r.error), r.error?.code)
  }

  // ─── Ménage ────────────────────────────────────────────────────────────
  for (const id of comptes) {
    await viderCoffre(id)
    await admin.from('candidatures').delete().eq('candidat_id', id)
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) console.log(`  (ménage) compte ${id} non supprimé : ${error.message}`)
  }
  await admin.from('candidatures').delete().is('candidat_id', null)

  const reussies = etapes.filter(Boolean).length
  console.log(`\n${reussies}/${etapes.length} vérifications passent\n`)
  process.exit(reussies === etapes.length ? 0 : 1)
})().catch(async (e) => {
  console.error(e)
  // Ménage garanti : même quand le corps lève, les comptes créés partent,
  // pour qu'un banc interrompu ne laisse pas de fausse régression derrière lui.
  await rangerComptes(admin, comptes)
  process.exit(1)
})
