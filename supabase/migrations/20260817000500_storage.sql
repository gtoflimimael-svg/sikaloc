-- =============================================================================
-- Sikaloc — Stockage des documents
-- Référence : spec §9.2 « Bucket privé Supabase. URLs signées, expiration 30 j. »
--
-- Convention de chemin : <bailleur_id>/<fichier>. C'est le premier segment qui
-- porte l'autorisation, via storage.foldername(name)[1].
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('quittances', 'quittances', false, 5242880,
   array['application/pdf']),
  ('signatures', 'signatures', false, 2097152,
   array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- ─── Quittances ─────────────────────────────────────────────────────────────
-- Écriture réservée au générateur PDF côté serveur (service_role) : une
-- quittance ne doit jamais pouvoir être déposée depuis le navigateur.
-- Le bailleur conserve un accès en lecture directe à ses propres documents.

create policy "Un bailleur lit ses quittances stockées"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'quittances'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ─── Signatures ─────────────────────────────────────────────────────────────
-- Le remplacement d'une signature est un upsert : il exige INSERT + SELECT +
-- UPDATE. N'accorder qu'INSERT ferait échouer le remplacement en silence.

create policy "Un bailleur dépose sa signature"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'signatures'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Un bailleur lit sa signature"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'signatures'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Un bailleur remplace sa signature"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'signatures'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'signatures'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Un bailleur supprime sa signature"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'signatures'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
