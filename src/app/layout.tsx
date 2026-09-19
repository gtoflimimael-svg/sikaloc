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
/**
 * Ce que Sikaloc fait AUJOURD'HUI, pour tout le site.
 *
 * Rien sur Sikaloc_Find, qui n'existe pas encore : cette phrase s'affiche sous
 * le lien de n'importe quelle page du site dans un résultat de recherche, bien
 * loin de la carte qui précise « n'existe pas encore ».
 */
const DESCRIPTION_GLOBALE =
  'Sikaloc accompagne la location au Bénin : les bailleurs suivent leurs loyers ' +
  'et leurs quittances, les locataires retrouvent leurs documents dans leur ' +
  'propre espace.'

export const metadata: Metadata = {
  metadataBase: new URL('https://sikaloc.com'),
  /*
   * Le titre et la description par défaut valent pour TOUT le site — ils
   * s'appliquent à chaque page qui n'en déclare pas. Ils vendaient encore des
   * quittances aux bailleurs : c'était le métier de l'ancienne page d'accueil,
   * passé depuis à `/pro`, qui porte ses propres métadonnées.
   *
   * Ils décrivent désormais Sikaloc lui-même. Le vocabulaire précis du
   * bailleur — quittances, impayés, logiciel — reste à `/pro`, pour que les
   * deux pages ne se disputent pas les mêmes recherches.
   */
  title: {
    default: 'Sikaloc — gestion locative et logements au Bénin',
    template: '%s · Sikaloc',
  },
  description: DESCRIPTION_GLOBALE,
  applicationName: 'Sikaloc',
  authors: [{ name: 'Sikaloc' }],
  keywords: ['Sikaloc', 'gestion locative', 'location', 'logement', 'Bénin'],

  /*
   * Vérification de propriété auprès des moteurs.
   *
   * Renseignez `VERIFICATION_GOOGLE` (Search Console) ou `VERIFICATION_BING`
   * dans Vercel, puis redéployez : la balise apparaît seule. Aucun changement
   * de code n'est nécessaire.
   *
   * Les valeurs sont lues au build, pas à la requête : une variable modifiée
   * demande un redéploiement — un clic dans Vercel — pour prendre effet.
   */
  verification: {
    ...(process.env.VERIFICATION_GOOGLE ? { google: process.env.VERIFICATION_GOOGLE } : {}),
    ...(process.env.VERIFICATION_BING
      ? { other: { 'msvalidate.01': process.env.VERIFICATION_BING } }
      : {}),
  },
  /*
   * ─── L'aperçu de partage, hérité par toutes les pages ───────────────────
   *
   * Une page qui ne déclare pas d'`openGraph` hérite de celui-ci EN ENTIER
   * (règle de fusion superficielle de Next : un objet imbriqué se transmet ou
   * se remplace d'un bloc). `/` n'en déclare pas — un lien « sikaloc.com »
   * partagé sur WhatsApp affichait donc ce qui suit. `/pro` déclare le sien
   * (voir `src/app/pro/page.tsx`) et n'hérite pas de celui-ci.
   *
   * Et ce qui suit était doublement faux :
   *
   *   • orienté bailleur, sur la page qui ne l'est plus ;
   *   • « envoyées au locataire sur WhatsApp » — un acheminement que Sikaloc
   *     n'assure pas, corrigé partout ailleurs le 13 septembre et resté ici,
   *     dans le seul texte que personne ne relit parce qu'il ne s'affiche
   *     jamais sur le site.
   *
   * `url: '/'` est retiré : hérité par chaque page, il déclarait `/pro` et
   * `/blog` comme étant la page d'accueil. Sans lui, les plateformes prennent
   * l'adresse réellement partagée, et la balise canonique de chaque page fait
   * foi.
   */
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: 'Sikaloc',
    title: 'Sikaloc — gestion locative et logements au Bénin',
    description: DESCRIPTION_GLOBALE,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sikaloc — gestion locative et logements au Bénin',
    description: DESCRIPTION_GLOBALE,
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
