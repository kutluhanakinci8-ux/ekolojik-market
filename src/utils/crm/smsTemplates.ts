import type { Customer } from '../../types/business';
import type { CrmSmsTemplate } from '../../types/crm';
import { formatCurrency } from '../format';

export const DEFAULT_SMS_TEMPLATES: CrmSmsTemplate[] = [
  {
    id: 'sms-welcome',
    name: 'Hoş geldiniz',
    body: 'Merhaba {{name}}, {{business}} ailesine hoş geldiniz. Sorularınız için bizi arayabilirsiniz.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sms-due',
    name: 'Vade hatırlatma',
    body: 'Sayın {{name}}, {{balance}} tutarındaki ödemenizin vadesi yaklaşıyor. Teşekkürler — {{business}}',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sms-points',
    name: 'Puan bilgisi',
    body: '{{name}}, sadakat puanınız: {{points}}. Bir sonraki alışverişinizde kullanabilirsiniz. {{business}}',
    createdAt: new Date().toISOString(),
  },
];

export function normalizeSmsTemplates(raw?: CrmSmsTemplate[]): CrmSmsTemplate[] {
  if (!raw?.length) return DEFAULT_SMS_TEMPLATES.map((t) => ({ ...t }));
  return raw.map((t) => ({
    id: String(t.id),
    name: String(t.name),
    body: String(t.body),
    createdAt: t.createdAt ?? new Date().toISOString(),
  }));
}

export interface SmsTemplateContext {
  name: string;
  business: string;
  balance?: string;
  points?: string;
  dueDate?: string;
  greenleafNumber?: string;
}

export function renderSmsTemplate(body: string, ctx: SmsTemplateContext): string {
  return body
    .replace(/\{\{name\}\}/gi, ctx.name)
    .replace(/\{\{business\}\}/gi, ctx.business)
    .replace(/\{\{balance\}\}/gi, ctx.balance ?? '')
    .replace(/\{\{points\}\}/gi, ctx.points ?? '')
    .replace(/\{\{dueDate\}\}/gi, ctx.dueDate ?? '')
    .replace(/\{\{greenleaf\}\}/gi, ctx.greenleafNumber ?? '');
}

export function buildSmsContext(
  customer: Customer,
  businessName: string,
  balance: number,
  loyaltyPoints: number,
): SmsTemplateContext {
  return {
    name: customer.name.split(' ')[0] || customer.name,
    business: businessName,
    balance: balance > 0 ? formatCurrency(balance) : '0 ₺',
    points: String(loyaltyPoints),
    greenleafNumber: customer.greenleafNumber ?? '',
  };
}

export function phoneToSmsHref(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '');
  const encoded = encodeURIComponent(message);
  return `sms:${digits}?body=${encoded}`;
}
