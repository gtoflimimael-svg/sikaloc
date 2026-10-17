/**
 * Banc S8-G.1 — le changement de numéro bailleur efface sa vérification.
 *
 *   supabase start · set -a && . ./.env.development.local && set +a
 *   OTP_SECRET=… npm run banc:telephone-bailleur
 *
 * ─── Ce qu'il surveille ─────────────────────────────────────────────────────
 *
 *   1. Un bailleur non vérifié qui change de numéro reste non vérifié.
 *   2. Un bailleur vérifié qui change de numéro PERD sa vérification (et son canal).
 *   3. Réécrire le MÊME numéro (autre graphie) ne réinitialise rien.
 *   4. Après changement, un nouvel OTP est possible et vérifie le nouveau numéro ;
 *      un ancien code ne vaut pas pour le nouveau numéro.
 *   5. Un bailleur ne peut pas s'attribuer `telephone_verifie_le` depuis le client.
 *   6. Ni le candidat, ni un autre bailleur ne sont impactés.
 *   7. Suppression du compte : aucun résidu.
 *
 * Il appelle le service OTP réel (`otp.ts`) via le shim `server-only`, comme
 * `banc-verification.ts`. Nettoyage garanti (S8-E).
 */
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'node:crypto'
import { createRequire } from 'node:module'
import Module from 'node:module'

const require = createRequire(import.meta.url)

// `server-only` lève hors rendu serveur : on le redirige vers son module vide
// AVANT d'importer `otp.ts`, comme `banc-verification.ts`.
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
  console.error('\nRefus : OTP_SECRET absente ou < 32 caractères.\n')
  process.exit(1)
}

const admin = createClient(SUPABASE, SERVICE, { auth: { persistSession: false } })
const MDP = 'Jonquille7Mn!'
const comptes: string[] = []

const etapes: boolean[] = []
const noter = (nom: string, ok: boolean, detail?: string) => {
  etapes.push(ok)
  console.log(`  ${ok ? '✓' : '✗'} ${nom}${detail ? ' — ' + detail : ''}`)
}
const titre = (t: string) => console.log(`\n${t}`)
const empreinte = (code: string) => createHmac('sha256', OTP_SECRET).update(code).digest('hex')

async function bailleur(cle: string, telephone = '+2290190459821') {
  const email = `banc-s8g1-${cle}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@exemple.test`
  const { data, error } = await admin.auth.admin.createUser({
    email, password: MDP, email_confirm: true, user_metadata: { nom: 'Bailleur Test', telephone },
  })
  if (error) throw new Error(`${cle} : ${error.message}`)
  comptes.push(data.user!.id)
  await admin.from('bailleurs').update({ onboarding_termine: true }).eq('id', data.user!.id)
  const db = createClient(SUPABASE, ANON, { auth: { persistSession: false } })
  await db.auth.signInWithPassword({ email, password: MDP })
  return { id: data.user!.id, email, telephone, db }
}

async function candidat(cle: string, telephone = '+2290197000022') {
  const email = `banc-s8g1-${cle}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@exemple.test`
  const { data, error } = await admin.auth.admin.createUser({
    email, password: MDP, email_confirm: true, user_metadata: { nom: 'Candidat Test', telephone, role: 'candidat' },
  })
  if (error) throw new Error(`${cle} : ${error.message}`)
  comptes.push(data.user!.id)
  return { id: data.user!.id, email, telephone }
}

const profilBailleur = async (id: string) =>
  (await admin.from('bailleurs').select('telephone, telephone_verifie_le, telephone_canal_verification').eq('id', id).single()).data!

/** Vérifie un bailleur « comme l'action » : valide l'OTP, puis écrit l'état. */
async function verifier(
  id: string,
  telephone: string,
  prep: (id: string, tel: string, canal: 'SMS' | 'WHATSAPP', ip: string | null) => Promise<{ ok: boolean; code?: string }>,
  verif: (id: string, tel: string, code: string) => Promise<{ ok: boolean; canal?: string }>,
) {
  const d = await prep(id, telephone, 'SMS', null)
  const v = await verif(id, telephone, d.code!)
  if (v.ok) {
    await admin.from('bailleurs').update({
      telephone_verifie_le: new Date().toISOString(),
      telephone_canal_verification: v.canal ?? 'SMS',
    }).eq('id', id)
  }
  return { demande: d, verdict: v }
}

