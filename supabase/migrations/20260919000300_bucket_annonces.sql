-- ═══════════════════════════════════════════════════════════════════════════
-- Sikaloc_Find, S3 — le coffre des photos d'annonce
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ─── Privé, comme les trois autres ─────────────────────────────────────────
--
-- Une photo d'annonce finira sous les yeux du public, mais pas par ici. Elle
-- sera servie par une route qui vérifie d'abord que l'annonce est publiée :
-- un bucket public laisserait lisible la photo d'une annonce suspendue ou
-- clôturée, à une adresse qui ne cesse jamais de répondre.
--
-- ─── Aucune politique, et c'est voulu ──────────────────────────────────────
--
-- Les buckets `signatures` et `photos` laissent leur propriétaire y déposer
-- directement. Celui-ci non : ni `anon` ni `authenticated` ne peuvent y lire,
-- y déposer ou y supprimer quoi que ce soit.
--
-- La raison est l'EXIF. Tout fichier de ce bucket doit être passé par le
-- traitement serveur (`lib/annonces/photos.ts`), qui redresse, réduit et
-- ré-encode l'image sans aucune métadonnée. Une politique d'écriture pour le
-- bailleur ouvrirait un second chemin, direct depuis le navigateur, par
-- lequel l'original — position GPS comprise — atterrirait tel quel.
--
-- Seule la clé de service y écrit, et seulement après que la session du
-- bailleur a établi, par les politiques de `annonces`, que l'annonce est la
-- sienne (`lib/annonces/depot-photos.ts`).
--
-- ─── Les limites ───────────────────────────────────────────────────────────
--
-- 3 Mio : la borne de `annonce_photos_poids_bornes`. Le serveur ne produit
-- que du JPEG ; WebP reste admis parce que le schéma l'admet, et qu'un
-- changement de format de sortie ne doit pas exiger de rouvrir le coffre.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('annonces', 'annonces', false, 3145728, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;
