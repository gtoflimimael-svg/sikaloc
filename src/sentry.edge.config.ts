import * as Sentry from '@sentry/nextjs'

import { optionsCommunes } from '@/lib/sentry-options'

// Environnement « edge », s'il venait à être utilisé (le proxy tourne en Node).
Sentry.init({
  ...optionsCommunes(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN),
  integrations: [Sentry.captureConsoleIntegration({ levels: ['error'] })],
})
