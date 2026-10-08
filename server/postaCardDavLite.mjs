/** CardDAV yerine kişi export/import köprüsü (Faz 46). */
export function getPostaCardDavLitePrincipal() {
  return {
    ok: true,
    version: 1,
    note: 'vCard REST köprüsü; tam CardDAV sunucu değil',
    addressbookHome: '/api/posta/contacts',
    supported: ['VCARD'],
    exportPath: '/api/posta/contacts/export.vcf',
    importPath: '/api/posta/contacts/import',
    formats: ['vcf', 'csv'],
  };
}
