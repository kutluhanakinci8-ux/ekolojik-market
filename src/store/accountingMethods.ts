import type {
  BankAccount,
  BankTransaction,
  CashCountVariance,
  CheckNote,
  CustomerLedgerEntry,
  PeriodClosure,
  PurchaseInvoiceLine,
  CapitalContribution,
  EquityPartner,
  StockAdjustment,
  Supplier,
  SupplierLedgerEntry,
} from '../types/accounting';
import type { Customer, Expense, ExpenseCategory, PurchaseInvoice } from '../types/business';
import type { JournalVoucher, VoucherInput } from '../types/journalVoucher';
import { buildJournalLinesPreview, nextVoucherNo, resolveVoucherAmount } from '../utils/journalVoucherBuilder';
import type { Product, Sale, StockMovement } from '../types/product';
import type { SaleReturn } from '../types/saleReturn';
import { getSaleStatus } from '../utils/saleReturn';
import type { Dispatch, SetStateAction } from 'react';
import type { AuthSession } from '../types/user';
import type { ActivityAction } from '../utils/activityAudit';
import { buildPeriodClosureSnapshot } from '../utils/accountingAnalytics';
import type { ReportPeriod } from '../utils/analytics';
import { applyPurchaseLinePricing, computePurchaseLinesTotals } from '../utils/purchaseInvoiceLines';
import { splitGrossAmount } from '../utils/vatAnalytics';
import { formatCurrencyTry } from '../utils/format';

type StockMovementFactory = (
  product: Product,
  type: StockMovement['type'],
  quantity: number,
  previousStock: number,
  newStock: number,
  note: string,
  meta?: { saleId?: string; returnId?: string },
) => StockMovement;

export interface AccountingStoreDeps {
  authSession: AuthSession | null;
  customers: Customer[];
  products: Product[];
  sales: Parameters<typeof buildPeriodClosureSnapshot>[4];
  saleReturns: Parameters<typeof buildPeriodClosureSnapshot>[5];
  expenses: Expense[];
  purchaseInvoices: PurchaseInvoice[];
  suppliers: Supplier[];
  customerLedger: CustomerLedgerEntry[];
  supplierLedger: SupplierLedgerEntry[];
  bankAccounts: BankAccount[];
  bankTransactions: BankTransaction[];
  periodClosures: PeriodClosure[];
  cashCountVariances: CashCountVariance[];
  checkNotes: CheckNote[];
  stockAdjustments: StockAdjustment[];
  journalVouchers: JournalVoucher[];
  equityPartners: EquityPartner[];
  capitalContributions: CapitalContribution[];
  setSuppliers: Dispatch<SetStateAction<Supplier[]>>;
  setCustomerLedger: Dispatch<SetStateAction<CustomerLedgerEntry[]>>;
  setSupplierLedger: Dispatch<SetStateAction<SupplierLedgerEntry[]>>;
  setBankAccounts: Dispatch<SetStateAction<BankAccount[]>>;
  setBankTransactions: Dispatch<SetStateAction<BankTransaction[]>>;
  setPeriodClosures: Dispatch<SetStateAction<PeriodClosure[]>>;
  setCashCountVariances: Dispatch<SetStateAction<CashCountVariance[]>>;
  setCheckNotes: Dispatch<SetStateAction<CheckNote[]>>;
  setStockAdjustments: Dispatch<SetStateAction<StockAdjustment[]>>;
  setJournalVouchers: Dispatch<SetStateAction<JournalVoucher[]>>;
  setEquityPartners: Dispatch<SetStateAction<EquityPartner[]>>;
  setCapitalContributions: Dispatch<SetStateAction<CapitalContribution[]>>;
  setProducts: Dispatch<SetStateAction<Product[]>>;
  setStockMovements: Dispatch<SetStateAction<StockMovement[]>>;
  setPurchaseInvoices: Dispatch<SetStateAction<PurchaseInvoice[]>>;
  setExpenses: Dispatch<SetStateAction<Expense[]>>;
  setSaleReturns: Dispatch<SetStateAction<SaleReturn[]>>;
  setSales: Dispatch<SetStateAction<Sale[]>>;
  createMovement: StockMovementFactory;
  logActivity: (
    session: AuthSession,
    action: ActivityAction,
    summary: string,
    meta?: Record<string, string | number | boolean | undefined>,
  ) => void;
}

