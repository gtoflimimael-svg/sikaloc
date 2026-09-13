-- ═══════════════════════════════════════════════════════════════════════════
-- Ce qu'un locataire a le droit de voir
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ─── Le verrou ─────────────────────────────────────────────────────────────
--
-- Les dix-neuf politiques de `logements`, `baux`, `paiements`, `quittances`,
-- `locataires` et `bailleurs` disent toutes la même chose :
--
--     (select auth.uid()) = bailleur_id
--
-- Un locataire n'est le bailleur de personne. Son identifiant n'égale jamais
-- `bailleur_id`, et il ne lit donc rien — pas même sa propre fiche. C'est
-- exactement ce qui doit arriver tant qu'aucune ouverture n'est prévue : le
-- verrou n'est pas un défaut, c'est ce qui a protégé les données jusqu'ici.
--
-- ─── Pourquoi on ne réécrit pas ces politiques ─────────────────────────────
--
-- La tentation était d'ajouter `or locataire_id in (…)` à chacune. Dix-neuf
-- fois, sur six tables, dont celles qui portent les quittances. Trois raisons
-- de ne pas le faire :
--
--   • Chaque politique retouchée est une occasion d'ouvrir l'accès du bailleur
--     par accident. Le rapport risque/bénéfice est mauvais : on toucherait à
--     ce qui marche pour ajouter ce qui n'existe pas.
--
--   • Une politique de table est tout-ou-rien sur les colonnes. Ouvrir `baux`
--     en lecture au locataire lui donnerait aussi `historique_declare_par`, et
--     ouvrir `bailleurs` lui donnerait le plan d'abonnement, le code de
--     parrainage et le chemin de la signature.
--
--   • Dix-neuf endroits à relire pour répondre à « que voit un locataire ? ».
--     Ici, la réponse tient dans ce fichier.
--
-- ─── Ce qu'on fait à la place ──────────────────────────────────────────────
--
-- Une surface d'accès : quatre fonctions `security definer` qui listent,
-- colonne par colonne, ce qu'un locataire peut lire. Les politiques existantes
-- ne bougent pas d'un caractère.
--
-- ─── Le point de vigilance, écrit noir sur blanc ───────────────────────────
--
-- `security definer` fait tourner ces fonctions sous `postgres`, propriétaire
-- des tables. Un propriétaire contourne les RLS — `relforcerowsecurity` est
-- à `false` partout. Donc :
--
--     à l'intérieur de ces fonctions, AUCUNE politique ne protège plus rien.
--     La clause `where` EST la sécurité.
--
-- D'où `prive.fiches_du_compte()` : un seul endroit où « qui suis-je ? » est
-- répondu, et quatre `where … in (select prive.fiches_du_compte())` qui s'y
-- réfèrent. Une comparaison d'identifiants écrite quatre fois aurait quatre
-- occasions d'être écrite de travers.
--
-- ─── Lecture seule, entièrement ────────────────────────────────────────────
--
-- Aucun `insert`, aucun `update`, aucun `delete`, aucun `grant` sur une table.
-- Un locataire ne déclare pas un paiement, ne corrige pas un loyer, ne touche
-- pas à une quittance. Sikaloc_Me montre ; c'est Sikaloc_Pro qui écrit.
--
-- Cela règle d'avance la règle d'immutabilité des documents signés : il n'y a
-- pas de chemin d'écriture à protéger, parce qu'il n'y en a aucun.

-- ═══ Qui suis-je ? ══════════════════════════════════════════════════════════
--
-- L'unique frontière de sécurité de ce fichier.
--
-- Rend les fiches `locataires` rattachées au compte appelant. Plusieurs, et
-- c'est voulu : `locataires.compte_id` n'est délibérément pas unique. Une même
-- personne qui loue à deux bailleurs a deux fiches — chaque bailleur a créé la
-- sienne — et les deux lui appartiennent.
--
-- Sans session, `auth.uid()` vaut NULL. `compte_id = NULL` ne vaut jamais vrai
-- en SQL : la fonction rend alors zéro ligne, et les quatre fonctions publiques
-- rendent zéro ligne avec elle. Le cas est donc couvert par le langage
-- lui-même, pas par un test qu'on pourrait oublier.
create or replace function prive.fiches_du_compte()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select l.id
    from public.locataires l
   where l.compte_id = (select auth.uid());
