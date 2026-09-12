-- ═══════════════════════════════════════════════════════════════════════════
-- Un troisième canal : la vérification administrative
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ─── Le problème qu'il règle ───────────────────────────────────────────────
--
-- La vérification du téléphone est obligatoire depuis la migration précédente,
-- et aucun fournisseur SMS ou WhatsApp n'est encore branché. Conséquence
-- mécanique : plus personne n'entre dans l'application, et il n'existe aucun
-- chemin pour en sortir.
--
-- ─── Pourquoi une valeur de plus, et pas un mensonge ───────────────────────
--
-- Débloquer un compte en écrivant `canal = 'SMS'` aurait été simple, et faux :
-- la base aurait affirmé qu'un SMS avait été envoyé et son code validé, alors
-- que rien de tel n'a eu lieu. Cette trace est censée servir un jour à une
-- enquête de sécurité ; une trace qui ment est pire qu'une trace absente.
--
-- `ADMIN` dit ce qui s'est réellement passé : quelqu'un ayant accès à la base
-- a attesté du numéro, sans qu'aucun code ne circule. C'est une garantie plus
-- faible, et elle est nommée comme telle.
--
-- ─── Ce que ce canal n'est pas ─────────────────────────────────────────────
--
-- Il n'est proposé nulle part dans l'interface. `CanalTelephone`
-- (src/lib/verification/regles.ts) ne connaît toujours que SMS et WHATSAPP :
-- c'est le type de ce qu'un utilisateur peut choisir. `ADMIN` n'existe que
-- comme valeur stockée, posée à la main, jamais atteignable depuis un
-- formulaire ni depuis une action serveur.
--
-- Il ne dispense de rien non plus : le jour où un canal réel existera, un
-- compte marqué `ADMIN` reste vérifié, mais tout nouveau compte passera par un
-- vrai code. Ce n'est pas une porte dérobée permanente, c'est le constat d'une
-- période où le produit exigeait une preuve qu'il ne savait pas encore
-- demander.

-- ─── La contrainte change de nom, et ce n'est pas cosmétique ───────────────
--
-- `generer-objets-schema.ts` retire de la liste surveillée tout objet qu'un
-- `drop ... if exists` mentionne. Reposer la contrainte sous le MÊME nom la
-- faisait donc sortir de la surveillance : elle existait en base, mais plus
-- rien ne l'aurait signalée si elle venait à disparaître.
--
-- Le nouveau nom est déclaré et jamais supprimé ; l'ancien est supprimé et
-- jamais redéclaré. Le compte reste juste des deux côtés.
alter table public.bailleurs
  drop constraint if exists bailleurs_canal_verification_coherent;

alter table public.bailleurs
  add constraint bailleurs_canal_verification_valide check (
    (telephone_verifie_le is null and telephone_canal_verification is null)
    or (telephone_verifie_le is not null
        and telephone_canal_verification in ('SMS', 'WHATSAPP', 'ADMIN'))
  );

comment on column public.bailleurs.telephone_canal_verification is
  'Canal du code validé : SMS ou WHATSAPP. ADMIN = attestation manuelle en base, sans code envoyé — garantie plus faible, nommée comme telle.';
