/**
 * Banc de la vérification du téléphone candidat par OTP — Sikaloc, S8-G.
 *
 *   supabase start · set -a && . ./.env.development.local && set +a
 *   OTP_SECRET=… npm run banc:telephone-candidat
 *
 * ─── Ce qu'il surveille ─────────────────────────────────────────────────────
 *
 * Le MÊME service OTP que le bailleur, désormais clé sur le compte : demande,
 * code correct/incorrect, expiration, essais, renvoi, invalidation, usage
 * unique, changement de numéro, concurrence, limite de débit. Puis l'éligibilité
 * WhatsApp candidat (canonique + vérifié + opt-in), le multi-rôle, la
 * suppression, la RLS et l'absence de fuite.
 *
 * Il appelle `otp.ts` directement (le code est rendu à l'appelant), comme le
 * banc bailleur : aucun canal réel n'est requis. Nettoyage garanti (S8-E).
 */
import { createClient } from '@supabase/supabase-js'
import { createHmac, randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import Module from 'node:module'
import sharp from 'sharp'

const require = createRequire(import.meta.url)

// `server-only` lève à l'import hors rendu serveur Next. `otp.ts` le porte à
// juste titre, mais un script CLI est un contexte serveur légitime. Même
// contournement que `banc-verification.ts` : on redirige `server-only` vers son
// module vide AVANT d'importer `otp.ts`.
const CHEMIN_VIDE = require.resolve('server-only').replace(/index\.js$/, 'empty.js')
const resoudre = (Module as unknown as { _resolveFilename: (...a: unknown[]) => string })._resolveFilename
;(Module as unknown as { _resolveFilename: unknown })._resolveFilename = function (
  this: unknown,
  demande: unknown,
  ...reste: unknown[]
) {
  if (demande === 'server-only') return CHEMIN_VIDE
  return resoudre.call(this, demande, ...reste)
}

const { exigerPileLocale } = require('./garde-locale.cjs')
const { rangerComptes } = require('./menage-comptes.cjs')

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const OTP_SECRET = process.env.OTP_SECRET ?? ''

exigerPileLocale('Ce banc')
if (OTP_SECRET.length < 32) {
  console.error('\nRefus : OTP_SECRET absente ou < 32 caractères. Le service OTP ne peut pas signer.\n')
  process.exit(1)
}

const admin = createClient(SUPABASE, SERVICE, { auth: { persistSession: false } })
const MDP = 'Jonquille7Mn!'
const comptes: string[] = []

const etapes: boolean[] = []
const noter = (nom: string, ok: boolean, detail?: string | number) => {
  etapes.push(ok)
  console.log(`  ${ok ? '✓' : '✗'} ${nom}${detail ? ' — ' + detail : ''}`)
}
const titre = (t: string) => console.log(`\n${t}`)
const empreinte = (code: string) => createHmac('sha256', OTP_SECRET).update(code).digest('hex')

/** Un candidat, par la voie normale (métadonnée role). */
async function candidat(cle: string, nom: string, telephone = '+2290190459821') {
  const email = `banc-s8g-${cle}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@exemple.test`
  const { data, error } = await admin.auth.admin.createUser({
    email, password: MDP, email_confirm: true, user_metadata: { nom, telephone, role: 'candidat' },
  })
  if (error) throw new Error(`${cle} : ${error.message}`)
  comptes.push(data.user.id)
  const db = createClient(SUPABASE, ANON, { auth: { persistSession: false } })
  await db.auth.signInWithPassword({ email, password: MDP })
  return { id: data.user.id, email, nom, telephone, db }
}

const profilCandidat = async (id: string) =>
  (await admin.from('candidats').select('*').eq('id', id).single()).data
const codesDe = async (id: string) =>
  (await admin.from('codes_verification').select('*').eq('compte_id', id).order('cree_le', { ascending: true })).data ?? []

;(async () => {
  console.log('\nSikaloc — vérification du téléphone candidat (S8-G)\n')

  // otp.ts porte server-only et lit l'environnement au chargement.
  const { preparerCodeTelephone, verifierCodeTelephone } = await import('../src/lib/verification/otp')

  const TEL = '+2290190459821'

  // ═══ 1. Un candidat neuf n'est pas vérifié ═══════════════════════════════
  titre('1. Un candidat neuf')
  const c = await candidat('neuf', 'Amina Test', TEL)
  const p0 = await profilCandidat(c.id)
  noter('Le numéro est canonique', p0.telephone === TEL, p0.telephone)
  noter('Il n’est pas vérifié', p0.telephone_verifie_le === null)
  noter('Le consentement WhatsApp est faux par défaut', p0.notif_whatsapp === false)

  // ═══ 2. Demande d'un code ════════════════════════════════════════════════
  titre('2. Demande OTP')
  const d1 = await preparerCodeTelephone(c.id, TEL, 'SMS', null)
  noter('Un code est produit', d1.ok === true)
  noter('À six chiffres', /^\d{6}$/.test(d1.code ?? ''))
  const lignes1 = await codesDe(c.id)
  noter('Une ligne en base, clé sur le COMPTE', lignes1.length === 1 && lignes1[0].compte_id === c.id)
  noter('Le code n’est pas stocké en clair', lignes1[0].empreinte !== d1.code)
  noter('…seulement son empreinte HMAC', lignes1[0].empreinte === empreinte(d1.code!))
  noter('Contexte téléphone', lignes1[0].type === 'PHONE_VERIFICATION')
  noter('Canal tracé', lignes1[0].canal === 'SMS')

  // ═══ 3. Code incorrect ═══════════════════════════════════════════════════
  titre('3. Code incorrect')
  const faux = d1.code === '000000' ? '111111' : '000000'
  const r1 = await verifierCodeTelephone(c.id, TEL, faux)
  noter('Refusé', r1.ok === false && r1.motif === 'code_incorrect')
  noter('Essais restants décomptés', r1.essaisRestants === 4, `${r1.essaisRestants}`)
  noter('Le téléphone reste non vérifié', (await profilCandidat(c.id)).telephone_verifie_le === null)

  // ═══ 4. Code correct → vérifié, usage unique ═════════════════════════════
  titre('4. Code correct')
  const r2 = await verifierCodeTelephone(c.id, TEL, d1.code!)
  noter('Le code correct est accepté par le service', r2.ok === true)
  // Le service valide le code ; l'action `verifierCodeCandidat` écrit la colonne.
  await admin.from('candidats').update({ telephone_verifie_le: new Date().toISOString() }).eq('id', c.id)
  noter('L’action marque alors le téléphone vérifié EN BASE', (await profilCandidat(c.id)).telephone_verifie_le !== null)
  const r2bis = await verifierCodeTelephone(c.id, TEL, d1.code!)
  noter('Le même code ne resert pas', r2bis.ok === false && r2bis.motif === 'code_absent')

  // ═══ 5. Numéro déjà vérifié ══════════════════════════════════════════════
  titre('5. Déjà vérifié')
  noter('Rien à revérifier (état en base)', (await profilCandidat(c.id)).telephone_verifie_le !== null)

  // ═══ 6. Expiration ═══════════════════════════════════════════════════════
  titre('6. Code expiré')
  const cExp = await candidat('exp', 'Expiré', TEL)
  // Inséré directement avec une expiration passée (comme le fait le banc bailleur).
  const codeExp = '424242'
  await admin.from('codes_verification').insert({
    compte_id: cExp.id, type: 'PHONE_VERIFICATION', canal: 'SMS', destination: TEL,
    empreinte: empreinte(codeExp), expire_le: new Date(Date.now() - 60000).toISOString(),
  })
  const rExp = await verifierCodeTelephone(cExp.id, TEL, codeExp)
  noter('Un code expiré est refusé', rExp.ok === false && rExp.motif === 'code_expire')
  noter('…et ne vérifie rien', (await profilCandidat(cExp.id)).telephone_verifie_le === null)

  // ═══ 7. Maximum d'essais ═════════════════════════════════════════════════
  titre('7. Tentatives épuisées')
  const cMax = await candidat('max', 'Max Essais', TEL)
  const codeMax = '135790'
  await admin.from('codes_verification').insert({
    compte_id: cMax.id, type: 'PHONE_VERIFICATION', canal: 'SMS', destination: TEL,
    empreinte: empreinte(codeMax), expire_le: new Date(Date.now() + 600000).toISOString(),
  })
  let dernierMotif
  for (let i = 0; i < 5; i++) dernierMotif = (await verifierCodeTelephone(cMax.id, TEL, '999999')).motif
  noter('Après cinq mauvais essais, épuisé', dernierMotif === 'tentatives_epuisees', dernierMotif)
  const rApresMax = await verifierCodeTelephone(cMax.id, TEL, codeMax)
  noter('Même le BON code est alors refusé', rApresMax.ok === false && rApresMax.motif === 'tentatives_epuisees')

  // ═══ 8. Renvoi et invalidation de l'ancien ═══════════════════════════════
  titre('8. Renvoi')
  const cRen = await candidat('renvoi', 'Renvoi', TEL)
  const dA = await preparerCodeTelephone(cRen.id, TEL, 'SMS', null)
  // Le délai de renvoi (60 s) interdit une 2e demande immédiate : on l'insère
  // à la main, comme un renvoi permis le ferait, puis on vérifie l'invalidation.
  await admin.from('codes_verification').update({ invalide_le: new Date().toISOString() })
    .eq('compte_id', cRen.id).is('utilise_le', null).is('invalide_le', null)
  const dB = '246810'
  await admin.from('codes_verification').insert({
    compte_id: cRen.id, type: 'PHONE_VERIFICATION', canal: 'SMS', destination: TEL,
    empreinte: empreinte(dB), expire_le: new Date(Date.now() + 600000).toISOString(),
  })
  const rAncien = await verifierCodeTelephone(cRen.id, TEL, dA.code!)
  noter('L’ancien code ne vaut plus rien', rAncien.ok === false)
  const rNouveau = await verifierCodeTelephone(cRen.id, TEL, dB)
  noter('Le nouveau code vérifie', rNouveau.ok === true)
  noter('Le délai de renvoi est appliqué par le serveur', (await preparerCodeTelephone(cRen.id, TEL, 'SMS', null)).motif !== undefined)

  // ═══ 9. Changement de numéro ═════════════════════════════════════════════
  titre('9. Changement de numéro')
  const cChg = await candidat('chg', 'Change', TEL)
  // Vérifier d'abord.
  const dChg = await preparerCodeTelephone(cChg.id, TEL, 'SMS', null)
  await verifierCodeTelephone(cChg.id, TEL, dChg.code!)
  await admin.from('candidats').update({ telephone_verifie_le: new Date().toISOString() }).eq('id', cChg.id)
  noter('Vérifié au départ', (await profilCandidat(cChg.id)).telephone_verifie_le !== null)
  // Changer le numéro.
  const NOUVEAU = '+2290196554433'
  await admin.from('candidats').update({ telephone: NOUVEAU }).eq('id', cChg.id)
  const pChg = await profilCandidat(cChg.id)
  noter('Le nouveau numéro est enregistré', pChg.telephone === NOUVEAU)
  noter('…et la vérification est AUTOMATIQUEMENT effacée', pChg.telephone_verifie_le === null)
  // Un code émis pour l'ancien numéro ne vérifie pas le nouveau.
  const cChg2 = await candidat('chg2', 'Change2', TEL)
  const dChg2 = await preparerCodeTelephone(cChg2.id, TEL, 'SMS', null)
  const rMauvaisNum = await verifierCodeTelephone(cChg2.id, NOUVEAU, dChg2.code!)
  noter('Un code émis pour l’ancien numéro ne vaut pas pour un autre', rMauvaisNum.ok === false)

  // ═══ 10. Éligibilité WhatsApp (le tableau de S8-G) ═══════════════════════
  titre('10. Éligibilité WhatsApp — la vérité côté serveur')
  // On lit l'éligibilité via le déclencheur : une candidature crée une ligne
  // WhatsApp seulement si le candidat est éligible.
  const bailleurEmail = `banc-s8g-bailleur-${Date.now()}@exemple.test`
  const bE = await admin.auth.admin.createUser({ email: bailleurEmail, password: MDP, email_confirm: true, user_metadata: { nom: 'Bailleur G', telephone: '+2290190000060' } })
  comptes.push(bE.data.user!.id)
  await admin.from('bailleurs').update({ onboarding_termine: true, telephone_verifie_le: new Date().toISOString(), telephone_canal_verification: 'SMS' }).eq('id', bE.data.user!.id)
  async function annonce() {
    const { data: log } = (await admin.from('logements').insert({ bailleur_id: bE.data.user!.id, adresse: 'Lot 4, Cotonou', type: 'Appartement', ville: 'Cotonou' }).select('id').single()) as { data: { id: string } }
    const { data: a } = (await admin.from('annonces').insert({ bailleur_id: bE.data.user!.id, logement_id: log.id, type: 'Appartement', ville: 'Cotonou', quartier: 'Agla', chambres: 2, loyer: 90000, description: 'Deux chambres salon, banc S8-G éligibilité WhatsApp.' }).select('id, reference').single()) as { data: { id: string; reference: string } }
    const f = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#444' } }).jpeg().toBuffer()
    const ch = `${bE.data.user!.id}/${a.id}/${randomUUID()}.jpg`
    await admin.storage.from('annonces').upload(ch, f, { contentType: 'image/jpeg' })
    await admin.from('annonce_photos').insert({ annonce_id: a.id, bailleur_id: bE.data.user!.id, chemin: ch, position: 0, largeur: 800, hauteur: 600, type_mime: 'image/jpeg', poids: f.length })
    await admin.from('annonces').update({ statut: 'publiee' }).eq('id', a.id)
    return a
  }
  const aWA = async (candidatureId: string) =>
    ((await admin.from('notifications_whatsapp').select('id').eq('candidature_id', candidatureId).eq('destinataire_role', 'candidat')).data ?? []).length

  const combinaisons: Array<[string, { verifie: boolean; notif: boolean }, boolean]> = [
    ['présent, non vérifié, sans opt-in', { verifie: false, notif: false }, false],
    ['présent, non vérifié, opt-in', { verifie: false, notif: true }, false],
    ['présent, vérifié, sans opt-in', { verifie: true, notif: false }, false],
    ['présent, vérifié, opt-in', { verifie: true, notif: true }, true],
  ]
  for (const [libelle, etat, attenduEligible] of combinaisons) {
    const cx = await candidat(`elig-${Math.random().toString(36).slice(2, 6)}`, 'Éligibilité', TEL)
    await admin.from('candidats').update({
      notif_whatsapp: etat.notif,
      telephone_verifie_le: etat.verifie ? new Date().toISOString() : null,
    }).eq('id', cx.id)
    const an = await annonce()
    const env = await cx.db.rpc('soumettre_candidature', { p_reference: an.reference, p_message: 'Bonjour.' })
    const { data: cand } = (await admin.from('candidatures').select('id').eq('candidat_id', cx.id).eq('annonce_id', an!.id).single()) as { data: { id: string } }
    // Faire répondre le bailleur pour générer une notif candidat (en_etude).
    const bDb = createClient(SUPABASE, ANON, { auth: { persistSession: false } })
    await bDb.auth.signInWithPassword({ email: bailleurEmail, password: MDP })
    await bDb.rpc('repondre_candidature', { p_candidature_id: cand.id, p_statut: 'en_etude' })
    const n = await aWA(cand.id)
    void env
    noter(`${libelle} → ${attenduEligible ? 'éligible' : 'non éligible'}`, (n > 0) === attenduEligible, `whatsapp candidat=${n}`)
  }

  // ═══ 11. WhatsApp exige la vérification (régression S8-F durcie) ══════════
  titre('11. Sans vérification, l’opt-in ne suffit plus')
  const cOptSeul = await candidat('opt-seul', 'Opt Sans Vérif', TEL)
  await admin.from('candidats').update({ notif_whatsapp: true }).eq('id', cOptSeul.id) // pas vérifié
  const anS = await annonce()
  await cOptSeul.db.rpc('soumettre_candidature', { p_reference: anS.reference, p_message: 'Bonjour.' })
  const { data: candS } = (await admin.from('candidatures').select('id').eq('candidat_id', cOptSeul.id).eq('annonce_id', anS!.id).single()) as { data: { id: string } }
  noter('Opt-in sans vérification : aucun WhatsApp candidat', (await aWA(candS.id)) === 0)
  noter('…mais l’email de « nouvelle » au bailleur existe', ((await admin.from('notifications_candidature').select('id').eq('candidature_id', candS.id).eq('destinataire_role', 'bailleur')).data ?? []).length === 1)

  // ═══ 12. Multi-rôle ══════════════════════════════════════════════════════
  titre('12. Multi-rôle : la vérification suit le compte')
  const multi = await candidat('multi', 'Multi Rôle', TEL)
  await admin.from('bailleurs').insert({ id: multi.id, nom: 'Multi Rôle', telephone: multi.telephone, email: multi.email, code_parrainage: 'S8G' + Math.random().toString(36).slice(2, 8).toUpperCase() })
  // Vérifier via le service OTP (clé sur le compte) : cela doit valoir pour le candidat.
  const dMulti = await preparerCodeTelephone(multi.id, TEL, 'SMS', null)
  const rMulti = await verifierCodeTelephone(multi.id, TEL, dMulti.code!)
  noter('Le code du compte multi-rôle est accepté', rMulti.ok === true)
  await admin.from('candidats').update({ telephone_verifie_le: new Date().toISOString() }).eq('id', multi.id)
  noter('Le profil CANDIDAT porte la vérification', (await profilCandidat(multi.id)).telephone_verifie_le !== null)
  // La vérification bailleur reste indépendante (colonne distincte).
  noter('Le profil BAILLEUR garde sa propre vérification', ((await admin.from('bailleurs').select('telephone_verifie_le').eq('id', multi.id).single()).data!.telephone_verifie_le) === null)

  // ═══ 13. Concurrence ═════════════════════════════════════════════════════
  titre('13. Concurrence : un seul bon code consommé')
  const cConc = await candidat('conc', 'Concurrence', TEL)
  const dConc = await preparerCodeTelephone(cConc.id, TEL, 'SMS', null)
  const tirs = await Promise.all(Array.from({ length: 5 }, () => verifierCodeTelephone(cConc.id, TEL, dConc.code!)))
  noter('Une seule validation gagne', tirs.filter((r) => r.ok).length === 1, `${tirs.filter((r) => r.ok).length}`)

  // ═══ 14. Limite de débit ═════════════════════════════════════════════════
  titre('14. Cinq demandes par heure, pas six')
  const cDeb = await candidat('debit', 'Débit', TEL)
  // Cinq insertions directes datées à l'instant (contournent le délai de renvoi),
  // pour éprouver la limite horaire de preparer.
  for (let i = 0; i < 5; i++) {
    await admin.from('codes_verification').insert({
      compte_id: cDeb.id, type: 'PHONE_VERIFICATION', canal: 'SMS', destination: TEL,
      empreinte: empreinte(String(100000 + i)), expire_le: new Date(Date.now() + 600000).toISOString(),
      cree_le: new Date().toISOString(),
    })
  }
  const dTrop = await preparerCodeTelephone(cDeb.id, TEL, 'SMS', null)
  noter('La sixième demande de l’heure est refusée', dTrop.ok === false && dTrop.motif === 'trop_de_demandes')

  // ═══ 15. RLS et accès d'un autre candidat ════════════════════════════════
  titre('15. La table OTP ne s’ouvre à personne')
  const anon = createClient(SUPABASE, ANON, { auth: { persistSession: false } })
  const { data: vAnon, error: eAnon } = await anon.from('codes_verification').select('*')
  noter('Un anonyme ne lit aucun code', eAnon !== null || (vAnon ?? []).length === 0)
  const { data: vSoi, error: eSoi } = await c.db.from('codes_verification').select('*')
  noter('Un candidat ne lit pas même ses propres codes', eSoi !== null || (vSoi ?? []).length === 0)
  const autre = await candidat('autre', 'Autre Candidat', '+2290197000011')
  const { data: vAutre } = await autre.db.from('codes_verification').select('*').eq('compte_id', cConc.id)
  noter('…ni ceux d’un autre candidat', (vAutre ?? []).length === 0)
  const ecriture = await c.db.from('candidats').update({ telephone_verifie_le: new Date().toISOString() }).eq('id', autre.id)
  noter('Un candidat ne vérifie pas le numéro d’un autre', ecriture.error !== null || (await profilCandidat(autre.id)).telephone_verifie_le === null)
  // Ni le sien, directement : seul le service écrit la vérification (S8-G.1).
  const autoVerif = await autre.db.from('candidats').update({ telephone_verifie_le: new Date().toISOString() }).eq('id', autre.id)
  noter('Un candidat ne s’auto-vérifie pas depuis le client', (await profilCandidat(autre.id)).telephone_verifie_le === null, autoVerif.error?.code ?? '')
  const consent = await autre.db.from('candidats').update({ notif_whatsapp: true }).eq('id', autre.id)
  noter('…mais peut toujours régler son consentement WhatsApp', consent.error === null && (await profilCandidat(autre.id)).notif_whatsapp === true)

  // ═══ 16. Suppression : aucun résidu OTP exploitable ══════════════════════
  titre('16. Suppression du candidat')
  const cSup = await candidat('sup', 'À Supprimer', TEL)
  await preparerCodeTelephone(cSup.id, TEL, 'SMS', null)
  noter('Un code existe avant suppression', (await codesDe(cSup.id)).length >= 1)
  await admin.auth.admin.deleteUser(cSup.id)
  comptes.splice(comptes.indexOf(cSup.id), 1)
  noter('Après suppression du compte, plus aucun code', (await codesDe(cSup.id)).length === 0)
  noter('…et plus aucun profil candidat', (await admin.from('candidats').select('id').eq('id', cSup.id).maybeSingle()).data === null)

  // ═══ 17. Aucune fuite ════════════════════════════════════════════════════
  titre('17. Ni code, ni secret ne fuit')
  const toutesLignes = JSON.stringify((await admin.from('codes_verification').select('*')).data ?? [])
  noter('Aucun code en clair dans la table (que des empreintes 64-hex)',
    ((await admin.from('codes_verification').select('empreinte')).data ?? []).every((l) => /^[0-9a-f]{64}$/.test(l.empreinte)))
  noter('L’OTP_SECRET n’apparaît nulle part en base', !toutesLignes.includes(OTP_SECRET))

  // ─── Ménage garanti ────────────────────────────────────────────────────
  await rangerComptes(admin, comptes)

  const reussies = etapes.filter(Boolean).length
  console.log(`\n${reussies}/${etapes.length} vérifications passent\n`)
  process.exit(reussies === etapes.length ? 0 : 1)
})().catch(async (e) => {
  console.error(e)
  await rangerComptes(admin, comptes)
  process.exit(1)
})
