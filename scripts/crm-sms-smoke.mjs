#!/usr/bin/env node
import { sendCrmSms, isCrmSmsConfigured } from '../server/crmSms.mjs';

process.env.EKOLOJIK_SMS_PROVIDER = 'mock';
const configured = isCrmSmsConfigured();
if (!configured) throw new Error('mock SMS should be configured');

const sent = await sendCrmSms({ to: '05551234567', body: 'CRM SMS smoke test' });
if (!sent.ok) throw new Error(sent.error ?? 'send failed');

console.log('crm-sms-smoke: PASS');
