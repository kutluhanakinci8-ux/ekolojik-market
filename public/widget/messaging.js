/**
 * Ekolojik müşteri mesaj widget (Faz 40)
 * Snippet:
 *   <script src="https://HOST/widget/messaging.js" defer></script>
 *   <script>EkolojikMessaging.init({ tenantId, apiKey, apiBase })</script>
 */
(function (global) {
  const STYLE_ID = 'ekolojik-messaging-widget-style';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
.ek-msg-root{position:fixed;z-index:2147483000;font-family:system-ui,sans-serif;font-size:14px;line-height:1.4}
.ek-msg-root--left{left:16px;bottom:16px}
.ek-msg-root--right{right:16px;bottom:16px}
.ek-msg-toggle{width:52px;height:52px;border-radius:50%;border:none;background:#1a7f4b;color:#fff;font-size:22px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.2)}
.ek-msg-panel{display:none;width:min(360px,calc(100vw - 32px));height:420px;background:#fff;border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.18);flex-direction:column;overflow:hidden;margin-bottom:10px}
.ek-msg-panel.is-open{display:flex}
.ek-msg-head{padding:12px 14px;background:#1a7f4b;color:#fff;font-weight:600}
.ek-msg-list{flex:1;overflow:auto;padding:10px;margin:0;list-style:none}
.ek-msg-item{margin-bottom:8px;padding:8px 10px;border-radius:8px;background:#f4f6f8}
.ek-msg-item--customer{background:#e8f5ee;margin-left:12px}
.ek-msg-item--staff{background:#fff;border:1px solid #e2e8f0;margin-right:12px}
.ek-msg-typing{font-size:12px;color:#64748b;padding:0 12px 6px;min-height:18px}
.ek-msg-form{display:flex;gap:6px;padding:10px;border-top:1px solid #e2e8f0}
.ek-msg-form textarea{flex:1;resize:none;border:1px solid #cbd5e1;border-radius:8px;padding:8px;font:inherit}
.ek-msg-form button{border:none;background:#1a7f4b;color:#fff;border-radius:8px;padding:8px 12px;cursor:pointer}
`;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = css;
    document.head.appendChild(el);
  }

  function tenantQuery(tenantId) {
    return tenantId && tenantId !== 'main' ? `?tenant=${encodeURIComponent(tenantId)}` : '';
  }

  function joinTenant(path, tenantId) {
    const q = tenantQuery(tenantId);
    if (!q) return path;
    return path.includes('?') ? `${path}&${q.slice(1)}` : `${path}${q}`;
  }

  function storageKey(cfg) {
    return `ek-msg-v1:${cfg.tenantId || 'main'}:${(cfg.apiKey || '').slice(0, 12)}`;
  }

  async function apiJson(url, opts) {
    const res = await fetch(url, opts);
    return res.json();
  }

  async function ensureThread(cfg) {
    const key = storageKey(cfg);
    try {
      const cached = JSON.parse(sessionStorage.getItem(key) || 'null');
      if (cached?.customerToken) return cached;
    } catch {
      /* ignore */
    }
    const base = (cfg.apiBase || '').replace(/\/$/, '');
    const customerId = `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const created = await apiJson(joinTenant(`${base}/threads`, cfg.tenantId), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ekolojik-messaging-key': cfg.apiKey,
      },
      body: JSON.stringify({
        customerId,
        customerName: cfg.customerName || 'Web ziyaretçi',
        customerEmail: cfg.customerEmail || null,
        subject: cfg.subject || 'Web sitesi mesajı',
        initialMessage: cfg.greeting || null,
        authorName: cfg.customerName || 'Müşteri',
      }),
    });
    if (!created.ok || !created.customerToken) {
      throw new Error(created.error || 'Thread oluşturulamadı');
    }
    const row = { customerToken: created.customerToken, customerId, threadId: created.thread?.id };
    sessionStorage.setItem(key, JSON.stringify(row));
    return row;
  }

  function mountWidget(cfg, session) {
    injectStyles();
    const pos = cfg.position === 'left' ? 'left' : 'right';
    const root = document.createElement('div');
    root.className = `ek-msg-root ek-msg-root--${pos}`;
    const panel = document.createElement('div');
    panel.className = 'ek-msg-panel';
    const head = document.createElement('div');
    head.className = 'ek-msg-head';
    head.textContent = cfg.title || 'Bize yazın';
    const list = document.createElement('ul');
    list.className = 'ek-msg-list';
    const typing = document.createElement('div');
    typing.className = 'ek-msg-typing';
    const form = document.createElement('form');
    form.className = 'ek-msg-form';
    const input = document.createElement('textarea');
    input.rows = 2;
    input.placeholder = cfg.placeholder || 'Mesajınız…';
    const send = document.createElement('button');
    send.type = 'submit';
    send.textContent = 'Gönder';
    form.append(input, send);
    panel.append(head, list, typing, form);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'ek-msg-toggle';
    toggle.setAttribute('aria-label', 'Sohbet');
    toggle.textContent = '💬';

    root.append(panel, toggle);
    const mount = cfg.mount ? document.getElementById(cfg.mount) : document.body;
    (mount || document.body).appendChild(root);

    const base = (cfg.apiBase || '').replace(/\/$/, '');
    const token = session.customerToken;

    async function refresh() {
      const data = await apiJson(
        joinTenant(`${base}/threads/messages?token=${encodeURIComponent(token)}`, cfg.tenantId),
      );
      if (!data.ok || !data.messages) return;
      list.innerHTML = '';
      data.messages.forEach((m) => {
        const li = document.createElement('li');
        li.className = `ek-msg-item ek-msg-item--${m.direction === 'staff' ? 'staff' : 'customer'}`;
        const who = document.createElement('strong');
        who.textContent = `${m.authorName || (m.direction === 'staff' ? 'Mağaza' : 'Siz')}: `;
        const body = document.createElement('span');
        body.textContent = m.bodyText || '';
        li.append(who, body);
        list.appendChild(li);
      });
      list.scrollTop = list.scrollHeight;
    }

    let typingTimer;
    input.addEventListener('input', () => {
      clearTimeout(typingTimer);
      void apiJson(joinTenant(`${base}/threads/typing?token=${encodeURIComponent(token)}`, cfg.tenantId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: true }),
      });
      typingTimer = setTimeout(() => {
        void apiJson(joinTenant(`${base}/threads/typing?token=${encodeURIComponent(token)}`, cfg.tenantId), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: false }),
        });
      }, 2000);
    });

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const bodyText = input.value.trim();
      if (!bodyText) return;
      input.value = '';
      await apiJson(joinTenant(`${base}/threads/messages?token=${encodeURIComponent(token)}`, cfg.tenantId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bodyText, authorName: cfg.customerName || 'Müşteri' }),
      });
      await refresh();
    });

    toggle.addEventListener('click', () => {
      panel.classList.toggle('is-open');
      if (panel.classList.contains('is-open')) void refresh();
    });

    void refresh();
    setInterval(() => {
      if (panel.classList.contains('is-open')) void refresh();
    }, cfg.pollMs || 10000);

    setInterval(async () => {
      if (!panel.classList.contains('is-open')) return;
      const t = await apiJson(joinTenant(`${base}/threads/typing?token=${encodeURIComponent(token)}`, cfg.tenantId));
      if (t.ok && t.typing?.staff) typing.textContent = 'Mağaza yazıyor…';
      else typing.textContent = '';
    }, 2800);

    return { refresh, open: () => panel.classList.add('is-open') };
  }

  async function init(userCfg) {
    const script = document.currentScript;
    const fromScript = script
      ? {
          tenantId: script.getAttribute('data-tenant-id') || script.getAttribute('data-tenant'),
          apiKey: script.getAttribute('data-api-key'),
          apiBase: script.getAttribute('data-api-base'),
        }
      : {};
    const origin =
      (typeof window !== 'undefined' && window.location?.origin) ||
      (script?.src ? new URL(script.src).origin : '');
    const cfg = {
      tenantId: userCfg?.tenantId || fromScript.tenantId || 'main',
      apiKey: userCfg?.apiKey || fromScript.apiKey || '',
      apiBase: (userCfg?.apiBase || fromScript.apiBase || `${origin}/api/public/messaging/v1`).replace(/\/$/, ''),
      mount: userCfg?.mount,
      title: userCfg?.title,
      placeholder: userCfg?.placeholder,
      customerName: userCfg?.customerName,
      customerEmail: userCfg?.customerEmail,
      subject: userCfg?.subject,
      greeting: userCfg?.greeting,
      position: userCfg?.position,
      pollMs: userCfg?.pollMs,
    };
    if (!cfg.apiKey) {
      console.warn('[EkolojikMessaging] apiKey gerekli');
      return { ok: false, error: 'apiKey gerekli' };
    }
    const session = await ensureThread(cfg);
    const ui = mountWidget(cfg, session);
    return { ok: true, session, ui };
  }

  global.EkolojikMessaging = { init, version: 1 };
})(typeof globalThis !== 'undefined' ? globalThis : window);
