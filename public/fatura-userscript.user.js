// ==UserScript==
// @name         Market POS Fatura Köprüsü (ASAT)
// @namespace    market-pos
// @version      1.0.0
// @description  faturaodemelisin ASAT borç sorgusunu Market POS takvimine aktarır
// @match        https://www.faturaodemelisin.com/antalya-su-asat-faturasi-odeme-sorgulama*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  if (window.__marketPosFaturaInjected) return;
  window.__marketPosFaturaInjected = true;

  var pendingSubscriptionId = '';
  var pendingScope = '';
  var pendingContract = '';

  function parseAmount(raw) {
    if (!raw) return 0;
    var cleaned = String(raw)
      .replace(/[^\d,.-]/g, '')
      .replace(/\.(?=\d{3}(\D|$))/g, '')
      .replace(',', '.');
    var amount = Number(cleaned);
    return Number.isFinite(amount) ? amount : 0;
  }

  function findContractInput() {
    return document.getElementById('ContentPlaceHolder1_TextBox1')
      || document.querySelector('input[name="ctl00$ContentPlaceHolder1$TextBox1"]');
  }

  function sendComplete(payload) {
    var targets = [];
    if (window.opener && window.opener !== window) targets.push(window.opener);
    if (window.parent && window.parent !== window) targets.push(window.parent);
    for (var i = 0; i < targets.length; i += 1) {
      try {
        targets[i].postMessage(payload, '*');
      } catch (e) {
        // ignore
      }
    }
  }

  function sendReady() {
    sendComplete({ type: 'market-pos-fatura-ready' });
  }

  function fillContract(contract) {
    var input = findContractInput();
    if (!input || !contract) return false;
    input.focus();
    input.value = contract;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function scrapeDebts() {
    var tab = document.getElementById('ContentPlaceHolder1_tab');
    var scope = tab ? tab.innerHTML : '';
    var text = document.body ? (document.body.innerText || '') : '';
    if (/Kayıt bulunamadı|borç bulunamadı|borc bulunamadi/i.test(text)) {
      return { noDebt: true, debts: [] };
    }

    var tableHtml = scope;
    if (!/<table/i.test(tableHtml)) {
      var match = document.body.innerHTML.match(
        /id=["']ContentPlaceHolder1_tab["'][\s\S]*?<table[\s\S]*?<\/table>/i,
      );
      tableHtml = match ? match[0] : '';
    }
    if (!tableHtml) return { debts: [] };

    var rows = tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    var debts = [];
    for (var i = 0; i < rows.length; i += 1) {
      var row = rows[i];
      if (/Son\s*Ödeme|Taksit|Tutar|Açıklama|Gecikme/i.test(row)) continue;
      var cells = [];
      var cellMatch = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
      for (var j = 0; j < cellMatch.length; j += 1) {
        cells.push(cellMatch[j].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
      }
      if (cells.length < 2) continue;
      if (!cells[0] || !/\d{2}[./-]\d{2}[./-]\d{4}/.test(cells[0])) continue;
      debts.push({
        dueDate: cells[0] || '',
        installment: cells[1] || '',
        amount: cells[2] || '',
        delayAmount: cells[3] || '',
        totalAmount: cells[4] || cells[cells.length - 1] || '',
        description: cells[5] || '',
      });
    }
    return { debts: debts };
  }

  function publishResult(contract, subscriptionId, scope) {
    var scraped = scrapeDebts();
    if (scraped.noDebt) {
      sendComplete({
        type: 'fatura-assistant-complete',
        ok: true,
        noDebt: true,
        contract: contract,
        subscriptionId: subscriptionId,
        scope: scope,
        message: 'Borç bulunamadı',
      });
      return;
    }
    if (!scraped.debts.length) {
      sendComplete({
        type: 'fatura-assistant-complete',
        ok: false,
        contract: contract,
        subscriptionId: subscriptionId,
        message: 'Borç tablosu okunamadı — güvenlik kodunu kontrol edin',
      });
      return;
    }
    sendComplete({
      type: 'fatura-assistant-complete',
      ok: true,
      contract: contract,
      subscriptionId: subscriptionId,
      scope: scope,
      debts: scraped.debts,
    });
  }

  function scheduleScrape(contract, subscriptionId, scope) {
    setTimeout(function () { publishResult(contract, subscriptionId, scope); }, 3200);
    setTimeout(function () { publishResult(contract, subscriptionId, scope); }, 6500);
  }

  var form = document.getElementById('form1');
  if (form) {
    form.addEventListener('submit', function () {
      var input = findContractInput();
      var contract = (input && input.value) || pendingContract;
      if (!contract || !pendingSubscriptionId) return;
      scheduleScrape(contract, pendingSubscriptionId, pendingScope);
    }, true);
  }

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data) return;
    if (data.type === 'market-pos-fatura-ping') {
      sendReady();
      return;
    }
    if (data.type === 'market-pos-fatura-set-contract') {
      pendingContract = data.contract || '';
      pendingSubscriptionId = data.subscriptionId || '';
      pendingScope = data.scope || '';
      fillContract(pendingContract);
      sendReady();
    }
  });

  sendReady();
})();
