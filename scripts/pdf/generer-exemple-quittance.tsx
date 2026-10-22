import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createElement } from 'react'

import { renderToBuffer } from '@react-pdf/renderer'

import { donneesExempleQuittance } from '../../src/lib/pdf/exemple-quittance'
import { DocumentQuittance } from '../../src/lib/pdf/document-quittance'

const DESTINATION = join(process.cwd(), 'public/documents/exemple-quittance-sikaloc.pdf')

async function main(): Promise<void> {
  const document = createElement(DocumentQuittance, donneesExempleQuittance) as Parameters<
    typeof renderToBuffer
  >[0]
  const pdf = await renderToBuffer(document)

  await mkdir(dirname(DESTINATION), { recursive: true })
  await writeFile(DESTINATION, pdf)
  process.stdout.write(`PDF de démonstration régénéré : ${DESTINATION} (${pdf.byteLength} octets)\n`)
}

void main().catch((erreur: unknown) => {
  process.stderr.write(`Impossible de générer l’exemple de quittance : ${String(erreur)}\n`)
  process.exitCode = 1
})
