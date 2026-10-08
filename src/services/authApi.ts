export interface RegisterPayload {
  businessName: string;
  email: string;
  phone: string;
  adminName: string;
  username: string;
  password: string;
  plan?: 'trial' | 'starter' | 'business';
}

export interface RegisterResult {
  ok: boolean;
  message?: string;
  tenantId?: string;
  username?: string;
  postaOnboardingStatus?: string;
  registrationEmail?: string;
}

export interface ContactPayload {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

export async function registerTenant(payload: RegisterPayload): Promise<RegisterResult> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as RegisterResult;
  if (!res.ok) {
    return { ok: false, message: data.message || `Kayıt başarısız (HTTP ${res.status})` };
  }
  return data;
}

export async function submitContactForm(payload: ContactPayload): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
  if (!res.ok) {
    return { ok: false, message: data.message || 'Mesaj gönderilemedi.' };
  }
  return { ok: true, message: data.message || 'Mesajınız alındı. En kısa sürede dönüş yapacağız.' };
}
