import { readdir, readFile } from 'node:fs/promises';
import { Miniflare } from 'miniflare';

const worker = new Miniflare({
  modules: true,
  scriptPath: 'worker.js',
  compatibilityDate: '2026-07-01',
  port: 8787,
  d1Databases: ['DB'],
  d1Persist: '.dev-data',
  bindings: { RATE_LIMIT_SECRET: 'local-development-only', ALLOW_LOCAL_ORIGINS: 'true' },
});
const db = await worker.getD1Database('DB');
await db.prepare('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)').run();
for (const name of (await readdir('drizzle')).filter((name) => name.endsWith('.sql')).sort()) {
  if (await db.prepare('SELECT name FROM local_migrations WHERE name = ?').bind(name).first()) continue;
  const sql = await readFile(`drizzle/${name}`, 'utf8');
  const statements = sql.split('--> statement-breakpoint').map((statement) => db.prepare(statement.trim()));
  await db.batch([...statements, db.prepare('INSERT INTO local_migrations (name) VALUES (?)').bind(name)]);
}
console.log(`Recommendations API: ${await worker.ready}`);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await worker.dispose(); process.exit(0); });
