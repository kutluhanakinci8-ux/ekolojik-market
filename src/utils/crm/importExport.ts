import type { Customer } from '../../types/business';
import { normalizeCrmProfile } from './profile';
import type { CrmSettings } from '../../types/crm';

export interface CustomerCsvRow {
  name: string;
  type: 'individual' | 'corporate';
  taxNumber: string;
  phone?: string;
  email?: string;
  greenleafNumber?: string;
  city?: string;
  district?: string;
  address?: string;
}

const CSV_HEADERS = ['name', 'type', 'taxNumber', 'phone', 'email', 'greenleafNumber', 'city', 'district', 'address'];

export function parseCustomerCsv(text: string): { rows: CustomerCsvRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const errors: string[] = [];
  if (lines.length < 2) return { rows: [], errors: ['Dosyada başlık ve en az bir satır olmalı.'] };

  const header = lines[0].split(';').map((h) => h.trim().toLowerCase());
  const nameIdx = header.indexOf('name') >= 0 ? header.indexOf('name') : 0;

  const rows: CustomerCsvRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(';').map((c) => c.trim());
    const name = cols[nameIdx] ?? '';
    if (!name) {
      errors.push(`Satır ${i + 1}: isim boş.`);
      continue;
    }
    rows.push({
      name,
      type: (cols[header.indexOf('type')] ?? 'individual') === 'corporate' ? 'corporate' : 'individual',
      taxNumber: cols[header.indexOf('taxnumber')] ?? cols[2] ?? '',
      phone: cols[header.indexOf('phone')] ?? undefined,
      email: cols[header.indexOf('email')] ?? undefined,
      greenleafNumber: cols[header.indexOf('greenleafnumber')] ?? undefined,
      city: cols[header.indexOf('city')] ?? undefined,
      district: cols[header.indexOf('district')] ?? undefined,
      address: cols[header.indexOf('address')] ?? undefined,
    });
  }
  return { rows, errors };
}

export function buildCustomerCsv(customers: Customer[]): string {
  const header = CSV_HEADERS.join(';');
  const body = customers.map((c) => [
    c.name,
    c.type,
    c.taxNumber,
    c.phone ?? '',
    c.email ?? '',
    c.greenleafNumber ?? '',
    c.city,
    c.district,
    c.address,
  ].map((v) => String(v).replace(/;/g, ',')).join(';'));
  return [header, ...body].join('\n');
}

export function buildCustomerGdprExport(customer: Customer, settings: CrmSettings): string {
  const crm = normalizeCrmProfile(customer.crm, settings);
  return JSON.stringify({ customer: { ...customer, crm }, exportedAt: new Date().toISOString() }, null, 2);
}

export function rowsToCustomers(rows: CustomerCsvRow[], settings: CrmSettings): Customer[] {
  const now = new Date().toISOString();
  return rows.map((row, index) => ({
    id: `C-IMP-${Date.now()}-${index}`,
    type: row.type,
    name: row.name,
    taxNumber: row.taxNumber || '00000000000',
    greenleafNumber: row.greenleafNumber,
    address: row.address ?? '',
    city: row.city ?? '',
    district: row.district ?? '',
    country: 'Türkiye',
    phone: row.phone,
    email: row.email,
    registeredFrom: 'admin',
    crm: normalizeCrmProfile(undefined, settings),
    createdAt: now,
    updatedAt: now,
  }));
}
