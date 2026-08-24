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

/**
 * Le titre porte les mots réellement cherchés (« quittance de loyer »,
 * « Bénin ») ; le H1 de la page d'accueil porte l'accroche émotionnelle. Les
 * deux leviers ne se disputent plus la même ligne.
 *
 * Les métadonnées Open Graph ne sont pas décoratives ici : WhatsApp est le
 * canal de distribution principal du produit, et sans elles un lien partagé
 * dans une conversation s'affiche sans titre, sans description et sans image.
 */
export const metadata: Metadata = {
  metadataBase: new URL('https://sikaloc.com'),
  title: {
    default: 'Quittances de loyer conformes au Bénin — Sikaloc',
    template: '%s · Sikaloc',
  },
  description:
    'Suivez vos loyers au Bénin : impayés détectés automatiquement et quittances PDF numérotées, horodatées et signées, envoyées au locataire sur WhatsApp.',
  applicationName: 'Sikaloc',
  authors: [{ name: 'Sikaloc' }],
  keywords: ['gestion locative', 'quittance de loyer', 'Bénin', 'bailleur', 'loyer'],
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: 'Sikaloc',
    url: '/',
    title: 'Quittances de loyer conformes au Bénin — Sikaloc',
    description:
      'Quittances PDF numérotées, horodatées et signées, envoyées au locataire sur WhatsApp. Gratuit jusqu’à 2 logements.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Quittances de loyer conformes au Bénin — Sikaloc',
    description:
      'Quittances PDF numérotées, horodatées et signées, envoyées au locataire sur WhatsApp.',
  },
}

export const viewport: Viewport = {
  themeColor: '#5555BC',
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

        {/*
          Données structurées — `Organization` uniquement.

          Le rapport Axe 3 en demande trois. Les deux autres ont été écartées.

          `FAQPage` (§5.2A, priorité haute, « +15 à 30 % de CTR ») ne produit
          plus rien : Google a restreint les FAQ rich results aux sites publics
          de santé et d'administration en août 2023, puis les a supprimés pour
          tout le monde en mai 2026 — trois mois avant la rédaction du rapport.
          Le balisage serait du travail sans retour, et son contenu proposé
          reprend en prime « quittances PDF standards » et « export
          historique », deux formulations retirées du site depuis.

          `SoftwareApplication` (§5.2C) embarque un `aggregateRating` de 4,8
          pour un seul avis. Sikaloc n'a aucun utilisateur : ce serait une
          donnée structurée inventée, exactement ce que Google sanctionne d'une
          action manuelle. Le rapport le déconseille lui-même en note de bas de
          bloc, tout en laissant le champ dans le code à copier.
        */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Sikaloc',
              url: 'https://sikaloc.com',
              logo: 'https://sikaloc.com/marque/logo-email.png',
              description:
                'Quittances de loyer numérotées et horodatées, et suivi des impayés, pour les bailleurs au Bénin.',
              email: 'bonjour@sikaloc.com',
              areaServed: { '@type': 'Country', name: 'Bénin' },
              contactPoint: {
                '@type': 'ContactPoint',
                contactType: 'Support client',
                email: 'bonjour@sikaloc.com',
                availableLanguage: 'French',
              },
            }),
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
