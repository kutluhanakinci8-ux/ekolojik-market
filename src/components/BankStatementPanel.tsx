import { useMemo } from 'react';
import type { BankAccount, BankTransaction } from '../types/accounting';
import { buildBankStatement } from '../utils/bankStatement';
import { formatCurrency, formatDateTime } from '../utils/format';

interface BankStatementPanelProps {
  account: BankAccount;
  transactions: BankTransaction[];
  className?: string;
  compact?: boolean;
}

export function BankStatementPanel({
  account,
  transactions,
  className = '',
  compact = false,
}: BankStatementPanelProps) {
  const statement = useMemo(
    () => buildBankStatement(account.id, account, transactions),
    [account, transactions],
  );

  return (
    <section
      className={`customer-detail-block customer-detail-block--statement voucher-customer-statement voucher-bank-statement ${compact ? 'voucher-customer-statement--compact' : ''} ${className}`.trim()}
      aria-labelledby="voucher-bank-statement-title"
    >
      <div className="customer-detail-block-head voucher-customer-statement__head">
        <div>
          <h3 id="voucher-bank-statement-title">Banka Hareket Defteri</h3>
          <p className="voucher-customer-statement__subtitle">
            {account.name} — {account.bankName}
            {account.iban ? ` · ${account.iban}` : ''}
          </p>
        </div>
        <span>{statement.length} hareket</span>
      </div>
      <p className="voucher-bank-statement-opening">
        Açılış bakiyesi: <strong>{formatCurrency(account.openingBalance)}</strong>
      </p>
      {statement.length === 0 ? (
        <p className="customer-detail-empty">Bu hesapta henüz hareket kaydı yok.</p>
      ) : (
        <div className="customer-statement-table-wrap voucher-customer-statement__table-wrap">
          <table className="module-table customer-statement-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>İşlem</th>
                <th>Açıklama</th>
                <th>Borç</th>
                <th>Alacak</th>
                <th>Bakiye</th>
              </tr>
            </thead>
            <tbody>
              {statement.map((row, index) => {
                const isFinalBalance = index === statement.length - 1;
                const balanceClass = [
                  row.balance < 0 ? 'is-negative' : row.balance > 0 ? 'is-positive' : '',
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
                    <td>{row.note ?? row.reference ?? '—'}</td>
                    <td>{row.debit > 0 ? formatCurrency(row.debit) : '—'}</td>
                    <td>{row.credit > 0 ? formatCurrency(row.credit) : '—'}</td>
                    <td
                      className={balanceClass}
                      title={isFinalBalance ? 'Güncel banka bakiyesi' : undefined}
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
