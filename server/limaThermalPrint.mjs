const DEFAULT_PORT = Number(process.env.LIMA_RAW_PRINT_PORT || 18765);

/** VPS / kasa: Node köprüsüne (127.0.0.1) ham fiş iletir — tarayıcı diyaloğu yok */
export async function forwardLimaThermalPrint(body) {
  const text = String(body?.text ?? '');
  if (!text.trim()) {
    return { ok: false, status: 400, error: 'empty text' };
  }
  const printer = body?.printer ? String(body.printer).trim() : undefined;
  const port = DEFAULT_PORT;
  const url = `http://127.0.0.1:${port}/print`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, printer }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok !== true) {
      return { ok: false, status: res.status, error: data.error || `bridge http ${res.status}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, status: 503, error: String(error) };
  }
}
