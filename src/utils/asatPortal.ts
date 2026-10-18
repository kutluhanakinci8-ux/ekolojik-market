export const ASAT_LOGIN_PORTAL_URL = 'https://online.asat.gov.tr/loginAnonym';
export const ASAT_DEBT_PORTAL_URL = 'https://online.asat.gov.tr/odenmemisBorclar';
export const ASAT_USERSCRIPT_URL = '/asat-userscript.user.js';

export function openAsatDebtPortal(): Window | null {
  return window.open(ASAT_LOGIN_PORTAL_URL, 'marketPosAsatPortal', 'width=1180,height=860');
}

export async function copyContractNumber(contractNumber: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(contractNumber);
    return true;
  } catch {
    return false;
  }
}

export const ASAT_MANUAL_STEPS = [
  'Kartta Kullanıcı Giriş ile TC kimlik ve şifrenizi girin.',
  'reCAPTCHA kutusunu işaretleyip Giriş yapın.',
  'Ödenmemiş Borçları Getir butonuna basın.',
  'Borç otomatik takvime işlenmezse alttan manuel aktarın.',
] as const;
