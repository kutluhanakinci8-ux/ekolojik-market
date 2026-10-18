/** destek@ e-posta footer — logo, sosyal, iletişim formu */

function trimUrl(value) {
  const v = String(value ?? '').trim();
  return v || '';
}

export function publicSiteUrl() {
  return (
    process.env.EKOLOJIK_PUBLIC_BASE_URL?.trim()
    || process.env.EKOLOJIK_PUBLIC_URL?.trim()
    || 'https://www.ekolojikmarket.com.tr'
  ).replace(/\/$/, '');
}

export function getPlatformSupportMailBrand() {
  const site = publicSiteUrl();
  const logoUrl =
    trimUrl(process.env.EKOLOJIK_MAIL_LOGO_URL) || `${site}/brand/ekolojik-email-logo.svg`;
  const contactFormUrl =
    trimUrl(process.env.EKOLOJIK_CONTACT_FORM_URL) || `${site}/iletisim`;

  const socialDefs = [
    { key: 'instagram', label: 'Instagram', env: 'EKOLOJIK_SOCIAL_INSTAGRAM' },
    { key: 'facebook', label: 'Facebook', env: 'EKOLOJIK_SOCIAL_FACEBOOK' },
    { key: 'youtube', label: 'YouTube', env: 'EKOLOJIK_SOCIAL_YOUTUBE' },
    { key: 'linkedin', label: 'LinkedIn', env: 'EKOLOJIK_SOCIAL_LINKEDIN' },
    { key: 'x', label: 'X', env: 'EKOLOJIK_SOCIAL_X' },
  ];

  const social = socialDefs.map(({ key, label, env }) => {
    const url = trimUrl(process.env[env]);
    return { key, label, url: url || null };
  });

  return {
    site,
    siteName: process.env.EKOLOJIK_MAIL_BRAND_NAME?.trim() || 'Ekolojik Market',
    logoUrl,
    contactFormUrl,
    social,
  };
}
