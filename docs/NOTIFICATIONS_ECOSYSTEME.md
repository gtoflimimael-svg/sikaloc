# Notifications et interactions entre les deux espaces

État au 13 septembre 2026, après l'étape 4 de la mission écosystème.

Ce document répond au point 9 du cahier des charges : **ce qui est fait
maintenant, ce qui est préparé, ce qui attend** — et pourquoi.

---

## La règle qui décide de tout : un seul canal

Sikaloc n'achemine **que de l'email**. Ni SMS, ni WhatsApp.

Ce n'est pas un choix esthétique, c'est un constat : aucun fournisseur n'est
branché. L'enregistrement d'un identifiant d'expéditeur SMS au Bénin demande
environ trois semaines, et WhatsApp Business Platform suppose un compte
vérifié et des modèles de message approuvés.

**Ce que cela n'interdit pas.** Les liens `wa.me` du produit ne sont pas un
canal : ils ouvrent WhatsApp sur le téléphone du bailleur, avec un message
pré-rempli qu'il envoie lui-même. Sikaloc n'achemine rien, ne paie rien, et ne
promet rien. Ils restent, et ils sont utiles — au Bénin, c'est WhatsApp qu'on
lit.

La distinction tient en une phrase : **Sikaloc envoie par email ; le bailleur
envoie par WhatsApp.**

---

## 1 — Fait, en production

### Le bailleur écrit à son locataire

| Message | Déclencheur | Destinataire |
|---|---|---|
| **Votre quittance est disponible** | bouton « Envoyer par email » sur la quittance | locataire |
| **Loyer de … — rappel** | bouton « Relancer par email » sur les impayés | locataire |

**Rien ne part tout seul.** Les deux exigent un clic du bailleur. Une relance
automatique envoyée au mauvais moment abîme précisément la relation que le
produit est censé protéger — et Sikaloc se trompe parfois : un loyer réglé en
espèces sans saisie apparaît comme impayé.

Trois refus possibles, tous affichés au bailleur plutôt que silencieux :

- le locataire n'a pas d'adresse email sur sa fiche ;
- il a demandé à ne plus recevoir d'email ;
- l'envoi a échoué.

Le montant et le mois qui partent dans une relance sont **relus en base au
moment du clic**, jamais repris du formulaire. Entre l'affichage de l'écran et
le geste, le loyer a pu être réglé — et un formulaire se rejoue.

Les relances par email sont réservées au plan Standard, comme les relances
WhatsApp. Un email part de l'infrastructure de Sikaloc et lui coûte ; un lien
WhatsApp ne fait qu'ouvrir une application.

### Sikaloc écrit au bailleur

| Message | Déclencheur | Respecte `notif_email` |
|---|---|---|
| **… a rejoint son espace** | le locataire accepte son invitation | oui |
| Cycle de grâce (J0, J3, J30) | pg_cron, via la file `emails_a_envoyer` | non — voir ci-dessous |
| Purge J+90 | pg_cron | non |

Les avis d'impayé d'abonnement et d'avant-suppression partent **toujours** :
ils annoncent la perte de données. Un réglage qui permettrait de les couper
ferait disparaître un compte sans que personne ait été prévenu.

### Sikaloc écrit au locataire

| Message | Déclencheur |
|---|---|
| **Invitation à rejoindre Sikaloc_Me** | le bailleur invite (étape 2) |

### Ce que le locataire contrôle

`/me/preferences` — une case, qui coupe **tous** les emails de Sikaloc le
concernant. Ses quittances et ses loyers restent consultables : le réglage ne
touche que les messages.

C'est le **seul chemin d'écriture** de Sikaloc_Me. La fonction
`definir_mes_notifications` ne sait écrire qu'une colonne booléenne, et
seulement sur les fiches du compte appelant.

### Deux réglages du bailleur, réparés

`notif_email` et `notif_whatsapp` étaient enregistrés et **jamais relus**. On
les changeait, on croyait avoir agi, rien ne se passait — et leurs libellés
annonçaient des rappels d'échéance que Sikaloc n'a jamais envoyés.

