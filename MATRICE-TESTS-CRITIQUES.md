# Matrice des tests critiques — priorité sécurité/intégration

Date : 21 octobre 2026. Les résultats « PASS local » ne valent jamais validation PostgreSQL ni Auth. `BLOQUÉ` signifie environnement absent ; `NON EXÉCUTÉ` signifie scénario prévu mais non lancé.

| Scénario | Précondition / identité | Attendu | Obtenu | Type | Statut | Preuve / réserve |
|---|---|---|---|---|---|---|
| Cible SQL distante refusée | URL Production ou Sikaloc-Test | Refus avant connexion | Refus par parseur local | Unitaire | PASS local | `tests/isolation-guard.test.mjs` ; aucune connexion réelle |
| Absence d'intention jetable refusée | Aucune variable de campagne | Refus avant connexion | Refus code 2 | Exécution locale | PASS local | `node scripts/run-isolated-sql-test.mjs` |
| Reconstruction des 57 migrations | Pile Supabase neuve | Toutes appliquées | Pile indisponible | PostgreSQL | BLOQUÉ | Docker inaccessible, CLI sans mode natif |
| Mise à niveau depuis 53 migrations | Copie restaurée et jetable | Données conservées | Aucune copie sûre | PostgreSQL | BLOQUÉ | Sauvegarde/restauration non éprouvées |
| `v_echeances`, loyer historique et RLS | Sessions Auth A/B, bail avec hausse | Tarif par période, isolation | Non observé | PostgreSQL + Auth | BLOQUÉ | Migration seulement lue ; `security_invoker` non exécuté |
| Reçu ancien sans snapshot | Versements avant/après génération | 30 000/70 000 au document | SQL non exécuté | PostgreSQL | BLOQUÉ | Fixture transactionnelle dans `tests/receipt-historique-asof.integration.sql` |
| Paiements 30k + 20k + 50k | Bail synthétique 100k | Soldes 70k/50k/0 | Non observé | Métier + PDF | BLOQUÉ | Aucune base isolée |
| Charges et dépôt | Bail synthétique | Reçu, pas quittance de loyer | Contrat local seulement | Unitaire / SQL | PASS local partiel | `tests/loyers-echeances.test.mjs` ; SQL/PDF non exécutés |
| Accès inter-bailleurs | Sessions A et B | Aucun DML/lecture croisée | Non observé | Auth/RLS | BLOQUÉ | Tests statiques existants insuffisants |
| Accès inter-locataires | Sessions locataires A/B | Isolation bail, pièces et préférences | Non observé | Auth/RLS | BLOQUÉ | Sessions indisponibles |
| Annonce et photo privée | Anon / candidat | Seul le publié est visible | Non observé | Auth/Storage | BLOQUÉ | Pile Auth/Storage indisponible |
| Candidature et invitation | Candidat / locataire | Transitions et jetons protégés | Non observé | Find/Me intégré | BLOQUÉ | Aucun compte fictif créé |
| Modification directe du plan | Bailleur A | Refus SQL des champs sensibles | Non observé | Auth/RLS | BLOQUÉ | Migration de droits lue mais non exercée |
| Webhook FedaPay répété | Fournisseur simulé | Un crédit au maximum | Non observé | Métier SQL | BLOQUÉ | Aucun fournisseur/DB de test appelé |
| Crédit de parrainage | Transaction synthétique | Journal et crédit atomiques | Non observé | PostgreSQL | BLOQUÉ | SQL non exécuté |
| Retour abonnement sans transaction | Plan actif antérieur | Pas de faux succès de paiement | Logique locale inchangée et testée | Unitaire | PASS local | `tests/retour-abonnement.test.mjs` du lot 5 ; fournisseur non testé |
| Export sous mutation concurrente | Bailleur fictif, écritures parallèles | Archive cohérente | Non observé | Intégration | NON EXÉCUTÉ | Export paginé non transactionnel ; environnement absent |
| Maintenance par défaut | Processus local sans réglage `off` | Accès métier bloqué, HTTP 503 | 503 sur `/`, `/connexion`, `/pro/tableau-de-bord`, `/api/export` avec no-store, Retry-After et noindex | HTTP local + unitaire | PASS local | Serveur `127.0.0.1:3116` arrêté après essai ; domaine Production non interrogé |

Seules des preuves issues de sessions Supabase réelles dans une pile autorisée pourront faire passer les lignes Auth/RLS de BLOQUÉ à PASS ou FAIL.
