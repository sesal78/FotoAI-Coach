-- Refactor 2C: gear capability catalog (read-only for users), links from a user's gear to it,
-- and the user's current loadout. Additive. Apply to production only with Seun's approval:
--   psql -1 -v ON_ERROR_STOP=1 -f - < this file
-- The seed between the markers is generated from packages/core/src/gear/catalog.ts
-- (node packages/core/scripts/catalog-sql.ts); a test keeps them identical.
-- Verify: select (select count(*) from public.fotoai_gear_bodies) as bodies, (select count(*) from public.fotoai_gear_lenses) as lenses;
-- Undo:   supabase/undo/20261019100001_gear_catalog.undo.sql

create table public.fotoai_gear_lenses (
  id text primary key,
  make text not null,
  model text not null,
  mount text,
  focal_min_mm numeric not null check (focal_min_mm > 0),
  focal_max_mm numeric not null check (focal_max_mm >= focal_min_mm),
  max_aperture_wide numeric not null check (max_aperture_wide > 0),
  max_aperture_tele numeric not null check (max_aperture_tele >= max_aperture_wide),
  min_aperture numeric not null check (min_aperture > max_aperture_tele),
  sources text[] not null check (cardinality(sources) > 0)
);

create table public.fotoai_gear_bodies (
  id text primary key,
  make text not null,
  model text not null,
  type text not null check (type in ('digital', 'film')),
  mount text,
  modes text[] not null check (cardinality(modes) > 0 and modes <@ array['P', 'A', 'S', 'M']::text[]),
  shutter_slowest_s numeric,
  shutter_fastest_s numeric not null check (shutter_fastest_s > 0),
  bulb boolean,
  shutter_aperture_limits jsonb,
  flash_sync_s numeric,
  iso_min integer,
  iso_max integer,
  metering text,
  fixed_lens_id text references public.fotoai_gear_lenses (id),
  sources text[] not null check (cardinality(sources) > 0),
  check (shutter_slowest_s is null or shutter_slowest_s > shutter_fastest_s),
  check ((iso_min is null) = (iso_max is null) and (iso_min is null or iso_min <= iso_max))
);

-- Shared read for signed-in users; written only by migrations.
alter table public.fotoai_gear_lenses enable row level security;
alter table public.fotoai_gear_bodies enable row level security;
revoke all on table public.fotoai_gear_lenses, public.fotoai_gear_bodies from anon, authenticated;
grant select on table public.fotoai_gear_lenses, public.fotoai_gear_bodies to authenticated;
create policy fotoai_gear_lenses_read on public.fotoai_gear_lenses for select to authenticated using (true);
create policy fotoai_gear_bodies_read on public.fotoai_gear_bodies for select to authenticated using (true);

-- BEGIN CATALOG SEED
insert into public.fotoai_gear_lenses
  (id, make, model, mount, focal_min_mm, focal_max_mm, max_aperture_wide, max_aperture_tele, min_aperture, sources)
values
  ('fujifilm-xf-23mm-f2-8', 'Fujifilm', 'XF 23mm F2.8 R WR', 'Fujifilm X', 23, 23, 2.8, 2.8, 16, array['https://www.fujifilm-x.com/zh-cn/products/lenses/xf23mmf28-r-wr/specifications/']::text[]),
  ('fujifilm-xf-70-300mm-f4-5-6', 'Fujifilm', 'XF 70-300mm F4-5.6 R LM OIS WR', 'Fujifilm X', 70, 300, 4, 5.6, 22, array['https://www.fujifilm-x.com/en-us/products/lenses/xf70-300mmf4-5.6-r-lm-ois-wr/specifications/']::text[]),
  ('sigma-18-50mm-f2-8-dc-dn-x', 'Sigma', '18-50mm F2.8 DC DN Contemporary (Fujifilm X)', 'Fujifilm X', 18, 50, 2.8, 2.8, 22, array['https://www.sigma-global.com/en/lenses/c021_18_50_28/specification.html']::text[]),
  ('nikon-ai-s-28mm-f2-8', 'Nikon', 'AI-S Nikkor 28mm f/2.8', 'Nikon F', 28, 28, 2.8, 2.8, 22, array['https://imaging-resource.com/lenses/nikon/28mm-f2.8-ais-nikkor/specifications', 'https://kenrockwell.com/nikon/28f28ais.htm']::text[]),
  ('nikon-ai-s-50mm-f1-4', 'Nikon', 'AI-S Nikkor 50mm f/1.4', 'Nikon F', 50, 50, 1.4, 1.4, 16, array['https://imaging-resource.com/lenses/nikon/50mm-f1.4-ais-nikkor/specifications']::text[]),
  ('pentax-m-28mm-f2-8', 'Pentax', 'SMC Pentax-M 28mm f/2.8', 'Pentax K', 28, 28, 2.8, 2.8, 22, array['https://cinelenswiki.com/lens:pen-msmc28mmf2.8ver1']::text[]),
  ('pentax-m-50mm-f1-7', 'Pentax', 'SMC Pentax-M 50mm f/1.7', 'Pentax K', 50, 50, 1.7, 1.7, 22, array['https://cinelenswiki.com/lens:pen-msmc50mmf1.7', 'https://kenrockwell.com/pentax/35mm/lenses/50mm-f17-smc-m.htm']::text[]),
  ('ricoh-gr-iiix-26-1mm-f2-8', 'Ricoh', 'GR IIIx built-in 26.1mm f/2.8', null, 26.1, 26.1, 2.8, 2.8, 16, array['https://us.ricoh-imaging.com/product/gr-iiix/']::text[]),
  ('yashica-electro-35-gl-40mm-f1-7', 'Yashica', 'Electro 35 GL built-in Color-Yashinon DX 40mm f/1.7', null, 40, 40, 1.7, 1.7, 16, array['https://camera-wiki.org/wiki/Yashica_Electro_35', 'https://photoethnography.com/ClassicCameras/YashicaElectro35GX.html']::text[]);

