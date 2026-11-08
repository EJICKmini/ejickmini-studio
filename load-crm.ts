/**
 * load-crm.ts — fallback CRM path. Reads crm-snapshot.json (written by the CEO when it cannot
 * reach Neon) and upserts each row into public.businesses (Neon project website-studio-crm),
 * using NEON_DATABASE_URL from .env.
 *
 *   npm run load-crm                 # reads ./crm-snapshot.json
 *   npm run load-crm -- other.json   # reads another file
 *
 * Matching: a row is the same business when lower(trim(name)) and lower(trim(country)) match,
 * so rerunning never creates duplicates. Existing rows get only the fields present in the
 * snapshot (absent keys are left alone); created_at is kept and updated_at is set to now().
 * New rows get the snapshot's id, or a stable id derived from name + country.
 * Accepts either a JSON array of rows or { "businesses": [...] }.
 * Never prints the connection string.
 */
import "./load-env.js";
import pg from "pg";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const COLUMNS = [
  "id", "name", "city", "country", "what_they_do", "current_site_url", "evidence_quote",
  "evidence_url", "status", "chosen", "demo_url", "demo_notes", "outreach_draft",
  "outreach_status", "ops_plan", "created_at", "updated_at",
] as const;
// Fields a snapshot may set. id/created_at/updated_at are managed here.
const WRITABLE = COLUMNS.filter((c) => !["id", "created_at", "updated_at"].includes(c));

type Row = Record<string, unknown>;

const file = resolve(process.cwd(), process.argv[2] ?? "crm-snapshot.json");
if (!existsSync(file)) {
  console.error(`No snapshot at ${file}`);
  process.exit(1);
}
const raw = JSON.parse(readFileSync(file, "utf8"));
const rows: Row[] = Array.isArray(raw) ? raw : Array.isArray(raw?.businesses) ? raw.businesses : [];
if (rows.length === 0) {
  console.error("Snapshot has no rows (expected an array or { businesses: [...] }).");
  process.exit(1);
}

const url = process.env.NEON_DATABASE_URL;
if (!url) {
  console.error("NEON_DATABASE_URL is missing from .env.");
  process.exit(1);
}

const norm = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());
const stableId = (name: string, country: string) =>
  "biz_" + createHash("sha1").update(`${name.toLowerCase()}|${country.toLowerCase()}`).digest("hex").slice(0, 16);

function coerce(col: string, v: unknown): unknown {
  if (v === undefined) return undefined;
  if (col === "chosen") return v === true || v === "true" || v === 1;
  if (v === null) return null;
  return typeof v === "string" ? v : JSON.stringify(v); // e.g. an ops_plan written as an object
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: true } });
await client.connect();

// Guard: make sure this URL points at a database with the expected businesses table.
const cols = await client.query(
  `select column_name from information_schema.columns where table_schema='public' and table_name='businesses'`,
);
const have = new Set(cols.rows.map((r) => r.column_name));
const missing = COLUMNS.filter((c) => !have.has(c));
if (missing.length) {
  console.error(`public.businesses is missing columns: ${missing.join(", ")}. Wrong database?`);
  await client.end();
  process.exit(1);
}

let inserted = 0, updated = 0, skipped = 0;
try {
  await client.query("begin");
  for (const [i, row] of rows.entries()) {
    const name = norm(row.name);
    const country = norm(row.country);
    if (!name) {
      console.warn(`row ${i}: no name, skipped`);
      skipped++;
      continue;
    }
    const fields: Record<string, unknown> = {};
    for (const c of WRITABLE) {
      const v = coerce(c, row[c]);
      if (v !== undefined) fields[c] = v;
    }
    fields.name = name;
    if (row.country !== undefined) fields.country = country || null;

    const existing = await client.query(
      `select id from public.businesses
         where lower(trim(name)) = lower($1) and lower(coalesce(trim(country), '')) = lower($2)
         order by created_at limit 1 for update`,
      [name, country],
    );
    const keys = Object.keys(fields);
    const vals = keys.map((k) => fields[k]);
    if (existing.rowCount) {
      const set = keys.map((k, j) => `${k} = $${j + 1}`).join(", ");
      await client.query(
        `update public.businesses set ${set}, updated_at = now() where id = $${keys.length + 1}`,
        [...vals, existing.rows[0].id],
      );
      updated++;
    } else {
      const id = norm(row.id) || stableId(name, country);
      const allKeys = ["id", ...keys];
      await client.query(
        `insert into public.businesses (${allKeys.join(", ")}) values (${allKeys.map((_, j) => `$${j + 1}`).join(", ")})`,
        [id, ...vals],
      );
      inserted++;
    }
  }
  await client.query("commit");
} catch (err) {
  await client.query("rollback");
  console.error("Rolled back:", (err as Error).message);
  await client.end();
  process.exit(1);
}
const total = await client.query("select count(*)::int as n from public.businesses");
await client.end();
console.log(`load-crm: ${inserted} inserted, ${updated} updated, ${skipped} skipped. businesses rows now: ${total.rows[0].n}`);
