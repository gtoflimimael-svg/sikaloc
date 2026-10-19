# Mode maintenance Sikaloc

Le mode maintenance est activé par défaut dans `src/proxy.ts`. Les pages,
routes API métier et Server Actions répondent alors directement avec HTTP 503,
`Cache-Control: no-store`, `Retry-After` et `X-Robots-Tag: noindex`. La page est
autonome : elle n'a besoin ni de JavaScript, ni de police, image ou service tiers.

Les seules routes techniques laissées au traitement normal sont :

- `POST /api/abonnement/fedapay`, protégé par la signature du webhook ;
- `GET`/`POST /api/cron/cycle-grace`, `/api/cron/notifications`,
  `/api/cron/purge` et `/api/cron/schema`, protégés par `CRON_SECRET`.

Ces routes gardent leur authentification propre ; aucune route métier ou
interface utilisateur ne bénéficie d'une exception. Les traitements Cron déjà
planifiés continuent donc pendant la maintenance.

Pour désactiver le mode sur un déploiement Vercel, définir
`SIKALOC_MAINTENANCE_MODE=off` dans l'environnement Production puis redéployer.
Pour le réactiver, supprimer cette variable (ou lui donner une autre valeur) et
redéployer. La valeur est lue pendant le build : un changement d'environnement
nécessite un nouveau déploiement. Le comportement par défaut, variable absente,
est de rester en maintenance.

Les redirections configurées dans `next.config.ts` sont suspendues en mode
maintenance afin que même les anciennes URL retournent directement 503.
