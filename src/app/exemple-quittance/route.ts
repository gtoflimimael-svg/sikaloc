import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { NextResponse } from 'next/server'

const FICHIER_PDF = join(process.cwd(), 'public/documents/exemple-quittance-sikaloc.pdf')

/** Sert le PDF créé par `npm run generer:exemple-quittance` depuis le template partagé. */
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const pdf = await readFile(FICHIER_PDF)
    const etag = `"${createHash('sha256').update(pdf).digest('hex')}"`

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="exemple-quittance-sikaloc.pdf"',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'CDN-Cache-Control': 'no-store',
        'Vercel-CDN-Cache-Control': 'no-store',
        Pragma: 'no-cache',
        Expires: '0',
        ETag: etag,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return NextResponse.json(
      { erreur: 'L’exemple PDF est absent. Régénérez-le avec npm run generer:exemple-quittance.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
