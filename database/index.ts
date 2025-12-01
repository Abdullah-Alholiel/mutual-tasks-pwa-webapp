import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getServiceSupabaseClient } from './supabaseClient';

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'database/migrations');

const ensureMigrationsDir = async () => {
  try {
    await fs.access(MIGRATIONS_DIR);
  } catch {
    await fs.mkdir(MIGRATIONS_DIR, { recursive: true });
  }
};

const listMigrationFiles = async (): Promise<string[]> => {
  const files = await fs.readdir(MIGRATIONS_DIR);
  return files
    .filter((file) => file.endsWith('.sql'))
    .sort();
};

const planMigrations = async () => {
  const files = await listMigrationFiles();
  if (files.length === 0) {
    console.info('No SQL migrations found yet. Add files to database/migrations/*.sql');
    return;
  }

  console.info('Pending migrations:');
  files.forEach((file) => console.info(`  • ${file}`));
};

const ensureSeedProject = async () => {
  const supabase = getServiceSupabaseClient();
  const seedProjectName = process.env.SEED_PROJECT_NAME || 'Momentum Pilot';

  try {
    const { data, error } = await supabase
      .from('projects')
      .select('id')
      .eq('name', seedProjectName)
      .maybeSingle();

    if (error) {
      console.warn('projects table is not ready yet. Run migrations before seeding.');
      return;
    }

    if (!data) {
      console.info(`Seed project "${seedProjectName}" not found. Add an insert step once migrations are applied.`);
    } else {
      console.info(`Seed project "${seedProjectName}" already exists (id: ${data.id}).`);
    }
  } catch (err) {
    console.warn('Unable to verify seed project. Did you run migrations?', err);
  }
};

const main = async () => {
  await ensureMigrationsDir();
  await planMigrations();
  await ensureSeedProject();

  console.info('Supabase connection verified. Extend database/index.ts to push migrations or seed data.');
};

main().catch((error) => {
  console.error('Database bootstrap failed:', error);
  process.exit(1);
});