function addDaysIso(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function createAccountingMethods(deps: AccountingStoreDeps) {
  const {
    authSession,
    products,
    sales,
    saleReturns,
    expenses,
    purchaseInvoices,
    suppliers,
    customerLedger,
    supplierLedger,
    setSuppliers,
    setCustomerLedger,
    setSupplierLedger,
    setBankAccounts,
    setBankTransactions,
    setPeriodClosures,
    setCashCountVariances,
    setCheckNotes,
    setStockAdjustments,
    journalVouchers,
    equityPartners,
    setJournalVouchers,
    setEquityPartners,
    setCapitalContributions,
    setProducts,
    setStockMovements,
    setPurchaseInvoices,
    setExpenses,
    setSaleReturns,
    setSales,
    createMovement,
    logActivity,
    bankTransactions,
  } = deps;

  const addSupplier = (data: Omit<Supplier, 'id' | 'createdAt'>) => {
    const supplier: Supplier = {
      ...data,
      id: `SUP${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setSuppliers((prev) => [supplier, ...prev]);
    if (authSession) {
      logActivity(authSession, 'settings_update', `Tedarikçi eklendi: ${supplier.name}`, { tedarikci: supplier.id });
    }
    return supplier;
  };

  const updateSupplier = (id: string, data: Partial<Omit<Supplier, 'id' | 'createdAt'>>) => {
    const existing = suppliers.find((item) => item.id === id);
    if (!existing) return null;
    const nextName = data.name?.trim() || existing.name;
    const updated: Supplier = {
      ...existing,
      ...data,
      name: nextName,
    };
    setSuppliers((prev) => prev.map((item) => (item.id === id ? updated : item)));
    setPurchaseInvoices((prev) =>
      prev.map((invoice) =>
        invoice.supplierId === id ? { ...invoice, supplierName: nextName } : invoice,
      ),
    );
    if (authSession) {
      logActivity(authSession, 'settings_update', `Tedarikçi güncellendi: ${nextName}`, { tedarikci: id });
    }
    return updated;
  };

  const removeSupplier = (id: string) => {
    const supplier = suppliers.find((item) => item.id === id);
    if (!supplier) return false;
    setSuppliers((prev) => prev.filter((item) => item.id !== id));
    setSupplierLedger((prev) => prev.filter((entry) => entry.supplierId !== id));
    setPurchaseInvoices((prev) =>
      prev.map((invoice) =>
        invoice.supplierId === id ? { ...invoice, supplierId: undefined } : invoice,
      ),
    );
    if (authSession) {
      logActivity(authSession, 'settings_update', `Tedarikçi silindi: ${supplier.name}`, { tedarikci: id });
    }
    return true;
  };

  const addCustomerRefund = (
    customerId: string,
    amount: number,
    paymentMethod: CustomerLedgerEntry['paymentMethod'] = 'transfer',
    note?: string,
  ) => {
    const value = Math.max(0, amount);
    if (value <= 0) return null;
    const entry: CustomerLedgerEntry = {
      id: `CL${Date.now()}`,
      customerId,
      type: 'adjustment',
      amount: value,
      paymentMethod,
      note,
      createdAt: new Date().toISOString(),
      createdBy: authSession?.displayName,
    };
    setCustomerLedger((prev) => [entry, ...prev]);
    if (authSession) {
      logActivity(authSession, 'customer_payment', `Müşteri iadesi: ${formatCurrencyTry(value)}`, { musteri: customerId });
    }
    return entry;
  };

  const addCustomerPayment = (
    customerId: string,
    amount: number,
    paymentMethod: CustomerLedgerEntry['paymentMethod'] = 'cash',
    note?: string,
  ) => {
    const value = Math.max(0, amount);
    if (value <= 0) return null;
    const entry: CustomerLedgerEntry = {
      id: `CL${Date.now()}`,
      customerId,
      type: 'payment',
      amount: -value,
      paymentMethod,
      note,
      createdAt: new Date().toISOString(),
      createdBy: authSession?.displayName,
    };
    setCustomerLedger((prev) => [entry, ...prev]);
    if (authSession) {
      logActivity(authSession, 'customer_payment', `Müşteri tahsilat: ${formatCurrencyTry(value)}`, { musteri: customerId });
    }
    return entry;
  };

  const addCreditSaleLedger = (
    customerId: string,
    amount: number,
    saleId: string,
    dueDate?: string,
  ) => {
    const entry: CustomerLedgerEntry = {
      id: `CL${Date.now()}`,
      customerId,
      type: 'sale_credit',
      amount,
      saleId,
      dueDate,
      createdAt: new Date().toISOString(),
      createdBy: authSession?.displayName,
    };
    setCustomerLedger((prev) => [entry, ...prev]);
    return entry;
  };

  const addSupplierPayment = (
    supplierId: string,
    amount: number,
    paymentMethod: SupplierLedgerEntry['paymentMethod'] = 'transfer',
    note?: string,
    purchaseInvoiceId?: string,
  ) => {
    const value = Math.max(0, amount);
    if (value <= 0) return null;
    const entry: SupplierLedgerEntry = {
      id: `SL${Date.now()}`,
      supplierId,
      type: 'payment',
      amount: -value,
      paymentMethod,
      purchaseInvoiceId,
      note,
      createdAt: new Date().toISOString(),
      createdBy: authSession?.displayName,
    };
    setSupplierLedger((prev) => [entry, ...prev]);
    if (authSession) {
      logActivity(authSession, 'supplier_payment', `Tedarikçi ödeme: ${formatCurrencyTry(value)}`, { tedarikci: supplierId });
    }
    return entry;
  };

  const addPurchaseInvoiceFull = (data: {
    invoiceNo: string;
    supplierName: string;
    supplierId?: string;
    invoiceDate: string;
    grossAmount: number;
    vatRate: number;
    notes?: string;
    lines?: PurchaseInvoiceLine[];
    affectsStock?: boolean;
    paymentStatus?: PurchaseInvoice['paymentStatus'];
    paidAmount?: number;
    dueDate?: string;
  }) => {
    const amounts = data.lines && data.lines.length > 0
      ? computePurchaseLinesTotals(data.lines)
      : splitGrossAmount(data.grossAmount, data.vatRate);
    const supplier = data.supplierId
      ? suppliers.find((item) => item.id === data.supplierId)
      : undefined;
    const dueDate = data.dueDate
      ?? (supplier?.paymentTermDays
        ? addDaysIso(data.invoiceDate, supplier.paymentTermDays)
        : undefined);

    const invoice: PurchaseInvoice = {
      id: `PI${Date.now()}`,
      invoiceNo: data.invoiceNo,
      supplierName: data.supplierName,
      supplierId: data.supplierId,
      invoiceDate: data.invoiceDate,
      grossAmount: amounts.grossAmount,
      vatRate: data.vatRate,
      netAmount: amounts.netAmount,
      vatAmount: amounts.vatAmount,
      notes: data.notes,
      lines: data.lines,
      affectsStock: data.affectsStock ?? Boolean(data.lines?.length),
      paymentStatus: data.paymentStatus ?? 'unpaid',
      paidAmount: data.paidAmount ?? 0,
      dueDate,
      createdAt: new Date().toISOString(),
    };

    setPurchaseInvoices((prev) => [invoice, ...prev]);

    if (data.supplierId) {
      const ledgerEntry: SupplierLedgerEntry = {
        id: `SL${Date.now()}`,
        supplierId: data.supplierId,
        type: 'invoice',
        amount: invoice.grossAmount,
        purchaseInvoiceId: invoice.id,
        dueDate,
        createdAt: new Date().toISOString(),
        createdBy: authSession?.displayName,
      };
      setSupplierLedger((prev) => [ledgerEntry, ...prev]);
    }

    if (invoice.affectsStock && data.lines?.length) {
      const movements: StockMovement[] = [];
      setProducts((prev) =>
        prev.map((product) => {
          const line = data.lines!.find((item) => item.productId === product.id);
          if (!line) return product;
          const priced = applyPurchaseLinePricing(
            { ...product, stock: product.stock },
            line,
          );
          movements.push(
            createMovement(
              product,
              'in',
              line.quantity,
              product.stock,
              priced.stock,
              `Alış faturası ${invoice.invoiceNo}`,
            ),
          );
          return priced;
        }),
      );
      if (movements.length > 0) {
        setStockMovements((prev) => [...movements, ...prev]);
      }
    }

    if (authSession) {
      logActivity(authSession, 'purchase_invoice_add', `Alış faturası: ${invoice.invoiceNo}`, {
        tedarikci: invoice.supplierName,
        tutar: formatCurrencyTry(invoice.grossAmount),
      });
    }
    return invoice;
  };

  const reversePurchaseInvoice = (
    invoiceId: string,
    note: string,
  ): boolean => {
    const invoice = purchaseInvoices.find((item) => item.id === invoiceId);
    if (!invoice) return false;

    setPurchaseInvoices((prev) => prev.filter((item) => item.id !== invoiceId));

    if (invoice.supplierId) {
      setSupplierLedger((prev) => prev.filter(
        (entry) => !(entry.purchaseInvoiceId === invoiceId && entry.type === 'invoice'),
      ));
    }

    if (invoice.affectsStock && invoice.lines?.length) {
      const movements: StockMovement[] = [];
      setProducts((prev) =>
        prev.map((product) => {
          const line = invoice.lines!.find((item) => item.productId === product.id);
          if (!line) return product;
          const newStock = Math.max(0, product.stock - line.quantity);
          movements.push(
            createMovement(
              product,
              'out',
              line.quantity,
              product.stock,
              newStock,
              note,
            ),
          );
          return { ...product, stock: newStock };
        }),
      );
      if (movements.length > 0) {
        setStockMovements((prev) => [...movements, ...prev]);
      }
    }

    if (authSession) {
      logActivity(authSession, 'purchase_invoice_remove', `Alış faturası geri alındı: ${invoice.invoiceNo}`, {
        fatura: invoice.invoiceNo,
        tedarikci: invoice.supplierName,
      });
    }
    return true;
  };

  const addExpenseDocument = (data: {
    description: string;
    amount: number;
    category: ExpenseCategory;
    businessDate?: string;
    documentNo?: string;
    supplierName?: string;
    vatRate?: number;
  }) => {
    const gross = Math.max(0, data.amount);
    const rate = data.vatRate ?? 0;
    const split = rate > 0 ? splitGrossAmount(gross, rate) : { netAmount: gross, vatAmount: 0, grossAmount: gross };
    const expense: Expense = {
      id: `E${Date.now()}`,
      description: data.description,
      amount: gross,
      category: data.category,
      businessDate: data.businessDate,
      documentNo: data.documentNo,
      supplierName: data.supplierName,
      vatRate: rate > 0 ? rate : undefined,
      vatAmount: rate > 0 ? split.vatAmount : undefined,
      netAmount: rate > 0 ? split.netAmount : undefined,
      createdAt: new Date().toISOString(),
    };
    setExpenses((prev) => [expense, ...prev]);
    if (authSession) {
      logActivity(authSession, 'expense_add', `Gider: ${formatCurrencyTry(expense.amount)}`, { aciklama: data.description });
    }
    return expense;
  };

  const addBankAccount = (data: Omit<BankAccount, 'id' | 'createdAt'>) => {
    const account: BankAccount = {
      ...data,
      id: `BA${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setBankAccounts((prev) => [account, ...prev]);
    return account;
  };

  const addBankTransaction = (data: Omit<BankTransaction, 'id' | 'createdAt' | 'createdBy'>) => {
    const tx: BankTransaction = {
      ...data,
      id: `BT${Date.now()}`,
      createdAt: new Date().toISOString(),
      createdBy: authSession?.displayName,
    };
    setBankTransactions((prev) => [tx, ...prev]);
    return tx;
  };

  const closeAccountingPeriod = (
    periodKey: string,
    period: ReportPeriod,
    useCustomRange: boolean,
    dateFrom: string,
    dateTo: string,
    notes?: string,
  ) => {
    const snapshot = buildPeriodClosureSnapshot(
      period,
      useCustomRange,
      dateFrom,
      dateTo,
      sales,
      saleReturns,
      expenses,
      purchaseInvoices,
      products,
      deps.stockAdjustments,
      customerLedger,
      supplierLedger,
    );
    const closure: PeriodClosure = {
      id: `PC${Date.now()}`,
      periodKey,
      closedAt: new Date().toISOString(),
      closedBy: authSession?.displayName,
      notes,
      snapshot,
    };
    setPeriodClosures((prev) => [closure, ...prev]);
    if (authSession) {
      logActivity(authSession, 'period_close', `Dönem kapatıldı: ${periodKey}`);
    }
    return closure;
  };

  const addCashCountVariance = (data: Omit<CashCountVariance, 'id' | 'variance' | 'createdAt' | 'createdBy'>) => {
    const variance = data.countedBalance - data.systemBalance;
    const record: CashCountVariance = {
      ...data,
      id: `CV${Date.now()}`,
      variance,
      createdAt: new Date().toISOString(),
      createdBy: authSession?.displayName,
    };
    setCashCountVariances((prev) => [record, ...prev]);
    return record;
  };

  const addCheckNote = (data: Omit<CheckNote, 'id' | 'createdAt'>) => {
    const note: CheckNote = {
      ...data,
      id: `CN${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setCheckNotes((prev) => [note, ...prev]);
    return note;
  };

  const updateEquityPartner = (
    partnerId: string,
    data: Partial<Pick<EquityPartner, 'name' | 'country' | 'sharePercent' | 'email' | 'notes'>>,
  ) => {
    setEquityPartners((prev) =>
      prev.map((partner) => (partner.id === partnerId ? { ...partner, ...data } : partner)),
    );
  };

  const postAccountingVoucher = (input: VoucherInput) => {
    let resolvedInput: VoucherInput = { ...input };

    if (input.type === 'partner_capital') {
      const partner = equityPartners.find((item) => item.id === input.partnerId);
      if (!partner) return null;
      const amountTry = resolveVoucherAmount(input);
      resolvedInput = {
        ...input,
        amount: amountTry,
        partnerAccountCode: partner.accountCode,
        partnerName: partner.name,
        paymentSource: input.paymentSource ?? 'bank',
      };
    }

    const lines = buildJournalLinesPreview(resolvedInput);
    if (lines.length === 0) return null;

    const dateKey = resolvedInput.date;
    const voucherNo = nextVoucherNo(journalVouchers, dateKey);
    const voucherId = `JV${Date.now()}`;
    let sourceRefId: string | undefined;
    let linkedBankTransactionId: string | undefined;
    let linkedCheckNoteId: string | undefined;
    let resolvedSupplierId = resolvedInput.supplierId;
    let resolvedSupplierName = resolvedInput.supplierName;

    const recordBankTx = (
      data: Omit<BankTransaction, 'id' | 'createdAt' | 'createdBy'>,
    ) => {
      const tx = addBankTransaction({
        ...data,
        reference: data.reference ?? voucherId,
      });
      linkedBankTransactionId = tx.id;
      return tx;
    };

    switch (resolvedInput.type) {
      case 'customer_collection': {
        if (!resolvedInput.customerId || resolvedInput.amount <= 0) return null;
        const method = resolvedInput.paymentSource === 'bank'
          ? 'transfer'
          : resolvedInput.paymentSource === 'check'
            ? 'check'
            : resolvedInput.paymentSource === 'card'
              ? 'card'
              : 'cash';
        const entry = addCustomerPayment(resolvedInput.customerId, resolvedInput.amount, method, resolvedInput.description);
        sourceRefId = entry?.id;
        if (resolvedInput.paymentSource === 'bank' && resolvedInput.bankAccountId) {
          recordBankTx({
            bankAccountId: resolvedInput.bankAccountId,
            type: 'deposit',
            amount: resolvedInput.amount,
            note: resolvedInput.description || 'Müşteri tahsilat',
          });
        }
        if (resolvedInput.paymentSource === 'check') {
          const payer = deps.customers.find((c) => c.id === resolvedInput.customerId);
          const checkNote = addCheckNote({
            direction: 'received',
            kind: 'check',
            amount: resolvedInput.amount,
            dueDate: resolvedInput.checkDueDate ?? dateKey,
            drawer: payer?.name ?? resolvedInput.description,
            customerId: resolvedInput.customerId,
            status: 'pending',
            note: resolvedInput.description || 'Müşteri tahsilat (çek)',
          });
          linkedCheckNoteId = checkNote?.id;
        }
        break;
      }
      case 'supplier_payment': {
        if (resolvedInput.amount <= 0) return null;
        if (!resolvedSupplierId && resolvedInput.supplierName?.trim()) {
          const supplier = addSupplier({ name: resolvedInput.supplierName.trim() });
          resolvedSupplierId = supplier.id;
          resolvedSupplierName = supplier.name;
        }
        if (!resolvedSupplierId) return null;
        const method = resolvedInput.paymentSource === 'check' ? 'check' : resolvedInput.paymentSource === 'cash' ? 'cash' : 'transfer';
        const entry = addSupplierPayment(resolvedSupplierId, resolvedInput.amount, method, resolvedInput.description);
        sourceRefId = entry?.id;
        if (resolvedInput.paymentSource === 'bank' && resolvedInput.bankAccountId) {
          recordBankTx({
            bankAccountId: resolvedInput.bankAccountId,
            type: 'supplier_payment',
            amount: -resolvedInput.amount,
            note: resolvedInput.description || 'Tedarikçi ödeme',
          });
        }
        break;
      }
      case 'expense': {
        if (resolvedInput.amount <= 0 || !resolvedInput.description.trim()) return null;
        const expense = addExpenseDocument({
          description: resolvedInput.description.trim(),
          amount: resolvedInput.amount,
          category: resolvedInput.expenseCategory ?? 'other',
          businessDate: dateKey,
          documentNo: resolvedInput.documentNo,
          supplierName: resolvedInput.supplierName,
          vatRate: resolvedInput.vatRate,
        });
        sourceRefId = expense?.id;
        if (resolvedInput.paymentSource === 'bank' && resolvedInput.bankAccountId) {
          recordBankTx({
            bankAccountId: resolvedInput.bankAccountId,
            type: 'withdrawal',
            amount: -resolvedInput.amount,
            note: resolvedInput.description.trim() || 'Gider ödemesi',
          });
        }
        break;
      }
      case 'bank_movement': {
        const kind = resolvedInput.bankMovementKind ?? 'cash_to_bank';
        if (!resolvedInput.bankAccountId || resolvedInput.amount <= 0) return null;

        if (kind === 'cash_to_bank') {
          const tx = recordBankTx({
            bankAccountId: resolvedInput.bankAccountId,
            type: 'deposit',
            amount: resolvedInput.amount,
            note: resolvedInput.description || 'Kasa → banka virman',
          });
          sourceRefId = tx?.id;
          break;
        }
        if (kind === 'bank_to_cash') {
          const tx = recordBankTx({
            bankAccountId: resolvedInput.bankAccountId,
            type: 'withdrawal',
            amount: -resolvedInput.amount,
            note: resolvedInput.description || 'Banka → kasa virman',
          });
          sourceRefId = tx?.id;
          break;
        }
        if (kind === 'customer_collection') {
          if (!resolvedInput.customerId) return null;
          const entry = addCustomerPayment(
            resolvedInput.customerId,
            resolvedInput.amount,
            'transfer',
            resolvedInput.description,
          );
          sourceRefId = entry?.id;
          recordBankTx({
            bankAccountId: resolvedInput.bankAccountId,
            type: 'deposit',
            amount: resolvedInput.amount,
            note: resolvedInput.description || 'Müşteri tahsilat',
          });
          break;
        }
        if (kind === 'customer_refund') {
          if (!resolvedInput.customerId) return null;
          if (resolvedInput.linkedSaleReturnId) {
            sourceRefId = resolvedInput.linkedSaleReturnId;
          } else {
            const entry = addCustomerRefund(
              resolvedInput.customerId,
              resolvedInput.amount,
              'transfer',
              resolvedInput.description,
            );
            sourceRefId = entry?.id;
          }
          recordBankTx({
            bankAccountId: resolvedInput.bankAccountId,
            type: 'withdrawal',
            amount: -resolvedInput.amount,
            note: resolvedInput.description || 'Müşteri iadesi',
          });
          break;
        }
        if (kind === 'expense_payment') {
          if (!resolvedInput.description.trim()) return null;
          const expense = addExpenseDocument({
            description: resolvedInput.description.trim(),
            amount: resolvedInput.amount,
            category: resolvedInput.expenseCategory ?? 'other',
            businessDate: dateKey,
            documentNo: resolvedInput.documentNo,
            vatRate: resolvedInput.vatRate,
          });
          sourceRefId = expense?.id;
          recordBankTx({
            bankAccountId: resolvedInput.bankAccountId,
            type: 'withdrawal',
            amount: -resolvedInput.amount,
            note: resolvedInput.description.trim(),
          });
          break;
        }
        if (kind === 'supplier_payment') {
          if (!resolvedSupplierId && resolvedInput.supplierName?.trim()) {
            const supplier = addSupplier({ name: resolvedInput.supplierName.trim() });
            resolvedSupplierId = supplier.id;
            resolvedSupplierName = supplier.name;
          }
          if (!resolvedSupplierId) return null;
          const entry = addSupplierPayment(
            resolvedSupplierId,
            resolvedInput.amount,
            'transfer',
            resolvedInput.description,
          );
          sourceRefId = entry?.id;
          recordBankTx({
            bankAccountId: resolvedInput.bankAccountId,
            type: 'supplier_payment',
            amount: -resolvedInput.amount,
            note: resolvedInput.description || 'Tedarikçi ödeme',
          });
          break;
        }
        if (kind === 'supplier_refund') {
          if (!resolvedSupplierId && resolvedInput.supplierName?.trim()) {
            const supplier = addSupplier({ name: resolvedInput.supplierName.trim() });
            resolvedSupplierId = supplier.id;
            resolvedSupplierName = supplier.name;
          }
          if (!resolvedSupplierId) return null;
          const entry = addSupplierPayment(
            resolvedSupplierId,
            resolvedInput.amount,
            'transfer',
            `Tedarikçi iadesi${resolvedInput.description ? ` — ${resolvedInput.description}` : ''}`,
          );
          sourceRefId = entry?.id;
          recordBankTx({
            bankAccountId: resolvedInput.bankAccountId,
            type: 'deposit',
            amount: resolvedInput.amount,
            note: resolvedInput.description || 'Tedarikçi iadesi',
          });
          break;
        }
        return null;
      }
      case 'bank_deposit': {
        if (!resolvedInput.bankAccountId || resolvedInput.amount <= 0) return null;
        const tx = recordBankTx({
          bankAccountId: resolvedInput.bankAccountId,
          type: 'deposit',
          amount: resolvedInput.amount,
          note: resolvedInput.description || 'Banka para girişi',
        });
        sourceRefId = tx?.id;
        break;
      }
      case 'bank_withdrawal': {
        if (!resolvedInput.bankAccountId || resolvedInput.amount <= 0) return null;
        const tx = recordBankTx({
          bankAccountId: resolvedInput.bankAccountId,
          type: 'withdrawal',
          amount: -resolvedInput.amount,
          note: resolvedInput.description || 'Banka para çıkışı',
        });
        sourceRefId = tx?.id;
        break;
      }
      case 'purchase_invoice': {
        if (!resolvedInput.invoiceNo?.trim()) return null;
        const affectsStock = resolvedInput.affectsStock ?? true;
        const stockLines = affectsStock
          ? (resolvedInput.purchaseLines?.length
            ? resolvedInput.purchaseLines
            : (resolvedInput.productId
              ? [{
                productId: resolvedInput.productId,
                quantity: resolvedInput.quantity ?? 1,
                unitCostNet: resolvedInput.unitCostNet ?? 0,
                vatRate: resolvedInput.vatRate ?? 20,
              }]
              : []))
          : [];
        const lineTotals = stockLines.length > 0
          ? computePurchaseLinesTotals(stockLines)
          : null;
        const gross = lineTotals?.grossAmount ?? resolvedInput.amount;
        const rate = lineTotals?.vatRate ?? (resolvedInput.vatRate ?? 20);
        if (gross <= 0) return null;
        if (affectsStock && stockLines.length === 0) return null;
        if (!resolvedSupplierId && !resolvedInput.supplierName?.trim()) return null;
        if (!resolvedSupplierId && resolvedInput.supplierName?.trim()) {
          const supplier = addSupplier({ name: resolvedInput.supplierName.trim() });
          resolvedSupplierId = supplier.id;
          resolvedSupplierName = supplier.name;
        }
        const supplierLabel = resolvedSupplierName
          ?? resolvedInput.supplierName?.trim()
          ?? suppliers.find((s) => s.id === resolvedSupplierId)?.name
          ?? 'Tedarikçi';
        const invoice = addPurchaseInvoiceFull({
          invoiceNo: resolvedInput.invoiceNo.trim(),
          supplierName: supplierLabel,
          supplierId: resolvedSupplierId,
          invoiceDate: resolvedInput.invoiceDate ?? dateKey,
          grossAmount: gross,
          vatRate: rate,
          affectsStock,
          lines: affectsStock && stockLines.length > 0 ? stockLines : undefined,
          paymentStatus: 'unpaid',
        });
        sourceRefId = invoice?.id;
        break;
      }
      case 'check_received': {
        if (resolvedInput.amount <= 0 || !resolvedInput.checkDrawer?.trim()) return null;
        const note = addCheckNote({
          direction: 'received',
          kind: 'check',
          amount: resolvedInput.amount,
          dueDate: resolvedInput.checkDueDate ?? dateKey,
          drawer: resolvedInput.checkDrawer.trim(),
          customerId: resolvedInput.customerId,
          status: 'pending',
        });
        sourceRefId = note?.id;
        break;
      }
      case 'partner_capital': {
        if (!resolvedInput.partnerId || resolvedInput.amount <= 0) return null;
        const contribution: CapitalContribution = {
          id: `CC${Date.now()}`,
          partnerId: resolvedInput.partnerId,
          amountTry: resolvedInput.amount,
          amountForeign: resolvedInput.amountForeign,
          currency: resolvedInput.currency,
          exchangeRate: resolvedInput.exchangeRate,
          contributionDate: dateKey,
          paymentSource: resolvedInput.paymentSource === 'cash' ? 'cash' : 'bank',
          bankAccountId: resolvedInput.bankAccountId,
          documentNo: resolvedInput.documentNo,
          note: resolvedInput.description,
          createdAt: new Date().toISOString(),
          createdBy: authSession?.displayName,
        };
        setCapitalContributions((prev) => [contribution, ...prev]);
        sourceRefId = contribution.id;
        if (resolvedInput.paymentSource === 'bank' && resolvedInput.bankAccountId) {
          recordBankTx({
            bankAccountId: resolvedInput.bankAccountId,
            type: 'deposit',
            amount: resolvedInput.amount,
            note: resolvedInput.description || `Ortak sermaye: ${resolvedInput.partnerName}`,
          });
        }
        break;
      }
      case 'cash_variance': {
        if (resolvedInput.systemBalance == null || resolvedInput.countedBalance == null) return null;
        const record = addCashCountVariance({
          sessionDate: dateKey,
          systemBalance: resolvedInput.systemBalance,
          countedBalance: resolvedInput.countedBalance,
          note: resolvedInput.description || 'Kasa sayım farkı',
        });
        sourceRefId = record?.id;
        break;
      }
      default:
        return null;
    }

    const customer = resolvedInput.customerId
      ? deps.customers.find((c) => c.id === resolvedInput.customerId)
      : undefined;
    const bankAccount = resolvedInput.bankAccountId
      ? deps.bankAccounts.find((a) => a.id === resolvedInput.bankAccountId)
      : undefined;
    const supplier = resolvedSupplierId
      ? suppliers.find((s) => s.id === resolvedSupplierId)
      : undefined;
    const partner = resolvedInput.partnerId
      ? equityPartners.find((p) => p.id === resolvedInput.partnerId)
      : undefined;

    const voucherAmount = resolveVoucherAmount(resolvedInput);

    const voucher: JournalVoucher = {
      id: voucherId,
      voucherNo,
      transactionType: resolvedInput.type,
      date: dateKey,
      description: resolvedInput.description,
      lines,
      amount: voucherAmount,
      paymentSource: resolvedInput.type === 'bank_movement' ? 'bank' : resolvedInput.paymentSource,
      customerId: resolvedInput.customerId,
      customerName: customer?.name,
      supplierId: resolvedSupplierId,
      supplierName: supplier?.name ?? resolvedSupplierName,
      bankAccountId: resolvedInput.bankAccountId,
      bankAccountName: bankAccount?.name,
      partnerId: resolvedInput.partnerId,
      partnerName: partner?.name ?? resolvedInput.partnerName,
      partnerAccountCode: resolvedInput.partnerAccountCode ?? partner?.accountCode,
      documentNo: resolvedInput.documentNo,
      sourceRefId,
      linkedSaleId: resolvedInput.linkedSaleId,
      linkedSaleReturnId: resolvedInput.linkedSaleReturnId,
      linkedBankTransactionId,
      linkedCheckNoteId,
      currency: resolvedInput.currency,
      amountForeign: resolvedInput.amountForeign,
      exchangeRate: resolvedInput.exchangeRate,
      attachmentName: resolvedInput.attachmentName,
      attachmentDataUrl: resolvedInput.attachmentDataUrl,
      bankMovementKind: resolvedInput.bankMovementKind,
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: authSession?.displayName,
    };

    setJournalVouchers((prev) => [voucher, ...prev]);
    if (resolvedInput.linkedSaleReturnId) {
      setSaleReturns((prev) =>
        prev.map((item) => (
          item.id === resolvedInput.linkedSaleReturnId
            ? {
              ...item,
              journalVoucherId: voucher.id,
              bankAccountId: resolvedInput.bankAccountId,
            }
            : item
        )),
      );
    }
    if (resolvedInput.type === 'partner_capital' && sourceRefId) {
      setCapitalContributions((prev) =>
        prev.map((item) => (item.id === sourceRefId ? { ...item, journalVoucherId: voucher.id } : item)),
      );
    }
    if (authSession) {
      logActivity(authSession, 'journal_voucher', `Muhasebe fişi: ${voucherNo}`, {
        tur: resolvedInput.type,
        tutar: formatCurrencyTry(voucherAmount),
      });
    }
    return voucher;
  };

  const reverseBankForVoucher = (target: JournalVoucher) => {
    const byReference = bankTransactions.filter((tx) => tx.reference === target.id);
    let toReverse = byReference;
    if (toReverse.length === 0 && target.linkedBankTransactionId) {
      const linked = bankTransactions.find((tx) => tx.id === target.linkedBankTransactionId);
      if (linked) toReverse = [linked];
    }
    if (toReverse.length > 0) {
      for (const tx of toReverse) {
        addBankTransaction({
          bankAccountId: tx.bankAccountId,
          type: 'adjustment',
          amount: -tx.amount,
          note: `Fiş iptal ters kayıt: ${target.voucherNo}`,
          reference: target.id,
        });
      }
      return;
    }
    if (!target.bankAccountId || target.amount <= 0) return;
    let legacyAmount: number | null = null;
    if (target.transactionType === 'customer_collection' && target.paymentSource === 'bank') {
      legacyAmount = -target.amount;
    } else if (target.transactionType === 'supplier_payment' && target.paymentSource === 'bank') {
      legacyAmount = target.amount;
    } else if (target.transactionType === 'expense' && target.paymentSource === 'bank') {
      legacyAmount = target.amount;
    } else if (target.transactionType === 'bank_deposit') {
      legacyAmount = -target.amount;
    } else if (target.transactionType === 'bank_withdrawal') {
      legacyAmount = target.amount;
    } else if (target.transactionType === 'partner_capital' && target.paymentSource === 'bank') {
      legacyAmount = -target.amount;
    } else if (target.transactionType === 'bank_movement' && target.bankMovementKind) {
      const kind = target.bankMovementKind;
      if (kind === 'cash_to_bank' || kind === 'customer_collection' || kind === 'supplier_refund') {
        legacyAmount = -target.amount;
      } else if (
        kind === 'bank_to_cash'
        || kind === 'customer_refund'
        || kind === 'expense_payment'
        || kind === 'supplier_payment'
      ) {
        legacyAmount = target.amount;
      }
    }
    if (legacyAmount == null) return;
    addBankTransaction({
      bankAccountId: target.bankAccountId,
      type: 'adjustment',
      amount: legacyAmount,
      note: `Fiş iptal ters kayıt: ${target.voucherNo}`,
      reference: target.id,
    });
  };

  const reverseLinkedSaleReturn = (target: JournalVoucher) => {
    const returnId = target.linkedSaleReturnId;
    if (!returnId) return;
    const record = saleReturns.find((entry) => entry.id === returnId);
    if (!record) return;
    const sale = sales.find((entry) => entry.id === record.originalSaleId);
    const remainingReturns = saleReturns.filter((entry) => entry.id !== returnId);
    setSaleReturns(remainingReturns);
    if (sale?.customerId && record.refundTotal > 0) {
      setCustomerLedger((prev) => [{
        id: `CL${Date.now()}`,
        customerId: sale.customerId!,
        type: 'adjustment',
        amount: record.refundTotal,
        note: `Fiş iptal — satış iadesi geri alındı: ${target.voucherNo}`,
        reference: target.id,
        createdAt: new Date().toISOString(),
        createdBy: authSession?.displayName,
      }, ...prev]);
    }
    if (sale) {
      const nextStatus = getSaleStatus(sale, remainingReturns);
      setSales((prev) => prev.map((entry) => (
        entry.id === sale.id ? { ...entry, status: nextStatus } : entry
      )));
    }
  };

  const voidJournalVoucher = (voucherId: string, reason?: string) => {
    const target = journalVouchers.find((v) => v.id === voucherId);
    if (!target || target.status === 'voided') return null;
    const voidNote = reason?.trim() || 'İptal edildi';

    if (target.linkedSaleReturnId) {
      reverseLinkedSaleReturn(target);
    }

    switch (target.transactionType) {
      case 'customer_collection': {
        if (target.customerId) {
          const reversal: CustomerLedgerEntry = {
            id: `CL${Date.now()}`,
            customerId: target.customerId,
            type: 'adjustment',
            amount: target.amount,
            note: `Fiş iptal: ${target.voucherNo} — ${voidNote}`,
            reference: target.id,
            createdAt: new Date().toISOString(),
            createdBy: authSession?.displayName,
          };
          setCustomerLedger((prev) => [reversal, ...prev]);
        }
        if (target.linkedCheckNoteId) {
          setCheckNotes((prev) => prev.map((note) => (
            note.id === target.linkedCheckNoteId
              ? { ...note, status: 'cancelled', note: `İptal: ${target.voucherNo}` }
              : note
          )));
        }
        break;
      }
      case 'supplier_payment': {
        if (target.supplierId) {
          const reversal: SupplierLedgerEntry = {
            id: `SL${Date.now()}`,
            supplierId: target.supplierId,
            type: 'adjustment',
            amount: target.amount,
            note: `Fiş iptal: ${target.voucherNo} — ${voidNote}`,
            reference: target.id,
            createdAt: new Date().toISOString(),
            createdBy: authSession?.displayName,
          };
          setSupplierLedger((prev) => [reversal, ...prev]);
        }
        break;
      }
      case 'expense': {
        if (target.sourceRefId) {
          setExpenses((prev) => prev.filter((item) => item.id !== target.sourceRefId));
        }
        break;
      }
      case 'bank_movement': {
        const kind = target.bankMovementKind;
        const movementCustomerId = target.customerId;
        const movementSupplierId = target.supplierId;
        if (kind === 'customer_collection' && movementCustomerId) {
          setCustomerLedger((prev) => [{
            id: `CL${Date.now()}`,
            customerId: movementCustomerId,
            type: 'adjustment',
            amount: target.amount,
            note: `Fiş iptal: ${target.voucherNo} — ${voidNote}`,
            reference: target.id,
            createdAt: new Date().toISOString(),
            createdBy: authSession?.displayName,
          }, ...prev]);
        } else if (kind === 'customer_refund' && movementCustomerId && !target.linkedSaleReturnId) {
          setCustomerLedger((prev) => [{
            id: `CL${Date.now()}`,
            customerId: movementCustomerId,
            type: 'adjustment',
            amount: -target.amount,
            note: `Fiş iptal: ${target.voucherNo} — ${voidNote}`,
            reference: target.id,
            createdAt: new Date().toISOString(),
            createdBy: authSession?.displayName,
          }, ...prev]);
        } else if (kind === 'supplier_payment' && movementSupplierId) {
          const supplierId = movementSupplierId;
          const reversal: SupplierLedgerEntry = {
            id: `SL${Date.now()}`,
            supplierId,
            type: 'adjustment',
            amount: target.amount,
            note: `Fiş iptal: ${target.voucherNo} — ${voidNote}`,
            reference: target.id,
            createdAt: new Date().toISOString(),
            createdBy: authSession?.displayName,
          };
          setSupplierLedger((prev) => [reversal, ...prev]);
        } else if (kind === 'supplier_refund' && movementSupplierId) {
          const supplierId = movementSupplierId;
          const reversal: SupplierLedgerEntry = {
            id: `SL${Date.now()}`,
            supplierId,
            type: 'adjustment',
            amount: -target.amount,
            note: `Fiş iptal: ${target.voucherNo} — ${voidNote}`,
            reference: target.id,
            createdAt: new Date().toISOString(),
            createdBy: authSession?.displayName,
          };
          setSupplierLedger((prev) => [reversal, ...prev]);
        } else if (kind === 'expense_payment' && target.sourceRefId) {
          setExpenses((prev) => prev.filter((item) => item.id !== target.sourceRefId));
        }
        break;
      }
      case 'purchase_invoice': {
        if (target.sourceRefId) {
          reversePurchaseInvoice(
            target.sourceRefId,
            `Fiş iptal: ${target.voucherNo} — ${voidNote}`,
          );
        }
        break;
      }
      default:
        break;
    }

    reverseBankForVoucher(target);

    setJournalVouchers((prev) => prev.map((v) => (
      v.id === voucherId
        ? {
          ...v,
          status: 'voided',
          voidedAt: new Date().toISOString(),
          voidReason: voidNote,
        }
        : v
    )));
    if (authSession) {
      logActivity(authSession, 'journal_voucher', `Fiş iptal: ${target.voucherNo}`, {
        sebep: voidNote,
      });
    }
    return target;
  };

  const addStockAdjustment = (data: Omit<StockAdjustment, 'id' | 'createdAt' | 'createdBy'>) => {
    const adjustment: StockAdjustment = {
      ...data,
      id: `SA${Date.now()}`,
      createdAt: new Date().toISOString(),
      createdBy: authSession?.displayName,
    };
    setStockAdjustments((prev) => [adjustment, ...prev]);

    const product = products.find((item) => item.id === data.productId);
    if (product) {
      const newStock = Math.max(0, product.stock + data.quantityDelta);
      setProducts((prev) =>
        prev.map((item) => (item.id === data.productId ? { ...item, stock: newStock } : item)),
      );
      setStockMovements((prev) => [
        createMovement(
          product,
          'adjust',
          Math.abs(data.quantityDelta),
          product.stock,
          newStock,
          data.note ?? `Stok düzeltme (${data.type})`,
        ),
        ...prev,
      ]);
    }
    return adjustment;
  };

  return {
    addSupplier,
    updateSupplier,
    removeSupplier,
    addCustomerPayment,
    addCreditSaleLedger,
    addSupplierPayment,
    addPurchaseInvoiceFull,
    reversePurchaseInvoice,
    addExpenseDocument,
    addBankAccount,
    addBankTransaction,
    closeAccountingPeriod,
    addCashCountVariance,
    addCheckNote,
    addStockAdjustment,
    postAccountingVoucher,
    voidJournalVoucher,
    updateEquityPartner,
  };
}
