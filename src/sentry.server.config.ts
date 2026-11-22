import * as Sentry from '@sentry/nextjs'

import { optionsCommunes } from '@/lib/sentry-options'

// Serveur Node : Server Components, Server Actions, routes API et crons.
// `captureConsoleIntegration` transforme chaque `console.error` (déjà sans
// donnée personnelle, voir `src/lib/journal.ts`) en événement Sentry.
Sentry.init({
  ...optionsCommunes(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN),
  integrations: [Sentry.captureConsoleIntegration({ levels: ['error'] })],
})
