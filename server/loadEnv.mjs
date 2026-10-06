import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** `/var/www/market-pos/.env` — PM2 process.env (Faz 1–5 EKOLOJIK_*) */
export function loadMarketPosEnv(appRoot = fileURLToPath(new URL('..', import.meta.url))) {
  const path = join(appRoot, '.env');
  if (!existsSync(path)) return { loaded: false, path };

  const text = readFileSync(path, 'utf8');
  let count = 0;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // .env dosyası kaynak — PM2/eski process env üzerine yazar (deploy sonrası SMTP güncellemesi)
    process.env[key] = value;
    count += 1;
  }
  return { loaded: true, path, count };
}
