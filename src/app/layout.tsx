import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import localFont from 'next/font/local'

import { SCRIPT_ANTI_FLASH } from '@/components/ui/theme'

import './globals.css'

/**
 * Typographie Sikaloc — StyreneB pour l'interface, Copernicus pour les titres
 * display, JetBrains Mono pour le contenu technique.
 *
 * Inter reste chargée : les fichiers de marque fournis ne couvrent que le latin
 * de base et ne contiennent aucun caractère accenté. Elle vient juste derrière
 * eux dans `--font-sans` pour rendre é/è/à/ç/œ/«»/—. Remplacer les fichiers de
 * `src/app/fonts/` par des versions complètes rend ce repli inerte.
 */
const styrene = localFont({
  src: [
    { path: './fonts/StyreneB-Regular.otf', weight: '400', style: 'normal' },
    { path: './fonts/StyreneB-Medium.otf', weight: '500', style: 'normal' },
    { path: './fonts/StyreneB-Bold.otf', weight: '700', style: 'normal' },
  ],
  variable: '--font-styrene',
  display: 'swap',
  adjustFontFallback: false,
})

const copernicus = localFont({
  src: [
    { path: './fonts/Copernicus-Book.ttf', weight: '400', style: 'normal' },
    { path: './fonts/Copernicus-Bold.ttf', weight: '700', style: 'normal' },
    { path: './fonts/Copernicus-Extrabold.ttf', weight: '800', style: 'normal' },
    { path: './fonts/Copernicus-Heavy.ttf', weight: '900', style: 'normal' },
  ],
  variable: '--font-copernicus',
  display: 'swap',
  adjustFontFallback: false,
})

const jetbrains = localFont({
  src: [
    { path: './fonts/JetBrainsMono-Regular.ttf', weight: '400', style: 'normal' },
    { path: './fonts/JetBrainsMono-Medium.ttf', weight: '500', style: 'normal' },
  ],
  variable: '--font-jetbrains',
  display: 'swap',
  adjustFontFallback: false,
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['400', '500', '600', '800', '900'],
})

export const metadata: Metadata = {
  title: {
    default: 'Sikaloc — Gérez vos loyers sans effort',
    template: '%s · Sikaloc',
  },
  description:
    'Sikaloc est l’outil des bailleurs au Bénin : suivi des loyers, détection des impayés et quittances PDF conformes envoyées par WhatsApp en moins de 3 clics.',
  applicationName: 'Sikaloc',
  authors: [{ name: 'Sikaloc' }],
  keywords: ['gestion locative', 'quittance de loyer', 'Bénin', 'bailleur', 'loyer'],
}

export const viewport: Viewport = {
  themeColor: '#5C5CCC',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      className={`${styrene.variable} ${copernicus.variable} ${jetbrains.variable} ${inter.variable}`}
    >
      <head>
        {/*
          Pose `data-theme` avant le premier paint. Sans ce script bloquant, un
          utilisateur en mode nuit verrait un éclair blanc à chaque navigation.
        */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_ANTI_FLASH }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
