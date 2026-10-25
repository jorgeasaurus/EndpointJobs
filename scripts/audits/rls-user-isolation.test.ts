/**
 * Two-user RLS isolation for profiles, user_preferences, saved_jobs, and job_views.
 *
 * Run against local Supabase:
 *   supabase start
 *   supabase db reset
 *   npm run test:rls
 *
 * Connection string: SUPABASE_DB_URL, or the documented local default
 * postgresql://postgres:postgres@127.0.0.1:54322/postgres
 * (that password is the local Supabase default, not a hosted credential).
 *
 * Skips when nothing is accepting connections, including CI without Supabase.
 * If the database is up but the migration is missing, the test fails.
 */
import assert from "node:assert/strict";
import test from "node:test";

import pg from "pg";

const connectionString =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const userA = "00000000-0000-4000-8000-0000000000a1";
const userB = "00000000-0000-4000-8000-0000000000b2";

async function localDatabaseSkipReason(): Promise<string | false> {
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 800 });
  try {
    await client.connect();
    return false;
  } catch {
    return "local Supabase is not accepting connections";
  } finally {
    await client.end().catch(() => undefined);
  }
}

function errorCode(error: unknown) {
  return typeof error === "object" && error && "code" in error && typeof error.code === "string"
    ? error.code
    : "";
}

async function expectRejected(client: pg.Client, run: () => Promise<unknown>) {
  await client.query("savepoint expect_rejected");
  try {
    await run();
  } catch (error) {
    await client.query("rollback to savepoint expect_rejected");
    const code = errorCode(error);
    const message = error instanceof Error ? error.message : String(error);
    assert.ok(
      code === "42501" || code === "22023" || /row-level security|permission denied|authentication required|job id required/i.test(message),
      message
    );
    return;
  }
  await client.query("rollback to savepoint expect_rejected");
  assert.fail("expected the statement to be rejected");
}

async function insertAuthUser(client: pg.Client, id: string, email: string) {
  const { rows } = await client.query<{
    column_name: string;
    is_nullable: "YES" | "NO";
    column_default: string | null;
    data_type: string;
  }>(
    `select column_name, is_nullable, column_default, data_type
     from information_schema.columns
     where table_schema = 'auth' and table_name = 'users'
     order by ordinal_position`
  );
  assert.ok(rows.length > 0, "auth.users is missing; apply the Supabase schema before this test");

  const supplied: Record<string, unknown> = {
    id,
    email,
    aud: "authenticated",
    role: "authenticated",
    instance_id: "00000000-0000-0000-0000-000000000000",
    raw_app_meta_data: { provider: "github", providers: ["github"] },
    raw_user_meta_data: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    email_confirmed_at: new Date().toISOString(),
    confirmation_token: "",
    recovery_token: "",
    email_change: "",
    email_change_token_new: "",
    email_change_token_current: "",
    encrypted_password: "",
    is_sso_user: false,
    is_anonymous: false
  };

  const columns: string[] = [];
  const values: unknown[] = [];
  for (const column of rows) {
    if (!/^[a-z_][a-z0-9_]*$/i.test(column.column_name)) continue;
    if (column.column_name in supplied) {
      columns.push(column.column_name);
      values.push(supplied[column.column_name]);
      continue;
    }
    if (column.is_nullable === "NO" && column.column_default === null) {
      columns.push(column.column_name);
      values.push(fallbackValue(column.data_type));
    }
  }

  const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
  await client.query(
    `insert into auth.users (${columns.join(", ")}) values (${placeholders})`,
    values
  );
}

function fallbackValue(dataType: string) {
  if (dataType === "boolean") return false;
  if (dataType.includes("json")) return {};
  if (dataType.includes("timestamp") || dataType === "date") return new Date().toISOString();
  if (dataType === "uuid") return crypto.randomUUID();
  if (dataType.includes("int") || dataType === "numeric") return 0;
  return "";
}

async function become(client: pg.Client, userId: string | null, role: "authenticated" | "anon") {
  await client.query("reset role");
  await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
  await client.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify(userId ? { sub: userId, role } : { role })
  ]);
  await client.query(`set local role ${role}`);
}

const skip = await localDatabaseSkipReason();