insert into public.fotoai_gear_bodies
  (id, make, model, type, mount, modes, shutter_slowest_s, shutter_fastest_s, bulb, shutter_aperture_limits,
   flash_sync_s, iso_min, iso_max, metering, fixed_lens_id, sources)
values
  ('fujifilm-x-t5', 'Fujifilm', 'X-T5', 'digital', 'Fujifilm X', array['P', 'A', 'S', 'M']::text[], 900, 0.000125, true, null, 0.004, 125, 12800, 'multi (256-zone), spot, average, centre-weighted', null, array['https://www.fujifilm-x.com/en-us/products/cameras/x-t5/specifications/']::text[]),
  ('ricoh-gr-iiix', 'Ricoh', 'GR IIIx', 'digital', null, array['P', 'A', 'S', 'M']::text[], 30, 0.00025, true, '[{"belowAperture":5.6,"fastestSeconds":0.0004}]'::jsonb, null, 100, 102400, 'multi-segment, centre-weighted, spot, highlight-weighted', 'ricoh-gr-iiix-26-1mm-f2-8', array['https://us.ricoh-imaging.com/product/gr-iiix/', 'https://www.imaging-resource.com/PRODS/ricoh-gr-iiix/ricoh-gr-iiixDAT.HTM']::text[]),
  ('nikon-fe2', 'Nikon', 'FE2', 'film', 'Nikon F', array['A', 'M']::text[], 8, 0.00025, true, null, 0.004, 12, 4000, 'centre-weighted (60/40)', null, array['https://en.wikipedia.org/wiki/Nikon_FE2', 'https://www.eecs.yorku.ca/~oz/nikon/bodylens/FE-2.htm', 'https://butkus.org/chinon/nikon/nikon_fe2/nikon_fe2.htm']::text[]),
  ('pentax-me-super', 'Pentax', 'ME Super', 'film', 'Pentax K', array['A', 'M']::text[], 4, 0.0005, true, null, 0.008, 12, 1600, 'centre-weighted, open aperture', null, array['https://en.wikipedia.org/wiki/Pentax_ME_Super', 'https://vintagecameradigest.com/pentax-me-super/']::text[]),
  ('yashica-electro-35-gl', 'Yashica', 'Electro 35 GL', 'film', null, array['A']::text[], null, 0.002, null, null, null, null, null, null, 'yashica-electro-35-gl-40mm-f1-7', array['https://skrasnov.com/yashica-electro-35-gl/', 'https://camera-wiki.org/wiki/Yashica_Electro_35']::text[]);
-- END CATALOG SEED

-- A user's gear may link one catalog body or lens, or carry custom capability data.
alter table public.fotoai_user_gear add column body_id text references public.fotoai_gear_bodies (id);
alter table public.fotoai_user_gear add column lens_id text references public.fotoai_gear_lenses (id);
alter table public.fotoai_user_gear add column custom jsonb;
alter table public.fotoai_user_gear
  add constraint fotoai_user_gear_one_link_check
  check (num_nonnulls(body_id, lens_id, custom) <= 1);

-- What the user carries today: gear row ids plus an optional film load (validated in code).
alter table public.fotoai_user_preferences add column loadout jsonb;
