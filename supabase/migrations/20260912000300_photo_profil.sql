-- =============================================================================
-- Sikaloc — Photo de profil
--
-- La photo réelle devient la représentation principale du bailleur ; l'avatar
-- reste, comme solution d'attente.
--
-- ─── Ce que cette migration NE fait PAS ─────────────────────────────────────
--
-- Elle ne stocke aucune donnée biométrique. Pas de descripteur facial, pas de
-- gabarit, rien qui permette de reconnaître un visage. L'analyse de la photo se
-- fait entièrement dans le navigateur du bailleur, et seul son verdict —
-- acceptée ou non — atteint le serveur.
--
-- C'est un choix, pas un oubli. Un descripteur facial est une donnée biométrique
-- au sens de l'article 9 du RGPD : catégorie particulière, base légale renforcée,
-- analyse d'impact attendue. Sikaloc n'a aujourd'hui ni mentions légales
-- publiées, ni politique de confidentialité mentionnant de telles données, ni
-- analyse d'impact. Les conserver serait créer une obligation avant d'avoir de
-- quoi la tenir.
--
-- L'architecture est prête à les accueillir le jour où ces conditions seront
-- réunies ; la base, délibérément, ne l'est pas encore.
-- =============================================================================

-- ─── Colonnes ───────────────────────────────────────────────────────────────

alter table public.bailleurs
  add column if not exists photo_chemin text,
  add column if not exists avatar_temporaire_depuis timestamptz;

comment on column public.bailleurs.photo_chemin is
  'Chemin de la photo de profil dans le bucket privé `photos`, jamais une URL. '
  'Renseignée = photo réelle, qui prime sur l''avatar partout.';

comment on column public.bailleurs.avatar_temporaire_depuis is
  'Début de la période où le bailleur se représente par un avatar faute de photo. '
  'NULL = pas de période en cours, soit parce qu''une photo existe, soit parce '
  'qu''elle n''a jamais commencé. Le décompte de 5 jours en dérive.';

-- ─── Portée du chemin ───────────────────────────────────────────────────────
--
-- Même garde que pour les signatures (voir 20260820000200) : la photo est lue
-- côté serveur avec le client admin, donc hors des policies Storage. Sans cette
-- contrainte, un bailleur pourrait écrire sur sa propre ligne le chemin de la
-- photo d'un autre et l'afficher à sa place.

alter table public.bailleurs
  add constraint bailleurs_photo_chemin_scope
  check (
    photo_chemin is null
    or photo_chemin ~ ('^' || id::text || '/photo\.(png|jpe?g|webp)$')
  );

-- ─── Le coffre ──────────────────────────────────────────────────────────────
--
-- Privé, comme les deux autres. Une photo de visage n'a rien à faire sur une
-- URL publique devinable : elle est servie par une URL signée, à durée limitée.
--
-- 3 Mio : au-delà, c'est une photo non recadrée. Le navigateur la réduit avant
-- l'envoi, cette limite n'est qu'un dernier rempart.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos',
  'photos',
  false,
  3145728,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

-- ─── Policies ───────────────────────────────────────────────────────────────
--
-- Le premier segment du chemin porte l'autorisation, comme pour `signatures` :
-- `bailleurs.id` référence `auth.users(id)`, l'égalité est donc vraie.
--
-- Les quatre verbes : l'envoi en upsert exige insert + select + update, et le
-- bailleur doit pouvoir retirer sa photo.

create policy "Un bailleur dépose sa photo"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Un bailleur lit sa photo"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Un bailleur remplace sa photo"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Un bailleur retire sa photo"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ─── Ouverture de la période pour les comptes existants ─────────────────────
--
-- Sans cela, un bailleur déjà inscrit n'aurait aucune date de début et le
-- décompte ne partirait jamais. On part d'aujourd'hui plutôt que de sa date
-- d'inscription : personne ne doit découvrir une période déjà expirée.

update public.bailleurs
   set avatar_temporaire_depuis = now()
 where photo_chemin is null
   and avatar_temporaire_depuis is null;
