#!/usr/bin/env node
/**
 * Tenant gönderim alan adı — deliverability / DNS scriptleri
 * Kullanım: node scripts/lib/ekolojik-tenant-mail-domain.mjs [DATA_DIR] [tenantId]
 */
import { getEffectiveMailPresentation } from '../../server/postaSettings.mjs';

const dataDir = process.argv[2] || process.env.EKOLOJIK_DATA_DIR || '/var/www/market-pos/data';
const tenantId = process.argv[3] || process.env.EKOLOJIK_VERIFY_TENANT || 'main';

const pres = await getEffectiveMailPresentation(dataDir, tenantId);
const fromDomain = pres.from?.includes('@') ? pres.from.split('@')[1].trim().toLowerCase() : '';
const domain =
  fromDomain ||
  String(process.env.EKOLOJIK_MAIL_DOMAIN ?? '').trim() ||
  'ekolojikmarket.com.tr';
process.stdout.write(domain);
