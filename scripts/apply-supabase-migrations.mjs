/**
 * Supabase Postgres üzerinde migration dosyalarını sırayla uygular.
 * .env.local veya ortamda DATABASE_URL tanımlı olmalı (Dashboard → Database → URI).
 * Not: Public anon key DDL çalıştıramaz; doğrudan Postgres bağlantısı kullanılır.
 */

import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const MIGRATION_FILES = [
  "20260429120000_initial_nova_schema.sql",
  "20260429140000_revenue_entries.sql",
  "20260429160000_expenses.sql",
  "20260429203000_staff_anon_select.sql",
  "20260429210000_production_hardening.sql",
  "20260429230000_appointment_overlap_enforcement.sql",
  "20260429240000_appointment_status_message_sent.sql",
  "20260429310000_business_rules_profiles_services_revenue.sql",
  "20260429320000_profiles_staff_link.sql",
  "20260429450000_rls_finance_strict.sql",
  "20260505120000_enforce_appointment_overlap_planned_duration.sql",
  "20260506000000_staff_time_off_and_search.sql",
  "20260507200000_liberate_cancelled_slots.sql",
  "20260923120000_profiles_rls_admin_only.sql",
  "20260923130000_payment_corrections.sql",
];

/** Objeler zaten varsa (eski ortam / manuel kurulum) çalıştırmadan işaretler. */
async function migrationAlreadyPresent(sql, filename) {
  switch (filename) {
    case "20260429120000_initial_nova_schema.sql": {
      const [r] = await sql`
        SELECT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE n.nspname = 'public' AND t.typname = 'appointment_status'
        ) AS ok
      `;
      return r.ok;
    }
    case "20260429140000_revenue_entries.sql": {
      const [r] = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'revenue_entries'
        ) AS ok
      `;
      return r.ok;
    }
    case "20260429160000_expenses.sql": {
      const [r] = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'expenses'
        ) AS ok
      `;
      return r.ok;
    }
    case "20260429203000_staff_anon_select.sql": {
      const [r] = await sql`
        SELECT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename = 'staff'
            AND policyname = 'Anyone can read staff'
        ) AS ok
      `;
      return r.ok;
    }
    case "20260429210000_production_hardening.sql": {
      const [r] = await sql`
        SELECT NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename = 'services'
            AND policyname = 'Anyone can read services'
        ) AS ok
      `;
      return r.ok;
    }
    case "20260429230000_appointment_overlap_enforcement.sql": {
      const [r] = await sql`
        SELECT EXISTS (
          SELECT 1 FROM pg_trigger
          WHERE tgname = 'appointments_staff_overlap_check'
        ) AS ok
      `;
      return r.ok;
    }
    case "20260429240000_appointment_status_message_sent.sql": {
      const [r] = await sql`
        SELECT EXISTS (
          SELECT 1
          FROM pg_enum e
          JOIN pg_type t ON e.enumtypid = t.oid
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE n.nspname = 'public'
            AND t.typname = 'appointment_status'
            AND e.enumlabel = 'message_sent'
        ) AS ok
      `;
      return r.ok;
    }
    case "20260429310000_business_rules_profiles_services_revenue.sql": {
      const [r] = await sql`
        SELECT EXISTS (
          SELECT 1 FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE n.nspname = 'public' AND t.typname = 'user_role'
        ) AS ok
      `;
      return r.ok;
    }
    case "20260429320000_profiles_staff_link.sql": {
      const [r] = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'profiles'
            AND column_name = 'staff_id'
        ) AS ok
      `;
      return r.ok;
    }
    case "20260429450000_rls_finance_strict.sql": {
      const [r] = await sql`
        SELECT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename = 'revenue_entries'
            AND policyname = 'Admin full access revenue_entries'
        ) AS ok
      `;
      return r.ok;
    }
    case "20260505120000_enforce_appointment_overlap_planned_duration.sql": {
      const [r] = await sql`
        SELECT EXISTS (
          SELECT 1
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public'
            AND p.proname = 'enforce_appointment_staff_overlap'
            AND pg_get_functiondef(p.oid) LIKE '%NULLIF(NEW.planned_duration, 0)%'
        ) AS ok
      `;
      return r.ok;
    }
    case "20260506000000_staff_time_off_and_search.sql": {
      const [r] = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'staff_time_off'
        ) AS ok
      `;
      return r.ok;
    }
    case "20260507200000_liberate_cancelled_slots.sql": {
      const [r] = await sql`
        SELECT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE schemaname = 'public'
            AND indexname = 'appointments_staff_slot_active_unique'
        ) AS ok
      `;
      return r.ok;
    }
    case "20260923120000_profiles_rls_admin_only.sql": {
      const [r] = await sql`
        SELECT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename = 'profiles'
            AND policyname = 'Profiles select own or admin'
        ) AS ok
      `;
      return r.ok;
    }
    case "20260923130000_payment_corrections.sql": {
      const [r] = await sql`
        SELECT (
          EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'payment_corrections'
          )
          AND EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = 'correct_appointment_payment'
          )
        ) AS ok
      `;
      return r.ok;
    }
    default:
      return false;
  }
}

