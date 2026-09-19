/**
 * Banc des règles de chemin — qui a le droit de frapper à quelle porte.
 *
 *     npm run banc:chemins
 *
 * ─── Pourquoi ce banc existe ────────────────────────────────────────────────
 *
 * `/me/invitation/<jeton>` était protégé par le proxy alors qu'il s'adresse à
 * quelqu'un qui n'a pas de compte. Le locataire qui cliquait le lien reçu de
 * son bailleur atterrissait sur l'écran de connexion, sans identifiants : le
 * parcours d'invitation était coupé à son avant-dernier pas.
 *
 * Le défaut a traversé deux étapes sans se voir, parce que la règle vivait
 * dans `proxy.ts` — inaccessible à tout test qui ne soit pas un navigateur. Et
 * parce que l'acceptation n'avait été éprouvée que depuis un compte DÉJÀ
 * connecté, cas où le proxy laisse passer.
 *
 * ─── Ce qu'il surveille ─────────────────────────────────────────────────────
 *
 * Deux dangers symétriques, et le second est le plus grave :
 *
 *   1. une page destinée aux visiteurs sans compte redevient protégée ;
 *   2. un préfixe trop large rend publiques les pages du locataire connecté.
 *
 * Le point 2 mérite l'attention : `startsWith` est commode et mord. Sans le
 * séparateur, `/me/invitationXYZ` — ou pire, un futur `/me/loyers` si quelqu'un
 * ajoutait `/me/lo` à la liste — passerait pour public.
 */

import {
  cheminProtege,
  cheminPublic,
  CHEMINS_PUBLICS,
  CHEMINS_PUBLICS_EXACTS,
  espaceDuChemin,
  ESPACE_ME,
  ESPACE_PRO,
} from '../src/lib/roles'

const etapes: boolean[] = []
const noter = (nom: string, ok: boolean, detail?: string) => {
  etapes.push(ok)
  console.log(`  ${ok ? '✓' : '✗'} ${nom}${detail ? ' — ' + detail : ''}`)
}
const titre = (t: string) => console.log(`\n${t}`)

console.log('\nChemins : qui a le droit de frapper à quelle porte\n')

// ═══ 1. Les pages du parcours d'invitation ═══════════════════════════════════
titre('1. Ce qui doit rester atteignable sans compte')

const PUBLICS = [
  '/me/rejoindre',
  '/me/invitation/abc123',
  '/me/invitation/8-54qFGeD8xM9IjBP7OXJsftZSGIgrF-DL0AXBt0N5I',
  // La présentation de Sikaloc_Pro. Publique par ÉGALITÉ seulement : tout ce
  // qui vit dessous reste l'application du bailleur.
  '/pro',
]

for (const chemin of PUBLICS) {
  noter(`${chemin} est public`, cheminPublic(chemin))
}

// L'oubli d'origine, nommé pour qu'il ne revienne pas en silence.
noter(
  '/me/invitation figure bien dans la liste',
  CHEMINS_PUBLICS.includes('/me/invitation'),
)

// ═══ 2. Et tout le reste de l'espace reste fermé ═════════════════════════════
titre('2. Ce qui doit rester protégé')

const PROTEGES = [
  '/me',
  '/me/loyers',
  '/me/paiements',
  '/me/bail',
  '/me/preferences',
  '/pro/tableau-de-bord',
  '/pro/impayes',
  '/pro/baux',
  '/pro/locataires',
  '/pro/paiements',
  '/pro/parametres/abonnement',
  '/pro/onboarding',
]

for (const chemin of PROTEGES) {
  noter(`${chemin} reste protégé`, !cheminPublic(chemin))
}

// ═══ 3. Le piège de `startsWith` ═════════════════════════════════════════════
//
// Un préfixe sans séparateur rend public tout ce qui COMMENCE par lui. C'est la
// façon la plus discrète d'ouvrir un espace entier en croyant ouvrir une page.
titre('3. Aucun voisin ne passe par ressemblance de préfixe')

const VOISINS = [
  '/me/invitations',
  '/me/invitationXYZ',
  '/me/rejoindre-moi',
  '/me/rejoindreTout',
  '/mes-loyers',
]

for (const chemin of VOISINS) {
  noter(`${chemin} n’est PAS public`, !cheminPublic(chemin))
}

// ═══ 3 bis. `/pro` s'ouvre seul, jamais sa descendance ═══════════════════════
//
// La faute qui guette ici est l'inverse de celle de `/me/invitation` : ouvrir
// une racine d'espace par préfixe rendrait publique toute l'application du
// bailleur — baux, locataires, paiements, quittances — en une seule ligne.
//
// D'où deux listes distinctes dans `roles.ts`, et cette section qui les sépare.
titre('3 bis. L’ouverture de /pro ne déborde sur rien')

noter('/pro figure dans la liste EXACTE', CHEMINS_PUBLICS_EXACTS.includes('/pro'))
noter(
  '/pro ne figure PAS dans la liste par préfixe',
  !CHEMINS_PUBLICS.includes('/pro'),
  'sinon toute l’application du bailleur deviendrait publique',
)

for (const chemin of [
  '/pro/tableau-de-bord',
  '/pro/baux',
  '/pro/locataires',
  '/pro/paiements',
  '/pro/logements',
  '/pro/impayes',
  '/pro/quittances/abc',
  '/pro/parametres',
  '/pro/parametres/abonnement',
  '/pro/onboarding',
]) {
  noter(`${chemin} n’est PAS public`, !cheminPublic(chemin))
}

// Et les voisins qui ressemblent à `/pro` sans en être.
for (const chemin of ['/profil', '/professionnel', '/probleme', '/promotions']) {
  noter(`${chemin} n’est ni public ni gardé par l’espace Pro`, !cheminProtege(chemin))
}

// ═══ 4. Les espaces se reconnaissent toujours ════════════════════════════════
titre('4. Les chemins publics appartiennent bien à un espace')

noter(
  '/me/invitation/abc appartient à Sikaloc_Me',
  espaceDuChemin('/me/invitation/abc')?.nom === ESPACE_ME.nom,
)
noter(
  '/pro/impayes appartient à Sikaloc_Pro',
  espaceDuChemin('/pro/impayes')?.nom === ESPACE_PRO.nom,
)
noter('/ n’appartient à aucun espace', espaceDuChemin('/') === null)

// Le corollaire qui compte : être public ne dispense pas la page de protéger
// ses données. Le jeton reste l'autorisation.
titre('5. Public ne veut pas dire sans autorisation')

noter(
  'tous les chemins publics vivent dans un espace protégé',
  [...CHEMINS_PUBLICS, ...CHEMINS_PUBLICS_EXACTS].every((p) => espaceDuChemin(p) !== null),
  'leur contenu reste gardé par leur propre règle — jeton, session, ou rien',
)

const reussis = etapes.filter(Boolean).length
console.log(`\n${reussis}/${etapes.length} vérifications passent\n`)
process.exit(reussis === etapes.length ? 0 : 1)
