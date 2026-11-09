import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import test from 'node:test'

const lire = (chemin) => readFileSync(new URL(chemin, import.meta.url), 'utf8')

test('Outfit est auto-hébergée par Next avec les glyphes français', () => {
  const layout = lire('../src/app/layout.tsx')

  assert.match(layout, /import\s*\{\s*Outfit\s*\}\s*from\s*'next\/font\/google'/)
  assert.match(layout, /subsets:\s*\['latin',\s*'latin-ext'\]/)
  assert.match(layout, /weight:\s*'variable'/)
  assert.match(layout, /variable:\s*'--font-outfit'/)
  assert.match(layout, /display:\s*'swap'/)
})

test('Manrope reste la fonte des titres et Outfit celle de l’interface', () => {
  const layout = lire('../src/app/layout.tsx')
  const styles = lire('../src/app/globals.css')

  assert.match(layout, /variable:\s*'--font-manrope'/)
  assert.match(layout, /className=\{`\$\{manrope\.variable\} \$\{outfit\.variable\}`\}/)
  assert.match(styles, /--font-sans:\s*var\(--font-outfit\), Outfit/)
  assert.match(styles, /--font-inter:\s*var\(--font-outfit\), Outfit/)
  assert.match(styles, /--font-display:\s*var\(--font-manrope\), Manrope/)
  assert.doesNotMatch(styles, /--font-styrene|--font-pro-display|--font-me-display/)
})

test('aucune fonte Styrene Trial ne reste dans les fontes de l’application', () => {
  const polices = readdirSync(new URL('../src/app/fonts/', import.meta.url))
  assert.deepEqual(polices.filter((nom) => /styrene/i.test(nom)), [])
})

test('les styles applicatifs ne référencent plus Inter ni Styrene', () => {
  const fichiers = [
    '../src/app/layout.tsx',
    '../src/components/verification/bienvenue.module.css',
    '../src/proxy.ts',
  ]

  for (const fichier of fichiers) {
    const contenu = lire(fichier)
    assert.doesNotMatch(contenu, /--font-styrene|\bStyreneB?\b|\bInter\b/iu, fichier)
  }
})

test('les fontes PDF Inter existantes restent inchangées et disponibles', () => {
  const pdfDir = new URL('../src/app/fonts/', import.meta.url)
  const polices = readdirSync(pdfDir)
  assert.ok(polices.includes('Inter-PDF-Regular.ttf'))
  assert.ok(polices.includes('Inter-PDF-Bold.ttf'))
  assert.ok(polices.includes('Inter-OFL.txt'))

  const pdf = readFileSync(new URL('../src/lib/pdf/polices.ts', import.meta.url), 'utf8')
  assert.match(pdf, /family:\s*'Inter'/)
})
