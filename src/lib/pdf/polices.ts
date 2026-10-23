import { join } from 'node:path'

type RegistrePolices = Pick<typeof import('@react-pdf/renderer').Font, 'register'>

const DOSSIER_POLICES = join(process.cwd(), 'src/app/fonts')
const registresDejaTraites = new WeakSet<object>()

/** Enregistre les fontes Sikaloc sur l'instance React PDF fournie. */
export function enregistrerPolicesPdf(registre: RegistrePolices): void {
  if (registresDejaTraites.has(registre)) return
  registresDejaTraites.add(registre)

  registre.register({
    family: 'Inter',
    fonts: [
      { src: join(DOSSIER_POLICES, 'Inter-PDF-Regular.ttf'), fontWeight: 400 },
      { src: join(DOSSIER_POLICES, 'Inter-PDF-Medium.ttf'), fontWeight: 500 },
      { src: join(DOSSIER_POLICES, 'Inter-PDF-Semibold.ttf'), fontWeight: 600 },
      { src: join(DOSSIER_POLICES, 'Inter-PDF-Bold.ttf'), fontWeight: 700 },
      { src: join(DOSSIER_POLICES, 'Inter-PDF-Extrabold.ttf'), fontWeight: 800 },
    ],
  })

  registre.register({
    family: 'Manrope',
    fonts: [
      { src: join(DOSSIER_POLICES, 'Manrope-PDF-Regular.ttf'), fontWeight: 400 },
      { src: join(DOSSIER_POLICES, 'Manrope-PDF-Medium.ttf'), fontWeight: 500 },
      { src: join(DOSSIER_POLICES, 'Manrope-PDF-SemiBold.ttf'), fontWeight: 600 },
      { src: join(DOSSIER_POLICES, 'Manrope-PDF-Bold.ttf'), fontWeight: 700 },
      { src: join(DOSSIER_POLICES, 'Manrope-PDF-Extrabold.ttf'), fontWeight: 800 },
    ],
  })
}