function loadEnvFile(relPath) {
  const full = join(root, relPath);
  if (!existsSync(full)) return;
  const text = readFileSync(full, "utf8");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const databaseUrl =
    process.env.DATABASE_URL?.trim() ||
    process.env.SUPABASE_DB_URL?.trim() ||
    "";

  if (!databaseUrl) {
    console.error(
      "DATABASE_URL tanımlı değil.\n" +
        "Supabase Dashboard → Project Settings → Database → Connection string → URI\n" +
        "değerini .env.local içine ekleyin (şifre ile birlikte).\n" +
        "Ardından: npm run supabase:migrate"
    );
    process.exit(1);
  }

  try {
    const normalized = databaseUrl.replace(/^postgresql:/i, "http:");
    const u = new URL(normalized);
    const host = u.hostname;
    if (/^db\..+\.supabase\.co$/i.test(host)) {
      console.error(`
[HATA] DATABASE_URL içindeki host "${host}" çoğu projede DNS'te çözülmez (ENOTFOUND).

Ne yapmalısınız:
1. Supabase Dashboard → Settings → Database
2. "Connection string" → URI
3. Transaction pooler veya Session pooler seçin
4. Host ...pooler.supabase.com olmalı (db.PROJE.supabase.co DEĞİL)
5. Tek satırı DATABASE_URL olarak .env.local'e yapıştırın

Tekrar: npm run supabase:migrate
`);
      process.exit(1);
    }
  } catch {
    console.error(
      "DATABASE_URL okunamadı; geçerli bir postgresql://... adresi olduğundan emin olun."
    );
    process.exit(1);
  }

  const sql = postgres(databaseUrl, {
    max: 1,
    ssl: databaseUrl.includes("localhost") ? false : "require",
  });

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS public._nova_schema_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `;

    for (const name of MIGRATION_FILES) {
      const migrationPath = join(root, "supabase/migrations", name);
      if (!existsSync(migrationPath)) {
        console.error("Dosya bulunamadı:", migrationPath);
        process.exit(1);
      }
      const body = readFileSync(migrationPath, "utf8");

      const [recorded] = await sql`
        SELECT 1 AS ok FROM public._nova_schema_migrations WHERE filename = ${name}
      `;
      if (recorded) {
        console.error("⊘ Kayıtlı (atlanıyor):", name);
        continue;
      }

      if (await migrationAlreadyPresent(sql, name)) {
        await sql`
          INSERT INTO public._nova_schema_migrations (filename)
          VALUES (${name})
          ON CONFLICT (filename) DO NOTHING
        `;
        console.error("⊘ Zaten uygulanmış (baseline):", name);
        continue;
      }

      console.error("→ Uygulanıyor:", name);
      await sql.unsafe(body);
      await sql`
        INSERT INTO public._nova_schema_migrations (filename)
        VALUES (${name})
        ON CONFLICT (filename) DO NOTHING
      `;
      console.error("  tamam.");
    }
    console.error("\nMigration kontrolü tamam.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
