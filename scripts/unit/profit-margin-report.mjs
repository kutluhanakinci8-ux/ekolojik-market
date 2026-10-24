import assert from 'node:assert/strict';
import {
  buildProfitMarginReportRows,
  marginPercentOnCost,
  purchasePriceNetExVat,
} from '../../src/utils/profitMarginReport.ts';

assert.equal(purchasePriceNetExVat(51.25), 42.71);
assert.equal(marginPercentOnCost(42.71, 67.83), 58.8);

const rows = buildProfitMarginReportRows([{
  id: 1,
  name: 'Test',
  productCode: 'TST01',
  barcode: '123',
  stock: 5,
  purchasePrice: 51.25,
  partnerPrice: 67.83,
  fullSalePrice: 130.24,
  category: 'x',
}]);
assert.equal(rows[0].partnerMarginPct, 58.8);
console.log('profit-margin-report: ok');
