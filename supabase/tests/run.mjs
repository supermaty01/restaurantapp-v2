#!/usr/bin/env node
/**
 * Runs the .test.sql files against the real migration chain.
 *
 * Each test file gets its **own** database, built from zero: drop, create, load
 * the auth stub, apply every migration in order, load the shared helpers, then
 * run the file. That is slower than sharing one database, but a suite where one
 * file's fixtures leak into the next one's counts is a suite that fails for
 * reasons unrelated to the code — and worse, can pass for them too.
 *
 * This exercises what app-level unit tests cannot reach: RLS policies, triggers
 * and security-definer functions, as Postgres actually executes them.
 *
 * Necesita un Postgres: o `supabase start` levantado (docs/13), o `DATABASE_URL`
 * apuntando a uno desechable — que es como corre en CI.
 */
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(here, '..', 'migrations');
const DB = 'migcheck';

/**
 * Cómo llegar a un Postgres, en orden de preferencia.
 *
 * Dos caminos porque hay dos sitios donde esto corre. En local es el contenedor
 * de `supabase start`, que es lo que hay a mano. En CI no hay Supabase: hay un
 * servicio de Postgres y un `psql` en el runner, y montar la CLI entera de
 * Supabase para lanzar unos ficheros SQL sería pagar minutos por nada.
 *
 * Antes solo existía el primero, así que estas pruebas —las únicas que
 * comprueban que las políticas RLS dicen lo que creemos— no podían correr en CI
 * y dependían de que alguien tuviera Docker levantado ese día. ESTADO.md lo
 * cuenta: «esta ronda hubo Docker, así que por primera vez en tres sesiones las
 * aserciones SQL se pudieron correr».
 */
function findTarget() {
  if (process.env.DATABASE_URL) {
    return { kind: 'url', url: process.env.DATABASE_URL, label: 'DATABASE_URL' };
  }

  try {
    const names = execSync('docker ps --format "{{.Names}}"', { encoding: 'utf8' });
    const match = names.split('\n').find((n) => n.startsWith('supabase_db_'));
    if (match) return { kind: 'docker', container: match.trim(), label: match.trim() };
  } catch {
    // Sin docker instalado o sin demonio: se cae al mensaje de abajo, que dice
    // las dos formas de arreglarlo en vez de solo una.
  }

  throw new Error(
    'No hay a qué base conectarse. Levanta `supabase start` (docs/13) o exporta ' +
      'DATABASE_URL apuntando a un Postgres desechable.',
  );
}

/** El nombre de la base dentro de la URL, que cambia por test. */
function urlFor(base, database) {
  const url = new URL(base);
  url.pathname = `/${database}`;
  return url.toString();
}

function psql(target, args, input, { database = DB } = {}) {
  // spawnSync, not execFileSync: psql writes RAISE NOTICE (i.e. the passing
  // checks) to stderr, and both streams are needed to report a run.
  const [command, argv] =
    target.kind === 'docker'
      ? ['docker', ['exec', '-i', target.container, 'psql', '-U', 'postgres', ...args]]
      : ['psql', [urlFor(target.url, database), ...args]];

  const result = spawnSync(command, argv, { input, encoding: 'utf8' });
  return {
    ok: result.status === 0,
    out: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

function runFile(target, file, label, { quiet = false } = {}) {
  const { ok, out } = psql(
    target,
    // Con URL el nombre de la base va dentro de la propia URL, así que `-d`
    // sobra y además la pisaría.
    target.kind === 'docker'
      ? ['-d', DB, '-v', 'ON_ERROR_STOP=1', '-q']
      : ['-v', 'ON_ERROR_STOP=1', '-q'],
    readFileSync(file, 'utf8'),
  );

  if (!ok) {
    console.error(`\n✖ ${label} failed:\n${out.trim()}`);
    return false;
  }

  if (!quiet) {
    const checks = out
      .split('\n')
      .filter((line) => line.includes('ok:'))
      .map((line) => `  ${line.replace(/^NOTICE:\s*ok:\s*/, '✓ ').trim()}`);
    if (checks.length) console.log(checks.join('\n'));
  }
  return true;
}

/** Rebuilds the schema from scratch. Returns false if any migration fails. */
function freshDatabase(target) {
  // El drop/create va contra otra base, no contra la que se está borrando: por
  // docker es la de por defecto de psql, y por URL hay que decirlo.
  const admin = { database: 'postgres' };
  psql(target, ['-q', '-c', `drop database if exists ${DB} with (force)`], undefined, admin);
  psql(target, ['-q', '-c', `create database ${DB}`], undefined, admin);

  let ok = runFile(target, join(here, 'auth-stub.sql'), 'auth stub', { quiet: true });

  for (const name of readdirSync(migrationsDir).sort()) {
    if (!name.endsWith('.sql')) continue;
    ok = runFile(target, join(migrationsDir, name), name, { quiet: true }) && ok;
  }

  return runFile(target, join(here, 'helpers.sql'), 'helpers', { quiet: true }) && ok;
}

const target = findTarget();
console.log(`Using ${target.label}`);

const testFiles = readdirSync(here)
  .filter((name) => name.endsWith('.test.sql'))
  .sort();

if (testFiles.length === 0) {
  console.error('No .test.sql files found.');
  process.exit(1);
}

let ok = true;
for (const name of testFiles) {
  console.log(`\n── ${name}`);
  if (!freshDatabase(target)) {
    ok = false;
    continue;
  }
  ok = runFile(target, join(here, name), name) && ok;
}

if (!ok) {
  console.error('\nSQL tests failed.');
  process.exit(1);
}
console.log('\nSQL tests passed.');