$$;

comment on function prive.fiches_du_compte() is
  'Les fiches locataire du compte appelant. Frontière de sécurité unique de Sikaloc_Me : toute fonction de lecture locataire filtre par son résultat.';

revoke all on function prive.fiches_du_compte() from public, anon, authenticated;

-- ═══ Mon logement et mon bail ═══════════════════════════════════════════════
--
-- ─── Les baux résiliés sont rendus aussi ───────────────────────────────────
--
-- Un locataire qui a quitté son logement garde besoin de ses quittances — ce
-- sont des pièces qu'on lui demandera ailleurs, parfois des années plus tard.
-- Fermer l'accès le jour de la résiliation lui retirerait ses propres
-- documents. Le statut est rendu avec le reste, et l'écran le dit.
--
-- ─── Ce que le locataire apprend de son bailleur ───────────────────────────
--
-- Le nom et le téléphone. Rien d'autre : ni le plan d'abonnement, ni le code
-- de parrainage, ni l'adresse personnelle, ni le chemin de la signature, ni
-- l'état de vérification du compte.
--
-- Ces deux champs ne sont pas une divulgation : ils figurent déjà sur chaque
-- quittance que ce locataire a reçue, et c'est par le téléphone qu'on joint
-- son bailleur quand une fuite d'eau ne peut pas attendre.
--
-- ─── Pourquoi l'email du bailleur n'y est PAS ──────────────────────────────
--
-- Il y était, et une relecture l'a signalé à juste titre. `bailleurs.email`
-- est l'adresse de CONNEXION au compte Sikaloc — elle ne figure sur aucune
-- quittance, aucun écran ne s'en sert, et c'est la moitié d'un identifiant.
-- La rendre lisible par tous les locataires d'un bailleur en ferait une cible
-- d'hameçonnage sans rendre le moindre service.
--
-- La règle du minimum nécessaire était déjà écrite trois lignes plus haut ;
-- cette colonne la contredisait.
create or replace function public.mes_baux()
returns table (
  bail_id            uuid,
  statut             public.statut_bail,
  loyer_mensuel      numeric,
  depot_garantie     numeric,
  date_debut         date,
  date_fin           date,
  jour_echeance      smallint,
  tolerance_jours    smallint,
  locataire_nom      text,
  logement_adresse   text,
  logement_ville     text,
  logement_pays      text,
  logement_type      public.type_logement,
  bailleur_nom       text,
  bailleur_telephone text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.id,
    b.statut,
    b.loyer_mensuel,
    b.depot_garantie,
    b.date_debut,
    b.date_fin,
    b.jour_echeance,
    b.tolerance_jours,
    loc.nom,
    lg.adresse,
    lg.ville,
    lg.pays,
    lg.type,
    ba.nom,
    ba.telephone
  from public.baux b
  join public.locataires loc on loc.id = b.locataire_id
  join public.logements  lg  on lg.id  = b.logement_id
  join public.bailleurs  ba  on ba.id  = b.bailleur_id
  where b.locataire_id in (select prive.fiches_du_compte())
  order by (b.statut = 'Actif') desc, b.date_debut desc;
$$;

comment on function public.mes_baux() is
  'Les baux du locataire appelant, actifs et résiliés, avec le logement, le nom et le téléphone du bailleur. Lecture seule.';

revoke all on function public.mes_baux() from public, anon;
grant execute on function public.mes_baux() to authenticated;

-- ═══ Mes loyers ═════════════════════════════════════════════════════════════
--
-- ─── Le même calcul que le bailleur, pas un second ─────────────────────────
--
-- La vue `v_echeances` reste la seule à décider d'un état. Cette fonction la
-- lit et la filtre ; elle ne rejoue aucune règle. Un loyer vu depuis Me et vu
-- depuis Pro est le même loyer, dans le même état, au même instant.
--
-- ─── « À déterminer » est montré au locataire ──────────────────────────────
--
-- C'est le point le plus important de cet écran. Un locataire qui a réglé ses
-- loyers en espèces pendant deux ans avant que son bailleur n'ouvre Sikaloc ne
-- doit pas découvrir vingt-quatre mois marqués « Impayé ». Il ne les doit pas :
-- Sikaloc n'en sait simplement rien.
--
-- Le quatrième état existait déjà pour éviter au bailleur de réclamer un loyer
-- déjà versé. Il protège ici la personne à qui on l'aurait réclamé.
--
-- ─── Ce qui n'est pas rendu ────────────────────────────────────────────────
--
-- `anterieure` et `historique_declare` décrivent l'usage que le bailleur fait
-- de Sikaloc — depuis quand il l'utilise, s'il a rempli son historique. Cela
-- ne concerne pas son locataire.
create or replace function public.mes_echeances()
returns table (
  bail_id         uuid,
  periode_debut   date,
  periode_fin     date,
  date_echeance   date,
  loyer_mensuel   numeric,
  montant_paye    numeric,
  montant_du      numeric,
  jours_de_retard int,
  etat            text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.bail_id,
    e.periode_debut,
    e.periode_fin,
    e.date_echeance,
    e.loyer_mensuel,
    e.montant_paye,
    e.montant_du,
    e.jours_de_retard,
    e.etat
  from public.v_echeances e
  where e.locataire_id in (select prive.fiches_du_compte())
  order by e.periode_debut;
$$;

comment on function public.mes_echeances() is
  'Les échéances du locataire appelant, dans l''état calculé par v_echeances — Réglé, À venir, À déterminer, Impayé. Aucun recalcul.';

revoke all on function public.mes_echeances() from public, anon;
grant execute on function public.mes_echeances() to authenticated;

-- ═══ Mes paiements, et les quittances qui vont avec ═════════════════════════
--
-- ─── Une seule liste, pas deux ─────────────────────────────────────────────
--
-- Une quittance appartient à un paiement — `quittances.paiement_id` porte une
-- contrainte d'unicité. Deux écrans, « mes paiements » et « mes quittances »,
-- auraient montré la même chose deux fois, avec le risque de ne pas raconter
-- la même histoire. La quittance est donc une colonne du paiement.
--
-- ─── Les brouillons restent invisibles ─────────────────────────────────────
--
-- `statut = 'Validé'` uniquement. Un brouillon est la note de travail du
-- bailleur, pas un fait : le montrer ferait croire à un locataire qu'un
-- versement est enregistré alors que son bailleur ne l'a pas confirmé.
--
-- ─── Une date de paiement peut être vide ───────────────────────────────────
--
-- `date_paiement` est NULL pour un loyer déclaré comme réglé avant Sikaloc.
-- L'écran écrit alors « date non précisée » plutôt qu'une date inventée, et
-- `historique` lui permet de l'expliquer.
create or replace function public.mes_paiements()
returns table (
  paiement_id      uuid,
  bail_id          uuid,
  date_paiement    date,
  montant          numeric,
  periode_debut    date,
  periode_fin      date,
  mode_paiement    public.mode_paiement,
  type_paiement    public.type_paiement,
  est_partiel      boolean,
  historique       boolean,
  quittance_id     uuid,
  quittance_numero text,
  quittance_type   public.type_document,
  /*
   * Le fichier est-il encore dans le coffre ?
   *
   * `prive.purger_donnees_personnelles()` — la purge J+90 qui suit un impayé
   * d'abonnement — met `pdf_chemin` à NULL et fait effacer l'objet, mais LAISSE
   * la ligne `quittances`. Sans ce booléen, l'écran du locataire afficherait
   * « Quittance n° 2026-0007 · Télécharger » pour un document qui n'existe
   * plus, et le bouton ne mènerait qu'à une erreur.
   *
   * Un booléen, jamais le chemin : voir `ma_quittance` plus bas.
   */
  quittance_telechargeable boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.bail_id,
    p.date_paiement,
    p.montant,
    p.periode_debut,
    p.periode_fin,
    p.mode_paiement,
    p.type_paiement,
    p.est_partiel,
    p.historique,
    q.id,
    q.numero_document,
    q.type,
    (q.pdf_chemin is not null)
  from public.paiements p
  join public.baux b on b.id = p.bail_id
  left join public.quittances q on q.paiement_id = p.id
  where p.statut = 'Validé'
    and b.locataire_id in (select prive.fiches_du_compte())
  order by p.periode_debut desc, p.created_at desc;
$$;

comment on function public.mes_paiements() is
  'Les versements validés du locataire appelant, avec la quittance émise le cas échéant. Les brouillons du bailleur sont exclus.';

revoke all on function public.mes_paiements() from public, anon;
grant execute on function public.mes_paiements() to authenticated;

-- ═══ Le document lui-même ═══════════════════════════════════════════════════
--
-- Répond à une seule question : « ce document est-il à moi ? ». Zéro ligne
-- veut dire non.
--
-- ─── Pourquoi le chemin du fichier n'est PAS rendu ici ─────────────────────
--
-- Il l'était, avec en commentaire la promesse qu'il « ne quitterait pas le
-- serveur ». Une relecture a fait remarquer que rien ne l'imposait : la
-- fonction est exécutable par `authenticated`, donc appelable directement
-- depuis un navigateur avec la clé publique. La promesse n'était qu'une
-- intention, et `pdf_chemin` commence par l'identifiant de compte du bailleur.
--
-- Un commentaire qui affirme un invariant que rien ne tient est pire que pas
-- de commentaire : il fait relire le code avec une garantie qui n'existe pas.
--
-- Le chemin est donc relu par la route elle-même, avec la clé d'administration,
-- APRÈS que cette fonction a établi que le document appartient à l'appelant.
-- L'appartenance et le chemin restent séparés ; seul le serveur tient les deux.
--
-- ─── L'appartenance se décide par le PAIEMENT, jamais par `quittances.bail_id`
--
-- C'est la correction la plus importante de ce fichier, et elle tient en un
-- mot de la clause `join`.
--
-- `quittances.bail_id` est écrit à la création du document et PLUS JAMAIS
-- ensuite : la régénération ne met à jour que `type`, `pdf_chemin` et
-- `hash_sha256`. Or `corrigerPaiement` permet au bailleur de déplacer un
-- paiement d'un bail à l'autre pendant les cinq minutes qui suivent la
-- validation — c'est même l'usage prévu de cette fenêtre, et le formulaire
-- propose explicitement tous ses baux actifs, libellés « Locataire — adresse ».
--
-- Une seule faute de frappe suffit donc à produire ceci :
--
--     paiements.bail_id   = bail de Bob   (corrigé, et c'est Bob sur le PDF)
--     quittances.bail_id  = bail d'Alice  (figé à la création, désormais faux)
--
-- Aucune clé étrangère composite, aucun `check`, aucun déclencheur ne les tient
-- égaux — seul `quittances.paiement_id` est unique.
--
-- Joindre par `q.bail_id` aurait donc rendu à Alice le document de Bob : son
-- nom, son téléphone, l'adresse de son logement, le montant, la période. Et
-- refusé à Bob son propre document, que `mes_paiements()` venait pourtant de
-- lui annoncer — cette fonction-là joint déjà par le paiement.
--
-- Deux fonctions du même fichier décidaient de l'appartenance du même objet par
-- deux chemins différents. Elles empruntent désormais le seul qui reste vrai.
--
-- ─── `signee` plutôt que l'accès à la table ────────────────────────────────
--
-- La route doit savoir si le document porte une signature apposée : un document
-- signé absent du coffre ne se refabrique pas, parce que la signature du profil
-- a pu changer depuis. Le booléen répond à cette question sans ouvrir
-- `signatures_apposees`, qui porte le nom du signataire et le chemin d'une
-- copie figée.
create or replace function public.ma_quittance(p_quittance_id uuid)
returns table (
  quittance_id    uuid,
  paiement_id     uuid,
  numero_document text,
  type            public.type_document,
  date_generation timestamptz,
  hash_sha256     text,
  signee          boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    q.id,
    q.paiement_id,
    q.numero_document,
    q.type,
    q.date_generation,
    q.hash_sha256,
    exists (
      select 1
        from public.signatures_apposees s
       where s.quittance_id = q.id
    )
  from public.quittances q
  join public.paiements p on p.id = q.paiement_id
  -- Par le paiement, et surtout pas par `q.bail_id` : voir ci-dessus.
  join public.baux      b on b.id = p.bail_id
  where q.id = p_quittance_id
    and p.statut = 'Validé'
    and b.locataire_id in (select prive.fiches_du_compte());
$$;

comment on function public.ma_quittance(uuid) is
  'Établit qu''une quittance appartient au locataire appelant. Zéro ligne = non. Ne rend jamais le chemin du fichier : la route le relit elle-même, en administration, une fois l''appartenance établie.';

revoke all on function public.ma_quittance(uuid) from public, anon;
grant execute on function public.ma_quittance(uuid) to authenticated;
