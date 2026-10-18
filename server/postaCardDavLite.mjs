/** CardDAV yerine kişi export/import köprüsü (Faz 46). */
export function getPostaCardDavLitePrincipal() {
  return {
    ok: true,
    version: 2,
    note: 'vCard REST köprüsü + CSV; tam CardDAV sunucu değil',
    addressbookHome: '/api/posta/contacts',
    supported: ['VCARD', 'CSV', 'SYNC-HUB'],
    exportPath: '/api/posta/contacts/export.vcf',
    importPath: '/api/posta/contacts/import',
    formats: ['vcf', 'csv'],
    calendarPair: '/api/posta/caldav-lite/principal',
    icsExport: '/api/posta/calendar/export.ics',
    icsFeed: '/api/posta/calendar/feed.ics',
  };
}
