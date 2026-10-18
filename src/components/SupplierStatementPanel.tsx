import { useMemo } from 'react';
import type { SupplierLedgerEntry } from '../types/accounting';
import { buildSupplierStatement } from '../utils/accountingAnalytics';
import { formatCurrency, formatDateTime } from '../utils/format';

interface SupplierStatementPanelProps {
  supplierName: string;
  supplierId: string;
  ledger: SupplierLedgerEntry[];
  className?: string;
  compact?: boolean;
}

export function SupplierStatementPanel({
  supplierName,
  supplierId,
  ledger,
  className = '',
  compact = false,
}: SupplierStatementPanelProps) {
  const statement = useMemo(
    () => buildSupplierStatement(supplierId, ledger),
    [supplierId, ledger],
  );

  return (
    <section
      className={`customer-detail-block customer-detail-block--statement voucher-customer-statement voucher-supplier-statement ${compact ? 'voucher-customer-statement--compact' : ''} ${className}`.trim()}
      aria-labelledby="voucher-supplier-statement-title"
    >
      <div className="customer-detail-block-head voucher-customer-statement__head">
        <div>
          <h3 id="voucher-supplier-statement-title">Hareket Fişi</h3>
          <p className="voucher-customer-statement__subtitle">{supplierName}</p>
        </div>
        <span>{statement.length} hareket</span>
      </div>
      {statement.length === 0 ? (
        <p className="customer-detail-empty">Henüz cari hareket kaydı yok.</p>
      ) : (
        <div className="customer-statement-table-wrap voucher-customer-statement__table-wrap">
          <table className="module-table customer-statement-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>İşlem</th>
                <th>Referans</th>
                <th>Borç</th>
                <th>Alacak</th>
                <th>Bakiye</th>
              </tr>
            </thead>
            <tbody>
              {statement.map((row, index) => {
                const isFinalBalance = index === statement.length - 1;
                const balanceClass = [
                  row.balance > 0 ? 'is-negative' : row.balance < 0 ? 'is-positive' : '',
                  isFinalBalance ? 'customer-statement-balance-final' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <tr
                    key={row.id}
                    className={isFinalBalance ? 'customer-statement-row-final' : undefined}
                  >
                    <td>{formatDateTime(row.date)}</td>
                    <td>{row.type}</td>
                    <td>{row.reference ?? '—'}</td>
                    <td>{row.debit > 0 ? formatCurrency(row.debit) : '—'}</td>
                    <td>{row.credit > 0 ? formatCurrency(row.credit) : '—'}</td>
                    <td
                      className={balanceClass}
                      title={isFinalBalance ? 'Güncel tedarikçi bakiyesi (borç)' : undefined}
                    >
                      {formatCurrency(row.balance)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
