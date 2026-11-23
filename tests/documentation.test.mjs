// Cohérence de la documentation avec le dépôt (ARCH-02) : une documentation
// d'état fausse conduit à des décisions de publication fausses. Ces contrôles
// échouent dès que l'état décrit diverge de ce que contient le dépôt.
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const racine = fileURLToPath(new URL('../', import.meta.url))
const lire = (chemin) => readFileSync(path.join(racine, chemin), 'utf8')

const etat = lire('ETAT-SIKALOC.md')
const migrations = readdirSync(path.join(racine, 'supabase/migrations')).filter((n) => n.endsWith('.sql')).sort()
const verrou = Object.keys(JSON.parse(lire('supabase/migrations.lock.json')))
const aLivrer = migrations.filter((n) => !verrou.includes(n))

// Documents vivants : ceux qui décrivent l'état courant (les archives non).
const vivants = ['README.md', 'ETAT-SIKALOC.md', 'MATRICE-PAGES.md',
  ...readdirSync(path.join(racine, 'docs')).filter((n) => n.endsWith('.md')).map((n) => `docs/${n}`),
  'docs/archives/2026-10/README.md']

test('ETAT-SIKALOC.md annonce le bon nombre de migrations, livrées et à livrer', () => {
  assert.match(etat, new RegExp(`\\*\\*Dépôt : ${migrations.length} migrations\\*\\*`))
  assert.match(etat, new RegExp(`\\*\\*${verrou.length} livrées en production\\*\\*`))
  assert.match(etat, new RegExp(`\\*\\*${aLivrer.length} migrations à livrer\\*\\*`))
  assert.match(etat, new RegExp(`\\*\\*${verrou.length} migrations\\*\\* appliquées`))
  const listees = [...etat.matchAll(/^\| `(\d{14}_[a-z0-9_]+\.sql)` \|/gm)].map((m) => m[1])
  assert.deepEqual(listees, aLivrer, 'le tableau des migrations à livrer doit suivre le dépôt, dans l’ordre')
})

test('ETAT-SIKALOC.md est daté', () => {
  assert.match(etat, /^\*\*Date de l'état : \d{1,2} [a-zéû]+ \d{4}\.\*\*$/m)
})

test('les rapports d’octobre ne sont plus à la racine, mais archivés avec un bandeau', () => {
  for (const nom of ['ETAT-FINAL-SIKALOC.md', 'REGISTRE-RESERVES.md', 'MODIFICATIONS-FINALES.md',
    'RAPPORT-RECETTE-FINALE.md', 'RAPPORT-SECURITE-INTEGRATION.md', 'DOSSIER-LIVRAISON-SIKALOC.md',
    'PLAN-MISE-EN-PRODUCTION.md', 'MATRICE-TESTS-CRITIQUES.md', 'MATRICE-56-PAGES.md']) {
    assert.equal(existsSync(path.join(racine, nom)), false, `${nom} à la racine`)
  }
  for (const nom of readdirSync(path.join(racine, 'docs/archives/2026-10')).filter((n) => n !== 'README.md')) {
    assert.match(lire(`docs/archives/2026-10/${nom}`), /^> \*\*Archive — octobre 2026, périmée\.\*\*/, nom)
  }
})

test('chaque commande npm citée existe dans package.json', () => {
  const scripts = Object.keys(JSON.parse(lire('package.json')).scripts)
  for (const doc of vivants) {
    for (const [, nom] of lire(doc).matchAll(/npm run ([a-z][a-z0-9:-]*)/g)) {
      assert.ok(scripts.includes(nom), `${doc} cite « npm run ${nom} », absent de package.json`)
    }
  }
})

test('les liens relatifs des documents vivants mènent à un fichier existant', () => {
  for (const doc of vivants) {
    for (const [, cible] of lire(doc).matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
      if (/^[a-z]+:/.test(cible)) continue
      const fichier = path.resolve(path.dirname(path.join(racine, doc)), cible)
      assert.ok(existsSync(fichier), `${doc} → ${cible}`)
    }
  }
})

test('le README ne décrit ni routes /app ni module Find actif', () => {
  const readme = lire('README.md')
  assert.doesNotMatch(readme, /`\/app[/`?]/)
  assert.doesNotMatch(readme, /^\s+find\//m)
  assert.match(readme, /ETAT-SIKALOC\.md/)
})

test('toute variable d’environnement lue par l’application est documentée dans .env.example', () => {
  // Variables fournies par la plateforme, ou réservées au développement et aux tests.
  const horsConfiguration = new Set(['NODE_ENV', 'NEXT_RUNTIME', 'CI', 'VERCEL_ENV', 'NEXT_PUBLIC_VERCEL_ENV',
    'SIKALOC_DEMO_LOCAL', 'GUIDE_EMAILS_JOURNAL', 'FEDAPAY_API_URL'])
  const exemple = lire('.env.example')
  const lues = new Set()
  const parcourir = (dossier) => {
    for (const entree of readdirSync(dossier, { withFileTypes: true })) {
      const chemin = path.join(dossier, entree.name)
      if (entree.isDirectory()) parcourir(chemin)
      else if (/\.(ts|tsx|mjs)$/.test(entree.name)) {
        for (const [, nom] of readFileSync(chemin, 'utf8').matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) lues.add(nom)
      }
    }
  }
  parcourir(path.join(racine, 'src'))
  for (const nom of readFileSync(path.join(racine, 'next.config.ts'), 'utf8').matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) lues.add(nom[1])
  for (const nom of [...lues].filter((n) => !horsConfiguration.has(n)).sort()) {
    assert.match(exemple, new RegExp(`^#? ?${nom}=`, 'm'), `${nom} absent de .env.example`)
  }
})

test('le secret du webhook FedaPay n’est plus présenté comme facultatif', () => {
  for (const doc of ['.env.example', 'README.md', 'docs/deploiement.md']) {
    assert.doesNotMatch(lire(doc), /si le secret est configuré|Facultatif : sans lui la signature/, doc)
  }
})
