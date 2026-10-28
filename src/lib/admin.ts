import { query } from "./db";

export async function platformStats() {
  const [t] = await query(`
    select
      (select count(*)::int from users) as users,
      (select count(*)::int from users where suspended) as suspended,
      (select count(*)::int from users where role = 'admin') as admins,
      (select count(*)::int from users where created_at > now() - interval '7 days') as new_users_7d,
      (select count(*)::int from forms) as forms,
      (select count(*)::int from forms where published) as published_forms,
      (select count(*)::int from responses) as responses,
      (select count(*)::int from responses where submitted_at > now() - interval '7 days') as responses_7d,
      (select count(*)::int from deliveries where status = 'failed' and created_at > now() - interval '7 days') as failed_deliveries_7d,
      (select count(*)::int from error_log where created_at > now() - interval '24 hours') as errors_24h
  `);
  const daily = await query<{ date: string; views: number; starts: number; completed: number }>(`
    select to_char(d, 'YYYY-MM-DD') as date,
      (select count(*) from users u where u.created_at >= d and u.created_at < d + interval '1 day')::int as views,
      (select count(*) from forms f where f.created_at >= d and f.created_at < d + interval '1 day')::int as starts,
      (select count(*) from responses r where r.submitted_at >= d and r.submitted_at < d + interval '1 day')::int as completed
    from generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') d order by d`);
  return { ...t, daily };
}
