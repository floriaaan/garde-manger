-- Dev fixtures for the task center: one job per state, none of which the worker
-- will touch. Idempotent — rerun it to refresh the timestamps (finished jobs
-- expire from the list after 48 h).
--   docker exec -i fridge-ai-db-1 psql -U fridge_ai -d fridge_ai < dev/seed-jobs.sql
--
-- "En cours" rows are kept still on purpose: the queued job's run_at and the
-- running job's lease (locked_at) are far in the future, so the worker neither
-- claims the first nor recovers the second.
begin;

with h as (select id from household order by created_at limit 1)
insert into ai_job (id, household_id, kind, status, input, progress, result, error_type, attempts,
                    run_at, locked_at, dismissed_at, started_at, finished_at, created_at)
select v.id, h.id, v.kind, v.status, '{"imageKeys": []}'::jsonb, v.progress::jsonb, v.result::jsonb, v.error_type, 1,
       v.run_at, v.locked_at, v.dismissed_at, v.finished_at - interval '20 seconds', v.finished_at, v.created_at
from h, (values
  ('seed-running-fridge',   'fridge_scan',       'running',   '{"total":4,"done":2,"failed":[]}', null,                              null,                    timestamptz '2099-01-01', timestamptz '2099-01-01', null::timestamptz, null::timestamptz, now() - interval '3 minutes'),
  ('seed-queued-receipt',   'receipt_scan',      'queued',    '{"total":1,"done":0,"failed":[]}', null,                              null,                    timestamptz '2099-01-01', null,                     null,              null,              now() - interval '1 minute'),
  ('seed-ready-fridge',     'fridge_scan',       'succeeded', '{"total":2,"done":2,"failed":[]}', '{"draftId":"seed-draft-ready"}',  null,                    now(),                    null,                     null,              now() - interval '2 hours',  now() - interval '2 hours'),
  ('seed-partial-fridge',   'fridge_scan',       'succeeded', '{"total":3,"done":2,"failed":[1]}','{"draftId":"seed-draft-partial"}',null,                    now(),                    null,                     null,              now() - interval '5 hours',  now() - interval '5 hours'),
  ('seed-recipes',          'recipe_generation', 'succeeded', '{"total":1,"done":1,"failed":[]}', '{"recipeIds":[]}',                null,                    now(),                    null,                     null,              now() - interval '9 hours',  now() - interval '9 hours'),
  ('seed-failed-extract',   'receipt_scan',      'failed',    '{"total":1,"done":0,"failed":[0]}', null,                             'extraction_failed',     now(),                    null,                     null,              now() - interval '1 hour',   now() - interval '1 hour'),
  ('seed-failed-quota',     'fridge_scan',       'failed',    '{"total":2,"done":0,"failed":[0,1]}', null,                           'ai_quota_exceeded',     now(),                    null,                     null,              now() - interval '26 hours', now() - interval '26 hours'),
  ('seed-failed-provider',  'recipe_generation', 'failed',    '{"total":1,"done":0,"failed":[0]}', null,                             'provider_not_configured', now(),                  null,                     null,              now() - interval '30 hours', now() - interval '30 hours'),
  ('seed-hidden-ready',     'fridge_scan',       'succeeded', '{"total":1,"done":1,"failed":[]}', '{"draftId":"seed-draft-hidden"}', null,                    now(),                    null,                     now(),             now() - interval '4 hours',  now() - interval '4 hours'),
  ('seed-hidden-failed',    'receipt_scan',      'failed',    '{"total":1,"done":0,"failed":[0]}', null,                             'extraction_failed',     now(),                    null,                     now(),             now() - interval '6 hours',  now() - interval '6 hours')
) as v(id, kind, status, progress, result, error_type, run_at, locked_at, dismissed_at, finished_at, created_at)
on conflict (id) do update set
  status = excluded.status, progress = excluded.progress, result = excluded.result, error_type = excluded.error_type,
  run_at = excluded.run_at, locked_at = excluded.locked_at, dismissed_at = excluded.dismissed_at,
  started_at = excluded.started_at, finished_at = excluded.finished_at, created_at = excluded.created_at;

-- Running / queued rows have no end.
update ai_job set finished_at = null, started_at = case when status = 'running' then created_at else null end
where id in ('seed-running-fridge', 'seed-queued-receipt');

insert into scan_draft (id, household_id, job_id, kind, payload, image_keys, status, expires_at, created_at)
select d.id, j.household_id, j.id, 'fridge',
       '{"items":[
          {"name":"Lait demi-écrémé","unit":"L","category":"dairy","location":"fridge","quantity":1,"expiresInDays":5},
          {"name":"Yaourts nature","unit":"pièce","category":"dairy","location":"fridge","quantity":4,"expiresInDays":12},
          {"name":"Petits pois","unit":"g","category":"vegetable","location":"freezer","quantity":600,"expiresInDays":180},
          {"name":"Pâtes","unit":"g","category":"grain","location":"pantry","quantity":500,"expiresInDays":null}
        ]}'::jsonb,
       '[]'::jsonb, 'pending', timestamptz '2099-01-01', j.created_at
from (values ('seed-draft-ready', 'seed-ready-fridge'), ('seed-draft-partial', 'seed-partial-fridge'), ('seed-draft-hidden', 'seed-hidden-ready')) as d(id, job_id)
join ai_job j on j.id = d.job_id
on conflict (id) do update set status = 'pending', expires_at = excluded.expires_at, created_at = excluded.created_at;

commit;
