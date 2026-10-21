# Registre des réserves — lot 5

État constaté le 21 octobre 2026. Ce registre distingue défaut prouvé et validation absente.

## Bloquant pour publication

1. **P0 — Base applicative non validée sur les 57 migrations.** Le contrôle `verifier:migrations` ne vérifie que les noms, versions et ordre. Le moteur Docker local refuse la connexion ; aucun Supabase local jetable compatible n'a été établi. Les migrations de sécurité, de loyers historisés et de reçu ancien doivent être appliquées et testées dans un environnement réellement jetable, sans réinitialiser Sikaloc-Test.
2. **P0 — Livraison application/SQL non atomique.** La production conserve, selon la dernière vérification transmise, l'ancien code et 53 migrations. Le code de cette branche attend des RPC et droits des migrations suivantes. Aucun déploiement ni migration n'a été fait ici. Il faut une séquence coordonnée sous maintenance, testée sur clone restauré, et un plan d'avance en cas d'échec.
3. **P0 — Absence de restauration éprouvée.** La sauvegarde Production n'a pas été achevée dans les campagnes précédentes. Ne lancer aucune migration sensible avant une sauvegarde chiffrée de PostgreSQL et Storage et un essai de restauration isolé.
4. **P1 — 56 pages non validées en parcours authentifiés.** La présence des routes, les tests statiques et le build ne démontrent ni le rendu à 320/390/768/1024/1440 px, ni les mutations, ni l'isolation entre comptes. La matrice de recette détaille les 56 réserves.
5. **P1 — Documents financiers et exports.** Rejouer les scénarios SQL de reçu historique, loyer changé, paiement fractionné, versionnement PDF, accès croisé, et cohérence des objets Storage. L'export multi-lectures n'est pas garanti comme snapshot transactionnel global par sa seule implémentation applicative.

## Important avant publication

6. **P1 — FedaPay réel non validé dans ce lot.** Correction locale du faux message de confirmation au retour sans transaction ; le webhook signé, les redirections, doubles événements et réconciliation réelle doivent être validés avec fournisseur de test, sans paiement réel.
7. **P1 — Auth et invitation.** Confirmation email de production à 6 chiffres, OTP de test à 8 chiffres, réinitialisation, reprise, invitation locataire et autorisations doivent être rejoués dans une instance isolée. Ne pas considérer la confirmation administrative comme preuve de réception email.
8. **P1 — Find/Me.** Recherche sur annonces réelles de test, photos privées, candidature et suivi, invitation valide/expirée, loyers inconnus, téléchargement des pièces locataire restent non rejoués.
9. **P1 — Cron, notifications et purges.** Conflits d'ordonnanceurs, transports réels, idempotence, journal Storage et reprise après échec exigent un banc isolé et une configuration de déploiement connue. Aucun Cron n'a été déclenché.
10. **P2 — Captures marketing Pro.** Certaines captures précédentes représentent une interface antérieure ; elles ne doivent pas être présentées comme l'état actuel. Recapturer sur jeu synthétique, sans image générée de faux écran.

## Amélioration différable

11. **P2 — Performance mesurée.** LCP, INP et CLS ne sont pas mesurés sur un déploiement représentatif. Ne pas inventer de résultats Core Web Vitals.
12. **P2 — Revue visuelle systématique.** Couverture responsive, contraste, zoom 200 %, navigation clavier et `prefers-reduced-motion` à établir page par page avant ouverture.

Le défaut d'affichage du retour de paiement sans transaction et les affirmations excessives « tous les loyers réglés » ont été corrigés localement dans cette branche. Ils ne sont pas corrigés en production.

## Mise à jour priorité 1 — 21 octobre 2026

- **P0 maintenu** : aucune pile Supabase/PostgreSQL jetable opérationnelle dans cet environnement. Docker refuse l'accès, les binaires serveur PostgreSQL sont absents et la CLI locale ne fournit pas le mode natif. Les 57 migrations, les rôles réels et les scénarios financiers restent donc non exécutés. Un garde-fou de cible et une procédure reproductible ont été ajoutés, mais ils ne remplacent pas ces essais.
- **P0 maintenu** : aucune sauvegarde/restauration de Production n'a été réalisée ici ; aucun feu vert de publication n'en découle.
- **P1 maintenu** : les parcours Auth, Find, Me et l'export sous concurrence n'ont pas de preuve intégrée dans cette campagne. Les tests locaux de politique et de routes restent des preuves de code uniquement.
- Voir `RAPPORT-SECURITE-INTEGRATION.md` et `MATRICE-TESTS-CRITIQUES.md` pour les statuts précis. Aucune vulnérabilité SQL nouvelle n'a été déclarée « corrigée » sans reproduction.
