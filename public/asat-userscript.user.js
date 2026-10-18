// ==UserScript==
// @name         Market POS ASAT Köprüsü
// @namespace    market-pos
// @version      2.1.0
// @description  ASAT online portal borçlarını Market POS takvimine aktarır
// @match        https://online.asat.gov.tr/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  if (window.__marketPosAsatInjected) return;
  window.__marketPosAsatInjected = true;

  var PENDING_KEY = 'marketPosAsatPendingSync';
  var PENDING_ALL_KEY = 'marketPosAsatPendingSyncAll';
  var DEBTS_PATH = '/odenmemisBorclar';

  function parseAmount(raw) {
    if (!raw) return 0;
    var cleaned = String(raw)
      .replace(/[^\d,.-]/g, '')
      .replace(/\.(?=\d{3}(\D|$))/g, '')
      .replace(',', '.');
    var amount = Number(cleaned);
    return Number.isFinite(amount) ? amount : 0;
  }

  function parseDate(raw) {
    if (!raw) return '';
    var m = String(raw).trim().match(/(\d{2})[./-](\d{2})[./-](\d{4})/);
    return m ? m[3] + '-' + m[2] + '-' + m[1] : '';
  }

  function send(payload) {
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

  function isLoggedIn() {
    var path = (location.pathname || '').toLowerCase();
    return /anasayfa|odenmemisborclar|sozlesmeler|profil|basvurular/i.test(path);
  }

  function isDebtsPage() {
    return (location.pathname || '').toLowerCase().includes('odenmemisborclar');
  }

  function debtsUrl() {
    var base = location.pathname.indexOf('/asat-proxy') >= 0 ? '/asat-proxy' : '';
    return base + DEBTS_PATH;
  }

  function sendComplete(payload) {
    send({
      type: 'asat-assistant-complete',
      ok: payload.ok,
      contract: payload.contract,
      subscriptionId: payload.subscriptionId,
      scope: payload.scope,
      message: payload.message,
      noDebt: payload.noDebt,
      debts: payload.debts,
    });
  }

  function scrapeDebtsForContract(contract) {
    var bodyText = document.body ? (document.body.innerText || '') : '';
    var contractDigits = String(contract).replace(/\D/g, '');
    var debts = [];
    var seen = {};

    var rowNodes = document.querySelectorAll('table tr, mat-row, .mat-row, [role="row"]');
    for (var i = 0; i < rowNodes.length; i += 1) {
      var row = rowNodes[i];
      var rowText = (row.innerText || '').trim();
      if (!rowText) continue;
      if (!rowText.replace(/\s/g, '').includes(contractDigits)) continue;
      if (/Sözleşme|Son Ödeme|Tutar|Fatura|Başlık/i.test(rowText) && rowText.length < 80) continue;

      var cells = row.querySelectorAll('td, mat-cell, .mat-cell, [role="cell"]');
      var values = [];
      for (var j = 0; j < cells.length; j += 1) {
        values.push((cells[j].textContent || '').replace(/\s+/g, ' ').trim());
      }
      if (!values.length) {
        values = rowText.split(/\t|\n/).map(function (v) { return v.trim(); }).filter(Boolean);
      }

      var dueDate = '';
      var totalAmount = '';
      for (var k = 0; k < values.length; k += 1) {
        if (!dueDate) dueDate = parseDate(values[k]);
        if (!totalAmount && /[\d,.]+\s*₺?/.test(values[k]) && parseAmount(values[k]) > 0) {
          totalAmount = values[k];
        }
      }
      if (!dueDate && !totalAmount) continue;

      var key = dueDate + '|' + totalAmount;
      if (seen[key]) continue;
      seen[key] = true;
      debts.push({
        dueDate: dueDate || values[0] || '',
        installment: values[1] || '',
        amount: values[2] || '',
        delayAmount: values[3] || '',
        totalAmount: totalAmount || values[values.length - 1] || '',
        description: values.slice(4).join(' '),
      });
    }

    if (!debts.length) {
      var noDebtText = /ödenmemiş borç bulunmamaktadır|borç bulunmamaktadır|borc bulunmamaktadir|kayıt bulunamadı/i.test(bodyText);
      if (noDebtText) {
        return { noDebt: true, debts: [] };
      }
    }

    return { debts: debts };
  }

  function publishResult(contract, subscriptionId, scope) {
    var scraped = scrapeDebtsForContract(contract);
    if (scraped.noDebt) {
      sendComplete({
        ok: true,
        noDebt: true,
        contract: contract,
        subscriptionId: subscriptionId,
        scope: scope,
        message: 'Ödenmemiş borç bulunamadı',
      });
      return;
    }
    if (!scraped.debts.length) {
      sendComplete({
        ok: false,
        contract: contract,
        subscriptionId: subscriptionId,
        message: 'Sözleşme ' + contract + ' için borç tablosu okunamadı',
      });
      return;
    }
    sendComplete({
      ok: true,
      contract: contract,
      subscriptionId: subscriptionId,
      scope: scope,
      debts: scraped.debts,
    });
  }

  function schedulePublish(contract, subscriptionId, scope, delayMs) {
    var delay = delayMs || 0;
    setTimeout(function () { publishResult(contract, subscriptionId, scope); }, delay + 1500);
    setTimeout(function () { publishResult(contract, subscriptionId, scope); }, delay + 3500);
  }

  function syncDebts(contract, subscriptionId, scope) {
    if (!isLoggedIn()) {
      sendComplete({
        ok: false,
        contract: contract,
        subscriptionId: subscriptionId,
        message: 'Önce Kullanıcı Giriş ile oturum açın',
      });
      return;
    }

    sessionStorage.setItem(PENDING_KEY, JSON.stringify({
      contract: contract,
      subscriptionId: subscriptionId,
      scope: scope,
      ts: Date.now(),
    }));

    if (!isDebtsPage()) {
      location.href = debtsUrl();
      return;
    }

    sessionStorage.removeItem(PENDING_KEY);
    schedulePublish(contract, subscriptionId, scope, 0);
  }

  function syncAllContracts(contracts) {
    if (!contracts || !contracts.length) return;
    if (!isLoggedIn()) {
      send({ type: 'market-pos-asat-sync-error', message: 'Önce giriş yapın' });
      return;
    }

    sessionStorage.setItem(PENDING_ALL_KEY, JSON.stringify({
      contracts: contracts,
      ts: Date.now(),
    }));

    if (!isDebtsPage()) {
      location.href = debtsUrl();
      return;
    }

    runSyncAll(contracts);
  }

  function runSyncAll(contracts) {
    sessionStorage.removeItem(PENDING_ALL_KEY);
    send({ type: 'market-pos-asat-sync-started', count: contracts.length });
    for (var i = 0; i < contracts.length; i += 1) {
      var item = contracts[i];
      schedulePublish(item.contract, item.subscriptionId, item.scope, i * 1200);
    }
  }

  function resumePending() {
    var allRaw = sessionStorage.getItem(PENDING_ALL_KEY);
    if (allRaw && isDebtsPage()) {
      try {
        var allPending = JSON.parse(allRaw);
        if (allPending && Date.now() - allPending.ts < 120000) {
          runSyncAll(allPending.contracts || []);
          return;
        }
      } catch (e) {
        sessionStorage.removeItem(PENDING_ALL_KEY);
      }
    }

    var raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw || !isDebtsPage()) return;
    try {
      var pending = JSON.parse(raw);
      if (!pending || Date.now() - pending.ts > 120000) {
        sessionStorage.removeItem(PENDING_KEY);
        return;
      }
      sessionStorage.removeItem(PENDING_KEY);
      schedulePublish(pending.contract, pending.subscriptionId, pending.scope, 0);
    } catch (e) {
      sessionStorage.removeItem(PENDING_KEY);
    }
  }

  function sendReady() {
    send({ type: 'market-pos-asat-ready' });
    if (isLoggedIn()) {
      send({ type: 'market-pos-asat-logged-in' });
    }
  }

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data) return;
    if (data.type === 'market-pos-asat-ping') {
      sendReady();
      return;
    }
    if (data.type === 'market-pos-asat-sync') {
      syncDebts(data.contract, data.subscriptionId, data.scope);
      return;
    }
    if (data.type === 'market-pos-asat-sync-all') {
      syncAllContracts(data.contracts || []);
    }
  });

  sendReady();
  resumePending();

  var lastLogin = isLoggedIn();
  setInterval(function () {
    var loggedIn = isLoggedIn();
    if (loggedIn) {
      send({ type: 'market-pos-asat-logged-in' });
    }
    if (loggedIn && !lastLogin) {
      send({ type: 'market-pos-asat-login-detected' });
    }
    lastLogin = loggedIn;
  }, 2000);
})();
