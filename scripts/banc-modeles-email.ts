/**
 * Banc des modèles d'email.
 *
 *     npm run banc:modeles-email
 *
 * ─── Ce qu'il vérifie ───────────────────────────────────────────────────────
 *
 * Que chaque modèle rend un message complet, et que ses variables arrivent bien
 * dans le texte. Un modèle qui oublie une variable ne plante pas : il envoie
 * « Votre quittance de undefined ». Personne ne s'en aperçoit avant le
 * destinataire.
 *
 * ─── Et ce qu'il ne vérifie pas ─────────────────────────────────────────────
 *
 * Rien ne part. `composer()` est une fonction pure ; l'envoi réel dépend de
 * Resend et se teste ailleurs. Ce banc tourne sans base, sans réseau et sans
 * clé.
 */

import Module from 'node:module'

// `server-only` lève à l'import hors du rendu serveur Next. `emails.ts` le
// porte à juste titre — il manipule la clé Resend — mais un script en ligne de
// commande est un contexte serveur légitime. Même contournement que
// `scripts/banc-verification.ts`.
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

import type { ModeleEmail, VariablesEmail } from '../src/lib/emails'

/*
 * Chargement DYNAMIQUE, et c'est indispensable.
 *
 * esbuild — le transpileur de tsx — remonte tous les `import` en tête du
 * module, AVANT le hook de résolution installé plus haut. Un import statique de
 * `emails.ts` exécuterait donc `require('server-only')` pour de bon, et le
 * banc s'arrêterait sur « This module cannot be imported from a Client
 * Component ». Le `import()` différé, lui, s'exécute là où il est écrit.
 *
 * Un `await` de premier niveau n'est pas disponible non plus (sortie CJS) :
 * d'où la fonction asynchrone immédiatement appelée qui enveloppe le banc.
 */

const etapes: boolean[] = []
const noter = (nom: string, ok: boolean, detail?: string) => {
  etapes.push(ok)
  console.log(`  ${ok ? '✓' : '✗'} ${nom}${detail ? ' — ' + detail : ''}`)
}
const titre = (t: string) => console.log(`\n${t}`)

void (async () => {
  const { composer } = await import('../src/lib/emails')

  /** Tout ce que le destinataire lit, mis bout à bout. */
  function texteComplet(modele: ModeleEmail, variables: VariablesEmail): string {
    const m = composer(modele, variables)
    return [m.sujet, m.titre, ...m.corps, m.action?.libelle ?? '', m.action?.url ?? ''].join(' ')
  }

  const MODELES: ModeleEmail[] = [
    'grace_j0',
    'grace_j3',
    'grace_j30',
    'purge_j90',
    'invitation_locataire',
    'quittance_disponible',
    'relance_impaye',
    'locataire_a_rejoint',
  ]

  console.log('\nModèles d’email : rien d’incomplet ne doit pouvoir partir\n')

  // ═══ 1. Chaque modèle rend un message complet ════════════════════════════════
  titre('1. Tous les modèles, avec des variables complètes')

  const variablesCompletes: VariablesEmail = {
    nom: 'Awa Kponou',
    bailleur_nom: 'Koffi Adjovi',
    locataire_nom: 'Awa Kponou',
    logement: 'Lot 42, Fidjrossè',
    periode: 'septembre 2026',
    montant: '85 000 FCFA',
    lien: 'https://sikaloc.com/me/invitation/abc',
    validite_jours: 7,
    jours: 3,
    date_echec: '01/09/2026',
  }

  for (const modele of MODELES) {
    const m = composer(modele, variablesCompletes)
    const complet =
      m.sujet.trim().length > 0 && m.titre.trim().length > 0 && m.corps.length > 0
    noter(`${modele} — sujet, titre et corps`, complet, m.sujet)
  }

  // ═══ 2. Aucune variable ne fuit à l'état brut ════════════════════════════════
  //
  // Le défaut le plus courant et le plus discret : une clé absente donne
  // « undefined » ou « [object Object] » au milieu d'une phrase.
  titre('2. Rien d’indéfini ne traverse, même sans variables')

  for (const modele of MODELES) {
    const texte = texteComplet(modele, {})
    const propre =
      !texte.includes('undefined') && !texte.includes('[object') && !texte.includes('NaN')
    noter(
      `${modele} — sans aucune variable`,
      propre,
      propre ? undefined : texte.slice(0, 90),
    )
  }

  // ═══ 3. Les variables arrivent réellement dans le texte ══════════════════════
  titre('3. Les variables des trois nouveaux modèles arrivent à destination')

  const quittance = texteComplet('quittance_disponible', variablesCompletes)
  noter('quittance_disponible cite la période', quittance.includes('septembre 2026'))
  noter('quittance_disponible cite le montant', quittance.includes('85 000 FCFA'))
  noter('quittance_disponible nomme le bailleur', quittance.includes('Koffi Adjovi'))
  noter('quittance_disponible mène à /me/paiements', quittance.includes('/me/paiements'))

  const relance = texteComplet('relance_impaye', variablesCompletes)
  noter('relance_impaye cite la période', relance.includes('septembre 2026'))
  noter('relance_impaye cite le montant', relance.includes('85 000 FCFA'))
  noter('relance_impaye mène à /me/loyers', relance.includes('/me/loyers'))
  // La phrase qui empêche le message d'être une accusation. Sa disparition
  // changerait le ton du produit sans que rien ne le signale.
  noter(
    'relance_impaye envisage son propre tort',
    relance.toLowerCase().includes('si vous avez déjà réglé'),
  )

  const rejoint = texteComplet('locataire_a_rejoint', variablesCompletes)
  noter('locataire_a_rejoint nomme le locataire', rejoint.includes('Awa Kponou'))
  noter('locataire_a_rejoint mène à /app/locataires', rejoint.includes('/app/locataires'))

  // ═══ 4. Aucune quittance en pièce jointe, aucun lien signé dans le texte ═════
  //
  // La règle est écrite dans `docs/NOTIFICATIONS_ECOSYSTEME.md` : le message
  // porte un lien vers l'espace, jamais le document ni une URL signée. Une URL
  // signée dans un email vit trente jours dans une boîte, et s'y transfère.
  titre('4. Aucun document ni lien signé dans le corps')

  for (const modele of ['quittance_disponible', 'relance_impaye'] as ModeleEmail[]) {
    const texte = texteComplet(modele, {
      ...variablesCompletes,
      lien: 'https://xyz.supabase.co/storage/v1/object/sign/quittances/abc?token=eyJ',
    })
    const propre = !texte.includes('/storage/') && !texte.includes('token=')
    noter(`${modele} — pas d’URL de coffre`, propre)
  }

    const reussis = etapes.filter(Boolean).length
    console.log(`\n${reussis}/${etapes.length} vérifications passent\n`)
    process.exit(reussis === etapes.length ? 0 : 1)
  })()
