/** Fatura e-postasından tutar / vade tahmini (basit TR heuristik) */

export function parseBillHintsFromText(text) {
  const body = String(text ?? '');
  let amount = null;
  let dueDate = null;

  const amountMatch = body.match(
    /(?:toplam|tutar|borç|borc|ödenecek|odenecek)[^\d]{0,20}(\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})?)\s*(?:TL|₺)?/i,
  )
    || body.match(/(\d{1,3}(?:[.\s]\d{3})*(?:,\d{2}))\s*(?:TL|₺)/i);
  if (amountMatch?.[1]) {
    const normalized = amountMatch[1].replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
    const n = Number.parseFloat(normalized);
    if (Number.isFinite(n) && n > 0) amount = Math.round(n * 100) / 100;
  }

  const dateMatch = body.match(
    /(?:son\s*ödeme|son\s*odeme|vade)[^\d]{0,15}(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i,
  ) || body.match(/\b(\d{1,2}[./-]\d{1,2}[./-]\d{4})\b/);
  if (dateMatch?.[1]) {
    dueDate = dateMatch[1].replace(/\//g, '.');
  }

  return { amount, dueDate };
}

export function matchBillEmailToSource(message, sources, inboxMode) {
  const from = String(message.from ?? '').toLowerCase();
  const to = String(message.to ?? '').toLowerCase();
  const delivered = String(message.deliveredTo ?? '').toLowerCase();
  const recipients = `${to} ${delivered}`;

  for (const source of sources) {
    if (!source?.enabled) continue;

    const senderOk = !source.senderFilter
      || from.includes(String(source.senderFilter).toLowerCase().replace(/^@/, '@'));

    let aliasOk = true;
    if (inboxMode === 'plus_alias' && source.forwardingAlias) {
      aliasOk = recipients.includes(String(source.forwardingAlias).toLowerCase());
    }

    if (senderOk && aliasOk) {
      return source;
    }
  }

  return null;
}

export function buildPollItem(row) {
  return {
    sourceId: row.sourceId ?? '',
    subject: row.subject,
    amount: row.amount ?? undefined,
    dueDate: row.dueDate ?? undefined,
  };
}
