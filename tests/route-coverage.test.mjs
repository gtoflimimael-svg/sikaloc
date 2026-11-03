import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const racine = fileURLToPath(new URL('../src/app/', import.meta.url))
const matrice = readFileSync(new URL('../MATRICE-56-PAGES.md', import.meta.url), 'utf8')

function pages(repertoire) {
  return readdirSync(repertoire, { withFileTypes: true }).flatMap((entree) => {
    const chemin = join(repertoire, entree.name)
    if (entree.isDirectory()) return pages(chemin)
    return entree.name === 'page.tsx' ? [chemin] : []
  })
}

function route(chemin) {
  const segments = relative(racine, chemin).split('/').slice(0, -1)
  return '/' + segments.filter((segment) => !/^\(.*\)$/.test(segment)).join('/')
}

test('les 58 routes ont chacune une entrée unique dans la matrice', () => {
  const routes = pages(racine).map(route)
  assert.equal(routes.length, 58)
  assert.equal(new Set(routes).size, 58)
  const lignes = matrice.split('\n').filter((ligne) => /^\| (Public|Auth|Find|Me|Pro) \| `\//.test(ligne))
  const routesMatrice = lignes.map((ligne) => ligne.match(/\| `([^`]+)` \|/)?.[1])
  assert.equal(routesMatrice.length, 58)
  assert.deepEqual([...routesMatrice].sort(), [...routes].sort())
})
