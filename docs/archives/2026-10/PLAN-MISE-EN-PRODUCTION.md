# Plan de mise en production — document préparatoire, non exécuté

## Préconditions et points d'arrêt

1. Conserver la maintenance en production. Geler le périmètre de code et de migrations après revue de la PR ; ne pas interpréter le build comme recette métier.
2. Confirmer projet Vercel, branche et commit réellement servis, protection de `main`, isolation des variables Preview/Production et absence de déploiement Preview involontaire. Stop si une Preview peut contacter Supabase Production ou des fournisseurs réels.
3. Sauvegarder PostgreSQL (schéma, données, rôles accessibles, historique migrations), les quatre buckets privés et métadonnées Storage, puis chiffrer, manifester avec SHA-256 et tester la restauration sur un projet/base distincts. Stop si l'intégrité ou la restauration échoue.
4. Répéter l'application des 57 migrations dans l'ordre sur un clone jetable restauré, vérifier RLS, RPC, propriétaires et grants. Exécuter les scénarios de sécurité inter-bailleurs et financiers, dont les deux migrations `20261020174549` et `20261020185126`. Stop en cas d'écart ou de données historiques incompatibles.
5. Vérifier avec des sessions fictives le nouveau code et les nouveaux droits SQL ensemble : Pro, Me, Find, Auth, reçus, quittances, abonnements, export et Storage. Ne pas tester contre des données utilisateur de production.

## Séquence coordonnée proposée

6. Préparer un déploiement compatible sans ouverture publique. Réexaminer les migrations restrictives : les anciennes Server Actions font du DML direct, donc une révocation avant nouveau code peut les interrompre ; à l'inverse, le nouveau code peut appeler des RPC absentes. Préférer une étape additive RPC, puis code compatible sous maintenance, puis révocations, uniquement après revue des dépendances. Si les migrations versionnées actuelles ne séparent pas ces phases, préparer une migration additive supplémentaire distincte, testée et approuvée ; ne pas modifier rétroactivement les migrations historiques.
7. Évaluer les webhooks FedaPay et les Cron pendant la fenêtre de maintenance. Maintenir les callbacks financiers indispensables avec authentification intacte et capacité de reprise ; ne désactiver aucune tâche sans inventaire de ses effets. Dédupliquer les ordonnanceurs cycle/purge après validation, et préserver `journal_purges` pour la reprise Storage.
8. Appliquer les migrations sur Production uniquement après feu vert humain explicite, avec surveillance immédiate des erreurs SQL et privilèges. Déployer le commit exact testé. Vérifier que le domaine sert toujours la maintenance.
9. Sous maintenance, exécuter les contrôles de santé non destructifs et les parcours synthétiques autorisés : Auth, isolation, paiement fictif seulement si l'environnement et le traitement fournisseur sont explicitement isolés, documents, permissions Storage, droits d'abonnement, callbacks/cron sans déclenchement intempestif.
10. Réouvrir seulement après validation des critères du registre des réserves, surveillance opérationnelle prête, et décision explicite du propriétaire.

## Arrêt et retour arrière

- En cas de rupture, garder la maintenance active. Ne pas restaurer aveuglément les anciens GRANT dangereux pour faire fonctionner l'ancien code.
- Préférer un correctif en avant pour aligner RPC, Server Actions et droits ; documenter la transition et les événements reçus pendant la fenêtre. N'envisager restauration des données que depuis la sauvegarde vérifiée, avec analyse des écritures intervenues depuis.
- Une restauration PostgreSQL ne rétablit pas automatiquement les octets Storage ni les notifications financières externes : rapprocher ces éléments avant toute reprise publique.

Ce plan n'autorise aucun changement distant. Il exige une revue de sécurité, une restauration réellement réussie et une décision de publication distincte.