test("neither user can read or write the other's rows, and record_job_view increments", { skip }, async () => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query("begin");
    await insertAuthUser(client, userA, "a@example.com");
    await insertAuthUser(client, userB, "b@example.com");

    await become(client, userA, "authenticated");
    const uid = await client.query<{ uid: string }>("select auth.uid() as uid");
    assert.equal(uid.rows[0]?.uid, userA);

    await client.query(
      `insert into public.profiles (id, email, privacy_version_accepted) values ($1, 'a@example.com', '2026-10-24')`,
      [userA]
    );
    await client.query(
      `insert into public.user_preferences (user_id, filters) values ($1, '{"query":"jamf"}'::jsonb)`,
      [userA]
    );
    await client.query(
      `insert into public.saved_jobs (user_id, job_id, job_snapshot)
       values ($1, 'job-a', '{"title":"Jamf admin","company":"Example","location":"Remote","sourceUrl":"https://example.com/a"}'::jsonb)`,
      [userA]
    );

    await client.query("select public.record_job_view('job-a')");
    await client.query("select public.record_job_view('job-a')");
    const views = await client.query<{ view_count: number }>(
      "select view_count from public.job_views where job_id = 'job-a'"
    );
    assert.equal(views.rows.length, 1);
    assert.equal(Number(views.rows[0]?.view_count), 2);

    await expectRejected(client, () => client.query("select public.record_job_view('   ')"));
    await expectRejected(client, () => client.query("select public.record_job_view(null)"));

    await become(client, userB, "authenticated");
    const foreignProfiles = await client.query("select id, email from public.profiles");
    assert.deepEqual(foreignProfiles.rows, []);
    const foreignPrefs = await client.query("select user_id from public.user_preferences");
    assert.deepEqual(foreignPrefs.rows, []);
    const foreignSaved = await client.query("select user_id, job_id from public.saved_jobs");
    assert.deepEqual(foreignSaved.rows, []);
    const foreignViews = await client.query("select user_id, job_id, view_count from public.job_views");
    assert.deepEqual(foreignViews.rows, []);

    await expectRejected(client, () =>
      client.query(
        `insert into public.profiles (id, email, privacy_version_accepted) values ($1, 'stolen@example.com', 'nope')`,
        [userA]
      )
    );
    await expectRejected(client, () =>
      client.query(
        `insert into public.user_preferences (user_id, filters) values ($1, '{}'::jsonb)`,
        [userA]
      )
    );
    await expectRejected(client, () =>
      client.query(
        `insert into public.saved_jobs (user_id, job_id, job_snapshot) values ($1, 'job-a', '{}'::jsonb)`,
        [userA]
      )
    );
    await expectRejected(client, () =>
      client.query(`insert into public.job_views (user_id, job_id) values ($1, 'job-a')`, [userA])
    );

    const updatedProfile = await client.query("update public.profiles set email = 'stolen@example.com' where id = $1", [userA]);
    assert.equal(updatedProfile.rowCount, 0);
    const updatedPrefs = await client.query("update public.user_preferences set filters = '{}'::jsonb where user_id = $1", [userA]);
    assert.equal(updatedPrefs.rowCount, 0);
    const deletedSaved = await client.query("delete from public.saved_jobs where user_id = $1", [userA]);
    assert.equal(deletedSaved.rowCount, 0);
    const deletedViews = await client.query("delete from public.job_views where user_id = $1", [userA]);
    assert.equal(deletedViews.rowCount, 0);

    await client.query("select public.record_job_view('job-a')");
    const ownView = await client.query<{ view_count: number }>("select view_count from public.job_views");
    assert.equal(ownView.rows.length, 1);
    assert.equal(Number(ownView.rows[0]?.view_count), 1);

    await become(client, null, "anon");
    await expectRejected(client, () => client.query("select id from public.profiles"));
    await expectRejected(client, () => client.query("select public.record_job_view('job-a')"));

    await become(client, userA, "authenticated");
    const profile = await client.query<{ email: string }>("select email from public.profiles where id = $1", [userA]);
    assert.equal(profile.rows[0]?.email, "a@example.com");
    const counts = await client.query<{ view_count: number }>(
      "select view_count from public.job_views where user_id = $1 and job_id = 'job-a'",
      [userA]
    );
    assert.equal(Number(counts.rows[0]?.view_count), 2);
    const prefs = await client.query<{ filters: { query?: string } }>(
      "select filters from public.user_preferences where user_id = $1",
      [userA]
    );
    assert.equal(prefs.rows[0]?.filters.query, "jamf");
    const saved = await client.query<{ job_id: string }>("select job_id from public.saved_jobs");
    assert.deepEqual(saved.rows.map((row) => row.job_id), ["job-a"]);
  } finally {
    await client.query("rollback").catch(() => undefined);
    await client.end().catch(() => undefined);
  }
});