;(async () => {
  console.log('\nSikaloc — réinitialisation vérif téléphone bailleur (S8-G.1)\n')

  const { preparerCodeTelephone, verifierCodeTelephone } = await import('../src/lib/verification/otp')
  const TEL_A = '+2290190459821'
  const TEL_B = '+2290196554433'

  // ═══ 1. Non vérifié → changement → reste non vérifié ═════════════════════
  titre('1. Un bailleur non vérifié qui change de numéro')
  const b1 = await bailleur('nonverif', TEL_A)
  const p1a = await profilBailleur(b1.id)
  noter('Non vérifié au départ', p1a.telephone_verifie_le === null)
  await admin.from('bailleurs').update({ telephone: TEL_B }).eq('id', b1.id)
  const p1b = await profilBailleur(b1.id)
  noter('Le nouveau numéro est enregistré', p1b.telephone === TEL_B)
  noter('…et il reste non vérifié', p1b.telephone_verifie_le === null)

  // ═══ 2. Vérifié → changement → vérification supprimée ════════════════════
  titre('2. Un bailleur vérifié qui change de numéro')
  const b2 = await bailleur('verif', TEL_A)
  await verifier(b2.id, TEL_A, preparerCodeTelephone, verifierCodeTelephone)
  const p2a = await profilBailleur(b2.id)
  noter('Vérifié au départ', p2a.telephone_verifie_le !== null && p2a.telephone_canal_verification === 'SMS')
  await admin.from('bailleurs').update({ telephone: TEL_B }).eq('id', b2.id)
  const p2b = await profilBailleur(b2.id)
  noter('Après changement, la vérification est effacée', p2b.telephone_verifie_le === null)
  noter('…et le canal aussi (contrainte de cohérence respectée)', p2b.telephone_canal_verification === null)

  // ═══ 3. Vérifié → même numéro → vérification conservée ═══════════════════
  titre('3. Réécrire le même numéro ne réinitialise rien')
  const b3 = await bailleur('meme', TEL_A)
  await verifier(b3.id, TEL_A, preparerCodeTelephone, verifierCodeTelephone)
  // Même numéro exact
  await admin.from('bailleurs').update({ telephone: TEL_A }).eq('id', b3.id)
  noter('Même numéro exact : vérification conservée', (await profilBailleur(b3.id)).telephone_verifie_le !== null)
  // Même numéro, autre graphie (la canonisation le ramène à TEL_A)
  await admin.from('bailleurs').update({ telephone: '01 90 45 98 21' }).eq('id', b3.id)
  const p3 = await profilBailleur(b3.id)
  noter('Autre graphie du même numéro : toujours vérifié', p3.telephone_verifie_le !== null)
  noter('…et le numéro reste canonique', p3.telephone === TEL_A)
  // Modifier le nom seul ne touche pas la vérification
  await admin.from('bailleurs').update({ nom: 'Nom Modifié' }).eq('id', b3.id)
  noter('Modifier le nom ne réinitialise pas', (await profilBailleur(b3.id)).telephone_verifie_le !== null)

  // ═══ 4. Après changement : nouvel OTP possible, ancien inutilisable ══════
  titre('4. Le nouveau numéro se vérifie, l’ancien code non')
  const b4 = await bailleur('reverif', TEL_A)
  const dAncien = await preparerCodeTelephone(b4.id, TEL_A, 'SMS', null)
  // Le bailleur change de numéro AVANT d'utiliser le code (émis pour TEL_A).
  await admin.from('bailleurs').update({ telephone: TEL_B }).eq('id', b4.id)
  const rAncien = await verifierCodeTelephone(b4.id, TEL_B, dAncien.code!)
  noter('Un code émis pour l’ancien numéro ne vérifie pas le nouveau', rAncien.ok === false)
  noter('…le nouveau reste non vérifié', (await profilBailleur(b4.id)).telephone_verifie_le === null)
  // Un nouveau code pour TEL_B fonctionne. Le délai de renvoi (60 s) interdit
  // un second appel à `preparerCodeTelephone` dans la minute : on insère le
  // code directement, comme le fait un renvoi permis, puis on valide.
  const codeNeuf = '778899'
  await admin.from('codes_verification').update({ invalide_le: new Date().toISOString() })
    .eq('compte_id', b4.id).is('utilise_le', null).is('invalide_le', null)
  await admin.from('codes_verification').insert({
    compte_id: b4.id, type: 'PHONE_VERIFICATION', canal: 'SMS', destination: TEL_B,
    empreinte: empreinte(codeNeuf), expire_le: new Date(Date.now() + 600000).toISOString(),
  })
  const vNeuf = await verifierCodeTelephone(b4.id, TEL_B, codeNeuf)
  if (vNeuf.ok) {
    await admin.from('bailleurs').update({ telephone_verifie_le: new Date().toISOString(), telephone_canal_verification: 'SMS' }).eq('id', b4.id)
  }
  noter('Un nouveau code vérifie le nouveau numéro', vNeuf.ok === true)
  noter('…et l’état passe à vérifié', (await profilBailleur(b4.id)).telephone_verifie_le !== null)

  // ═══ 5. Un client ne s'attribue pas la vérification ══════════════════════
  titre('5. Sécurité — écriture directe refusée')
  const b5 = await bailleur('secu', TEL_A)
  // Le bailleur, avec sa session (RLS authenticated), tente d'écrire l'état.
  const ecriture = await b5.db.from('bailleurs')
    .update({ telephone_verifie_le: new Date().toISOString(), telephone_canal_verification: 'SMS' })
    .eq('id', b5.id)
  const apres = await profilBailleur(b5.id)
  noter('La vérification directe depuis le client est refusée',
    apres.telephone_verifie_le === null,
    ecriture.error?.code ?? 'sans erreur mais sans écriture')
  // Et s'il change son numéro depuis le client, la règle DB s'applique quand même.
  await b5.db.from('bailleurs').update({ telephone: TEL_B }).eq('id', b5.id)
  noter('Un changement de numéro depuis le client reste non vérifié', (await profilBailleur(b5.id)).telephone_verifie_le === null)

  // ═══ 6. Aucun impact candidat ni sur un autre bailleur ══════════════════
  titre('6. Isolation — candidat et voisin intacts')
  const cand = await candidat('cand', '+2290197000022')
  await admin.from('candidats').update({ telephone_verifie_le: new Date().toISOString() }).eq('id', cand.id)
  const voisin = await bailleur('voisin', '+2290190000033')
  await verifier(voisin.id, '+2290190000033', preparerCodeTelephone, verifierCodeTelephone)
  // On change le numéro d'un bailleur quelconque…
  await admin.from('bailleurs').update({ telephone: '+2290190000044' }).eq('id', voisin.id)
  noter('Le voisin ré-évalué perd la sienne, isolément', (await profilBailleur(voisin.id)).telephone_verifie_le === null)
  const candApres = (await admin.from('candidats').select('telephone_verifie_le').eq('id', cand.id).single()).data!
  noter('Le candidat n’est pas impacté par le trigger bailleur', candApres.telephone_verifie_le !== null)
  // Changer le numéro du candidat déclenche SON trigger, pas celui du bailleur.
  await admin.from('candidats').update({ telephone: '+2290197000099' }).eq('id', cand.id)
  noter('Le candidat garde son propre comportement (S8-G)', (await admin.from('candidats').select('telephone_verifie_le').eq('id', cand.id).single()).data!.telephone_verifie_le === null)

  // ═══ 7. Compte multi-rôle ════════════════════════════════════════════════
  titre('7. Multi-rôle — les deux vérifications sont distinctes')
  const multi = await bailleur('multi', TEL_A)
  await admin.from('candidats').insert({ id: multi.id, nom: 'Multi', telephone: '+2290197000055', telephone_verifie_le: new Date().toISOString() })
  await verifier(multi.id, TEL_A, preparerCodeTelephone, verifierCodeTelephone)
  noter('Bailleur vérifié', (await profilBailleur(multi.id)).telephone_verifie_le !== null)
  // Changer le numéro BAILLEUR ne touche pas la vérif CANDIDAT.
  await admin.from('bailleurs').update({ telephone: TEL_B }).eq('id', multi.id)
  noter('Changer le numéro bailleur efface la vérif bailleur', (await profilBailleur(multi.id)).telephone_verifie_le === null)
  noter('…mais laisse la vérif candidat intacte', (await admin.from('candidats').select('telephone_verifie_le').eq('id', multi.id).single()).data!.telephone_verifie_le !== null)

  // ═══ 8. Concurrence ══════════════════════════════════════════════════════
  titre('8. Concurrence — changements simultanés')
  const bc = await bailleur('conc', TEL_A)
  await verifier(bc.id, TEL_A, preparerCodeTelephone, verifierCodeTelephone)
  await Promise.all([
    admin.from('bailleurs').update({ telephone: TEL_B }).eq('id', bc.id),
    admin.from('bailleurs').update({ telephone: '+2290190000066' }).eq('id', bc.id),
  ])
  const pc = await profilBailleur(bc.id)
  noter('Après changements concurrents, la cohérence tient', pc.telephone_verifie_le === null && pc.telephone_canal_verification === null)

  // ═══ 9. Suppression du compte ════════════════════════════════════════════
  titre('9. Suppression — aucun résidu')
  const bs = await bailleur('sup', TEL_A)
  await verifier(bs.id, TEL_A, preparerCodeTelephone, verifierCodeTelephone)
  await admin.auth.admin.deleteUser(bs.id)
  comptes.splice(comptes.indexOf(bs.id), 1)
  noter('Plus de profil bailleur', (await admin.from('bailleurs').select('id').eq('id', bs.id).maybeSingle()).data === null)
  noter('Plus aucun code du compte', ((await admin.from('codes_verification').select('id').eq('compte_id', bs.id)).data ?? []).length === 0)

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
