import * as Sentry from '@sentry/nextjs'

import { optionsCommunes } from '@/lib/sentry-options'

// Navigateur : erreurs JavaScript non rattrapées. Pas de Session Replay
// (il enregistrerait des écrans contenant des données personnelles).
Sentry.init(optionsCommunes(process.env.NEXT_PUBLIC_SENTRY_DSN))

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
