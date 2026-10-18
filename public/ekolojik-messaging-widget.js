/**
 * Ekolojik müşteri mesaj widget (lite) — NB public messaging karşılığı.
 * data-api-key: EKOLOJIK_MESSAGING_PUBLIC_KEY (sunucu tarafı; widget sadece thread token ile çalışır)
 */
(function () {
  const script = document.currentScript;
  if (!script) return;
  const apiRoot = (script.getAttribute('data-api-root') || '').replace(/\/$/, '') || '';
  const token = script.getAttribute('data-thread-token') || '';
  const mountId = script.getAttribute('data-mount') || 'ekolojik-messaging-widget';

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  async function api(path, opts) {
    const res = await fetch(`${apiRoot}${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(opts && opts.headers) },
    });
    return res.json();
  }

  async function boot() {
    const mount = document.getElementById(mountId);
    if (!mount || !token) return;

    const box = el('div', 'ek-msg-widget');
    const list = el('ul', 'ek-msg-widget__list');
    const typing = el('p', 'ek-msg-widget__typing');
    typing.hidden = true;
    const form = el('form', 'ek-msg-widget__form');
    const input = el('textarea');
    input.rows = 2;
    input.placeholder = 'Mesajınız…';
    const send = el('button', '', 'Gönder');
    send.type = 'submit';
    form.append(input, send);
    box.append(list, typing, form);
    mount.append(box);

    async function refresh() {
      const data = await api(
        `/api/public/messaging/v1/threads/messages?token=${encodeURIComponent(token)}`,
      );
      if (!data.ok || !data.messages) return;
      list.innerHTML = '';
      data.messages.forEach((m) => {
        const li = el('li', `ek-msg-widget__item ek-msg-widget__item--${m.direction}`);
        li.append(el('strong', '', m.authorName), el('span', '', m.bodyText));
        list.append(li);
      });
      list.scrollTop = list.scrollHeight;
    }

    let typingTimer;
    input.addEventListener('input', () => {
      clearTimeout(typingTimer);
      void api(`/api/public/messaging/v1/threads/typing?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        body: JSON.stringify({ active: true }),
      });
      typingTimer = setTimeout(() => {
        void api(`/api/public/messaging/v1/threads/typing?token=${encodeURIComponent(token)}`, {
          method: 'POST',
          body: JSON.stringify({ active: false }),
        });
      }, 2000);
    });

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const bodyText = input.value.trim();
      if (!bodyText) return;
      input.value = '';
      await api(`/api/public/messaging/v1/threads/messages?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        body: JSON.stringify({ bodyText }),
      });
      await refresh();
    });

    await refresh();
    setInterval(refresh, 12000);
    setInterval(async () => {
      const t = await api(
        `/api/public/messaging/v1/threads/typing?token=${encodeURIComponent(token)}`,
      );
      if (t.ok && t.typing?.staff) {
        typing.textContent = 'Mağaza yazıyor…';
        typing.hidden = false;
      } else typing.hidden = true;
    }, 2500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
