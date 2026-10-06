(function () {
  if (window.__marketPosAsatInjected) return;
  window.__marketPosAsatInjected = true;

  var PENDING_ALL_KEY = 'marketPosAsatPendingSyncAll';
  var DEBTS_PATH = '/odenmemisBorclar';
  var configuredContracts = [];
  var autoSyncRan = false;

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

  function proxyBase() {
    return location.pathname.indexOf('/asat-proxy') >= 0 ? '/asat-proxy' : '';
  }

  function isLoggedIn() {
    var path = (location.pathname || '').toLowerCase();
    if (/loginanonym|\/login\b|auth\/login/i.test(path)) return false;
    return /anasayfa|odenmemisborclar|sozlesmeler|profil|basvurular/i.test(path);
  }

  function isDebtsPage() {
    return (location.pathname || '').toLowerCase().includes('odenmemisborclar');
  }

  function debtsUrl() {
    return proxyBase() + DEBTS_PATH;
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

  function pageHasNoDebt() {
    var bodyText = document.body ? (document.body.innerText || '') : '';
    return /kayıt bulunamadı|ödenmemiş borç bulunmamaktadır|borç bulunmamaktadır|borc bulunmamaktadir/i.test(bodyText);
  }

  function scrapeAllRows() {
    var rows = [];
    var rowNodes = document.querySelectorAll('table tbody tr, mat-row, .mat-row, [role="row"]');
    for (var i = 0; i < rowNodes.length; i += 1) {
      var row = rowNodes[i];
      var rowText = (row.innerText || '').trim();
      if (!rowText || /kayıt bulunamadı/i.test(rowText)) continue;
      if (/Son Ödeme|Sözleşme|Taksit|Tutar|Gecikme|Açıklama/i.test(rowText) && rowText.length < 100) continue;

      var cells = row.querySelectorAll('td, mat-cell, .mat-cell, [role="cell"]');
      var values = [];
      for (var j = 0; j < cells.length; j += 1) {
        values.push((cells[j].textContent || '').replace(/\s+/g, ' ').trim());
      }
      if (values.length < 2) continue;

      var dueDate = parseDate(values[0]) || parseDate(values.find(function (v) { return parseDate(v); }) || '');
      var contract = values.find(function (v) { return /^\d{5,}$/.test(v.replace(/\s/g, '')); }) || values[1] || '';
      var amountCell = values.find(function (v) { return /[\d,.]+\s*₺?/.test(v) && parseAmount(v) > 0; });
      if (!dueDate && !amountCell) continue;

      rows.push({
        contract: contract.replace(/\s/g, ''),
        dueDate: dueDate || '',
        installment: values[2] || '',
        amount: values[3] || '',
        delayAmount: values[4] || '',
        totalAmount: amountCell || values[values.length - 1] || '',
        description: values[6] || values[5] || '',
      });
    }
    return rows;
  }

  function scrapeDebtsForContract(contract) {
    if (pageHasNoDebt()) {
      return { noDebt: true, debts: [] };
    }

    var contractDigits = String(contract).replace(/\D/g, '');
    var allRows = scrapeAllRows();
    var debts = allRows.filter(function (row) {
      return row.contract.includes(contractDigits) || contractDigits.includes(row.contract);
    }).map(function (row) {
      return {
        dueDate: row.dueDate,
        installment: row.installment,
        amount: row.amount,
        delayAmount: row.delayAmount,
        totalAmount: row.totalAmount,
        description: row.description,
      };
    });

    if (!debts.length) {
      if (pageHasNoDebt() || allRows.length > 0) {
        return { noDebt: true, debts: [] };
      }
      return { debts: [] };
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

  function runSyncAll(contracts) {
    if (!contracts || !contracts.length) return;
    sessionStorage.removeItem(PENDING_ALL_KEY);
    send({ type: 'market-pos-asat-sync-started', count: contracts.length });

    if (pageHasNoDebt()) {
      for (var i = 0; i < contracts.length; i += 1) {
        var item = contracts[i];
        sendComplete({
          ok: true,
          noDebt: true,
          contract: item.contract,
          subscriptionId: item.subscriptionId,
          scope: item.scope,
          message: 'Ödenmemiş borç bulunamadı',
        });
      }
      return;
    }

    for (var j = 0; j < contracts.length; j += 1) {
      (function (item, delay) {
        setTimeout(function () {
          publishResult(item.contract, item.subscriptionId, item.scope);
        }, delay + 800);
      })(contracts[j], j * 600);
    }
  }

  function syncAllContracts(contracts) {
    if (!contracts || !contracts.length) return;
    if (!isLoggedIn()) return;

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

  function maybeAutoSync() {
    if (autoSyncRan || !configuredContracts.length || !isLoggedIn()) return;
    autoSyncRan = true;
    syncAllContracts(configuredContracts);
  }

  function resumePending() {
    var allRaw = sessionStorage.getItem(PENDING_ALL_KEY);
    if (!allRaw || !isDebtsPage()) return;
    try {
      var allPending = JSON.parse(allRaw);
      if (!allPending || Date.now() - allPending.ts > 120000) {
        sessionStorage.removeItem(PENDING_ALL_KEY);
        return;
      }
      runSyncAll(allPending.contracts || []);
    } catch (e) {
      sessionStorage.removeItem(PENDING_ALL_KEY);
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
      if (Array.isArray(data.contracts) && data.contracts.length) {
        configuredContracts = data.contracts;
      }
      sendReady();
      if (isLoggedIn()) {
        maybeAutoSync();
      }
      return;
    }
    if (data.type === 'market-pos-asat-sync-all') {
      autoSyncRan = false;
      syncAllContracts(data.contracts || configuredContracts);
      return;
    }
    if (data.type === 'market-pos-asat-sync') {
      syncAllContracts([{
        contract: data.contract,
        subscriptionId: data.subscriptionId,
        scope: data.scope,
      }]);
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
      maybeAutoSync();
    }
    if (isDebtsPage() && loggedIn && configuredContracts.length && !autoSyncRan) {
      maybeAutoSync();
    }
    lastLogin = loggedIn;
  }, 2000);

  if (isDebtsPage()) {
    setTimeout(resumePending, 1500);
    setTimeout(function () {
      if (configuredContracts.length) maybeAutoSync();
    }, 2500);
  }
})();