`notif_whatsapp` gouverne désormais réellement l'affichage des boutons
WhatsApp. `notif_email` gouverne les messages non essentiels. Les libellés
décrivent ce que chacun fait.

---

## 2 — Préparé, mais pas activé

Ces éléments existent en base ou en code, et attendent une décision ou un
fournisseur. Aucun n'est à moitié branché : ils ne font rien, et ne prétendent
rien.

### Le lien de désabonnement dans les emails

L'écran `/me/preferences` suppose d'avoir un compte. Un lien signé dans le pied
de chaque email permettrait de couper sans se connecter — c'est ce que les
destinataires attendent, et ce que les filtres anti-spam apprécient.

**Ce qu'il manque :** une route publique et un jeton HMAC, sur le modèle des
invitations (`src/lib/invitations.ts`). Une demi-journée.

### La file d'attente pour les envois au locataire

`emails_a_envoyer` existe et sait réessayer trois fois, avec une clé
d'idempotence. Les envois de l'étape 4 ne l'utilisent pas : ils partent
immédiatement, parce qu'ils sont déclenchés par un bouton et que leur résultat
doit s'afficher.

**Quand cela changera :** le jour où un message partira sans clic — un rappel
d'échéance, par exemple. Il faudra alors la file, parce que personne ne sera
devant l'écran pour voir l'échec.

### La vérification du téléphone

Suspendue depuis l'étape 2, et de façon **auto-réparante** : l'exigence revient
d'elle-même dès qu'un canal peut acheminer un code
(`src/lib/verification/canaux.ts`). Aucun interrupteur à repenser.

---

## 3 — Plus tard, et pourquoi pas maintenant

### Le rappel d'échéance automatique

« Votre loyer de novembre est dû dans cinq jours. »

**Pourquoi pas maintenant :** c'est le premier message que Sikaloc enverrait de
sa propre initiative à un locataire, et il faut d'abord savoir répondre à
« pourquoi je reçois ça ? ». Cela suppose le lien de désabonnement, la file
d'attente, et une décision du bailleur — tous ses locataires, ou aucun ?

Cela suppose surtout de trancher une question de produit : un locataire qui
paie toujours à l'heure vit-il ce rappel comme un service ou comme une
défiance ?

### La notification au bailleur quand son locataire consulte

Techniquement facile, humainement douteux. Savoir qu'une personne a ouvert son
espace à 23 h relève de la surveillance, pas de la gestion locative.

**Écarté**, sauf demande explicite et justifiée.

### WhatsApp et SMS comme canaux de Sikaloc

Le jour où un fournisseur est branché :

- la vérification du téléphone se rallume seule ;
- les modèles d'email existants se transposent — `composer()` rend déjà une
  structure (`sujet`, `titre`, `corps`, `action`) indépendante du rendu HTML ;
- les préférences gagnent une ligne par canal, côté bailleur et côté locataire.

**Ordre recommandé :** WhatsApp d'abord. C'est ce que les gens lisent au Bénin,
et le SMS coûte plus cher pour être moins lu.

### Les notifications dans l'application

Une pastille, un journal des événements. Utile le jour où il y aura assez
d'événements pour en faire un journal. Aujourd'hui il y en a trois.

---

## Ce qui n'a volontairement pas été fait

**Envoyer la quittance en pièce jointe.** Le message porte un lien vers le
document du coffre. Une pièce jointe est une copie : elle se transfère sans
contrôle, et cesse d'être le document dont l'empreinte SHA-256 fait foi dès
que le bailleur corrige le paiement dans les cinq minutes qui suivent.

**Emailer les locataires sans compte.** Sikaloc n'écrit qu'aux personnes qui
ont une adresse sur leur fiche et qui n'ont pas refusé — et toujours sur un
geste de leur bailleur. Personne ne reçoit de message d'un service qu'il n'a
jamais rencontré sans que son propre bailleur l'ait voulu.

**Retirer les liens WhatsApp.** Ils fonctionnent, ils ne coûtent rien, et ce
sont eux que les bailleurs utilisent aujourd'hui. Les supprimer au nom du
« tout email » aurait détruit une fonctionnalité qui marche pour satisfaire une
règle qui visait autre chose.
