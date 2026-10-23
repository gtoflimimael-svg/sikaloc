# Guide de démonstration du véritable Sikaloc

Cette démonstration utilise les vraies routes, les vrais composants, Supabase Auth et les tables métier de Sikaloc. Il n’existe pas d’application parallèle sur `/demo`.

## Démarrer

Depuis un terminal dans `MVP Sika` :

```bash
npm run demo:dev
```

Puis ouvrez [http://localhost:3000](http://localhost:3000). L’application utilise l’instance Supabase locale isolée sur `127.0.0.1:54821`. Les variables Demo sont injectées uniquement dans le processus local ; `.env.local` n’est pas modifié.

Pour un premier démarrage sur une machine où cette instance dédiée n’existe pas encore :

```bash
npm run demo:setup
npm run demo:dev
```

Les notifications e-mail/SMS, les paiements réels, Resend et FedaPay sont neutralisés. Aucun contact réel n’est sollicité.

## Trois comptes fictifs

La reconstruction crée exactement trois utilisateurs Auth, déjà confirmés pour permettre la connexion directe :

| Espace | Profil | E-mail |
|---|---|---|
| Pro | Aïcha Kora, bailleuse | `bailleur@sikaloc-demo.test` |
| Me | Mila Adjovi, locataire liée au bail | `locataire@sikaloc-demo.test` |
| Find | Sena Hounsa, candidat sans rôle bailleur/locataire | `candidat@sikaloc-demo.test` |

Les mots de passe ne sont jamais inscrits dans Git ni affichés dans le terminal. La fiche privée complète se trouve dans `~/.local/share/sikaloc-demo-local/acces-demo.md` (permissions `0600`), et le coffre `secrets.json` conserve aussi les secrets nécessaires au fonctionnement local.

Connectez les trois profils par la page réelle `/connexion`. Le compte Me est déjà rattaché au bail via une invitation synthétique acceptée par la véritable RPC `accepter_invitation` ; aucun e-mail d’invitation n’est envoyé.

## Données préparées

- **Pro :** un seul bailleur sur le plan réel Gratuit ; deux logements au total, soit un logement loué et un logement distinct publié sur Find. Ce total respecte le plafond de deux logements du plan : aucun abonnement ni quota n’est simulé.
- **Me :** une fiche locataire, un bail actif cohérent avec Pro et le même logement loué.
- **Paiements :** deux périodes complètes et une période courante partiellement réglée. Les brouillons sont créés par la RPC réelle, puis validés et documentés par les RPC de génération/publication. Les montants ne sont pas insérés directement comme paiements déjà validés.
- **Documents :** deux quittances pour les périodes intégralement réglées et un reçu pour le versement partiel, produits avec le template PDF officiel. Les documents portent la mention « EXEMPLE / DOCUMENT FICTIF — SANS VALEUR JUSTIFICATIVE » et n’ont pas de signatures fictives.
- **Find :** une annonce de studio à Zogbadjè, Abomey-Calavi, avec une photographie immobilière générée et optimisée pour le Web. L’annonce et le logement sont explicitement fictifs et n’existent que dans l’instance locale.
- **Candidatures :** aucune n’est précréée. Le compte Find peut parcourir l’annonce et déposer une candidature par le vrai parcours. Une candidature ne crée pas automatiquement de bail.
- **Contacts :** numéros fictifs non joignables ; aucune adresse de personne réelle n’est utilisée.

Le seed n’invente pas de quittance pour une période impayée. Il ne modifie pas le plan, le calcul des loyers, les règles d’accès ni les autorisations RLS.

## Parcours de présentation (environ 10 minutes)

### A — Sikaloc Pro

1. Connectez-vous avec le profil **Pro** depuis `/connexion`.
2. Ouvrez `/pro/tableau-de-bord`.
3. Depuis la navigation Pro, consultez `/pro/logements`, `/pro/locataires` et `/pro/baux` : vous verrez un seul logement loué, une seule fiche locataire et un bail actif.
4. Ouvrez `/pro/paiements` pour comparer les deux périodes réglées et le versement partiel de la période courante.
5. Ouvrez les documents liés : les périodes complètes ont une quittance ; le paiement partiel a un reçu.
6. Montrez les actions d’ajout disponibles. Le compte est sur Gratuit : respectez son quota réel et ajoutez seulement après avoir supprimé ou clôturé selon le fonctionnement normal de l’application.

### B — Sikaloc Me

1. Déconnectez-vous, puis reconnectez-vous à `/connexion` avec le profil **Me**.
2. Le compte locataire est reconnu via la relation obtenue par invitation et ouvre les pages Me.
3. Consultez le logement, le bail, les périodes, les paiements et les documents disponibles. Ces informations sont les mêmes enregistrements que ceux consultés côté Pro.

### C — Sikaloc Find

1. Ouvrez `/find` et explorez l’annonce de démonstration et sa photographie.
2. Testez les filtres réels et ouvrez la fiche du studio.
3. Pour déposer une candidature, connectez-vous avec le profil **Find** via `/connexion`, puis revenez à l’annonce et suivez l’action de candidature.
4. Le suivi apparaît dans l’espace candidat s’il est proposé par le parcours actuel ; Pro peut consulter la demande sur son annonce.

## Reconstruction initiale et conservation

`npm run demo:dev` conserve les modifications apportées pendant une présentation. Il ne réinitialise ni ne reseed les données à chaque démarrage.

Pour **remplacer explicitement les fixtures de démonstration** et retrouver les trois comptes initiaux :

```bash
npm run demo:rebuild
```

La commande exige que vous saisissiez l’identifiant de l’instance privée affiché par l’invite. Elle ne lance pas `db reset` : elle vérifie l’instance locale dédiée, puis exécute un nettoyage SQL transactionnel réservé aux comptes dont l’email finit par `@sikaloc-demo.test` et dont les métadonnées Auth portent le marqueur Sikaloc Demo. Le script refuse l’opération si un seul compte Auth ne correspond pas à ces critères. Trois déclencheurs de protection sont désactivés temporairement dans cette transaction, puis réactivés avant son `COMMIT` ; toute erreur annule l’ensemble. Les fichiers Storage sont ensuite supprimés uniquement sous les préfixes UUID de ces comptes, dans les buckets concernés. Un manifeste privé permet de reprendre le nettoyage si une interruption survient. N’utilisez jamais `npm run db:reset` pour cette opération.

`npm run demo:status` affiche l’URL locale et le chemin des accès privés ; `npm run demo:stop` arrête la pile et conserve ses volumes.

## Avatars

La sélection et l’affichage des avatars et photos de profil ont été retirés des interfaces concernées. Les noms et rôles restent visibles ; les photographies immobilières Find et les signatures documentaires ne sont pas concernés. Les anciennes colonnes de profil restent dans le schéma pour éviter une suppression destructive.

## Limites

- Le plan Gratuit autorise deux logements : un logement loué et un autre lié à l’unique annonce Find. Le portefeuille Pro affiche donc ces deux biens.
- Le compte candidat n’a pas de candidature au départ afin que vous puissiez montrer le dépôt réel.
- La photographie générée illustre une annonce fictive et ne représente pas un bien réellement disponible.
- La démonstration n’a pas été validée par des tests automatisés ou un build ; la revue manuelle sur localhost reste à effectuer.
