import type { CrmEmailTemplate } from '../../types/crm';
import type { SmsTemplateContext } from './smsTemplates';
import { renderSmsTemplate } from './smsTemplates';

export const DEFAULT_EMAIL_TEMPLATES: CrmEmailTemplate[] = [
  {
    id: 'email-welcome',
    name: 'Hoş geldiniz',
    subject: '{{business}} — Hoş geldiniz',
    body: 'Merhaba {{name}},\n\n{{business}} ailesine hoş geldiniz.\n\nSaygılarımızla,\n{{business}}',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'email-due',
    name: 'Vade hatırlatma',
    subject: 'Ödeme hatırlatması — {{business}}',
    body: 'Sayın {{name}},\n\nAçık bakiyeniz: {{balance}}\nLütfen ödemenizi zamanında yapın.\n\n{{business}}',
    createdAt: new Date().toISOString(),
  },
];

export function normalizeEmailTemplates(raw?: CrmEmailTemplate[]): CrmEmailTemplate[] {
  if (!raw?.length) return DEFAULT_EMAIL_TEMPLATES.map((t) => ({ ...t }));
  return raw.map((t) => ({
    id: String(t.id),
    name: String(t.name),
    subject: String(t.subject),
    body: String(t.body),
    createdAt: t.createdAt ?? new Date().toISOString(),
  }));
}

export function renderEmailTemplate(
  template: CrmEmailTemplate,
  ctx: SmsTemplateContext,
): { subject: string; body: string } {
  return {
    subject: renderSmsTemplate(template.subject, ctx),
    body: renderSmsTemplate(template.body, ctx),
  };
}
