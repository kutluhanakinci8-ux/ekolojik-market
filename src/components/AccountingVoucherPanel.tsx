import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Store } from '../store/useStore';
import type { ExpenseCategory } from '../types/business';
import type { JournalVoucher, VoucherInput, VoucherPaymentSource, VoucherTransactionType } from '../types/journalVoucher';
import { VOUCHER_TYPE_LABELS } from '../types/journalVoucher';
import { resolveVoucherAmount } from '../utils/journalVoucherBuilder';
import {
  EXPENSE_CATEGORY_ADD_OPTION,
  getExpenseCategoryLabel,
  listExpenseCategorySelectOptions,
  validateNewExpenseCategoryLabel,
} from '../utils/expenseCategories';
import { CHART_OF_ACCOUNTS } from '../data/chartOfAccounts';
import { buildJournalLinesPreview, summarizeVoucherLines, voucherTypeIcon } from '../utils/journalVoucherBuilder';
import { formatCurrency, formatDateTime } from '../utils/format';
import { DEFAULT_VAT_RATE } from '../utils/vatAnalytics';
import type { SupportedCurrency } from '../types/currency';
import { formatConversionHint, getRateToTry } from '../utils/currencyConversion';
import { getBankAccountBalance, getCustomerBalance, getSupplierBalance } from '../utils/accountingAnalytics';
import type { BankMovementKind } from '../types/journalVoucher';
import {
  BANK_MOVEMENT_KIND_LABELS,
  BANK_MOVEMENT_KINDS,
  bankMovementKindNeedsCustomer,
  bankMovementKindNeedsExpenseFields,
  bankMovementKindNeedsSupplier,
  legacyTypeToBankMovementKind,
} from '../utils/bankMovement';
import {
  buildAutoDescription,
  EXPENSE_TEMPLATES,
  formatAmountInput,
  parseAmountInput,
  paymentSourceLabel,
  validateVoucherInput,
  type VoucherFieldErrors,
} from '../utils/voucherForm';
import { VoucherEntitySearch } from './VoucherEntitySearch';
import { BankStatementPanel } from './BankStatementPanel';
import { CustomerStatementPanel } from './CustomerStatementPanel';
import { SupplierStatementPanel } from './SupplierStatementPanel';
import {
  buildFullSaleReturnRequest,
  buildReturnLines,
  listCustomerSalesForBankRefund,
} from '../utils/saleReturn';
import {
  buildProductVoucherSearchOptions,
  computePurchaseLinesTotals,
  createEmptyPurchaseLineDraft,
  fillPurchaseLineDraftFromProduct,
  grossFromNetUnit,
  parsePurchaseLineDrafts,
  purchaseLineDraftsFromInvoiceLines,
  type PurchaseLineDraft,
} from '../utils/purchaseInvoiceLines';

const TRANSACTION_TYPES: VoucherTransactionType[] = [
  'customer_collection',
  'supplier_payment',
  'expense',
  'bank_movement',
  'purchase_invoice',
  'check_received',
  'cash_variance',
  'partner_capital',
];

const CAPITAL_PAYMENT_SOURCES: { id: VoucherPaymentSource; label: string }[] = [
  { id: 'bank', label: 'Banka (102)' },
  { id: 'cash', label: 'Kasa (100)' },
];

const PAYMENT_SOURCES: { id: VoucherPaymentSource; label: string }[] = [
  { id: 'cash', label: 'Kasa (100)' },
  { id: 'card', label: 'Kredi Kartı' },
  { id: 'bank', label: 'Banka (102)' },
  { id: 'check', label: 'Çek/Senet (101)' },
];

const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

type RecentVoucherFilter = 'all' | 'collection' | 'customer';

function voucherPartyLabel(v: JournalVoucher): string {
  return v.customerName || v.supplierName || v.partnerName || v.description || '—';
}

function VoucherFieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="voucher-label">
      {children}
      {required && <span className="req" aria-hidden="true"> *</span>}
    </span>
  );
}

function todayIsoDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function systemCashBalance(store: Store): number {
  return store.todayOpeningBalance + store.todayTotal - store.todayExpenseTotal;
}

interface AccountingVoucherPanelProps {
  store: Store;
}

export function AccountingVoucherPanel({ store }: AccountingVoucherPanelProps) {
  const [txType, setTxType] = useState<VoucherTransactionType>('customer_collection');
  const [date, setDate] = useState(todayIsoDate());
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentSource, setPaymentSource] = useState<VoucherPaymentSource>('cash');
  const [bankAccountId, setBankAccountId] = useState('');
  const [bankMovementKind, setBankMovementKind] = useState<BankMovementKind>('cash_to_bank');
  const [customerId, setCustomerId] = useState('');
  const [linkedSaleId, setLinkedSaleId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>('other');
  const [documentNo, setDocumentNo] = useState('');
  const [vatRate, setVatRate] = useState(String(DEFAULT_VAT_RATE));
  const [invoiceNo, setInvoiceNo] = useState('');
  const [affectsStock, setAffectsStock] = useState(true);
  const [purchaseLineDrafts, setPurchaseLineDrafts] = useState<PurchaseLineDraft[]>(
    () => [createEmptyPurchaseLineDraft()],
  );
  /** Alış faturası girilirken sağ önizleme kapanır; kayıt sonrası tekrar açılır */
  const [purchaseInvoiceWideLayout, setPurchaseInvoiceWideLayout] = useState(false);
  const [checkDrawer, setCheckDrawer] = useState('');
  const [checkDueDate, setCheckDueDate] = useState(todayIsoDate());
  const [systemBalance, setSystemBalance] = useState(String(systemCashBalance(store)));
  const [countedBalance, setCountedBalance] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [currency, setCurrency] = useState<SupportedCurrency>('USD');
  const [amountForeign, setAmountForeign] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  const [useForeignAmount, setUseForeignAmount] = useState(false);
  const [useForeignCollection, setUseForeignCollection] = useState(false);
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentDataUrl, setAttachmentDataUrl] = useState('');
  const [fieldErrors, setFieldErrors] = useState<VoucherFieldErrors>({});
  const [saveMessage, setSaveMessage] = useState('');
  const [detailVoucher, setDetailVoucher] = useState<JournalVoucher | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [recentFilter, setRecentFilter] = useState<RecentVoucherFilter>('collection');
  const [highlightVoucherId, setHighlightVoucherId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [showNewExpenseCategory, setShowNewExpenseCategory] = useState(false);
  const [newExpenseCategoryName, setNewExpenseCategoryName] = useState('');
  const [newExpenseCategoryAccount, setNewExpenseCategoryAccount] = useState('770');
  const [newExpenseCategoryError, setNewExpenseCategoryError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastAutoDesc = useRef('');
  const recentListRef = useRef<HTMLUListElement>(null);

  const selectedPartner = store.equityPartners.find((p) => p.id === partnerId);
  const selectedCustomer = store.customers.find((c) => c.id === customerId);
  const selectedSupplier = store.suppliers.find((s) => s.id === supplierId);

  const customerBalance = useMemo(() => {
    if (!customerId) return null;
    const entries = store.customerLedger.filter((e) => e.customerId === customerId);
    return getCustomerBalance(entries);
  }, [customerId, store.customerLedger]);

  const supplierBalance = useMemo(() => {
    if (!supplierId) return null;
    const entries = store.supplierLedger.filter((e) => e.supplierId === supplierId);
    return getSupplierBalance(entries);
  }, [supplierId, store.supplierLedger]);

  const refundableSalesForBank = useMemo(
    () => (
      customerId
        ? listCustomerSalesForBankRefund(customerId, store.sales, store.saleReturns)
        : []
    ),
    [customerId, store.sales, store.saleReturns],
  );

  const productSearchOptions = useMemo(
    () => buildProductVoucherSearchOptions(store.products),
    [store.products],
  );

  const parsedPurchaseLines = useMemo(
    () => parsePurchaseLineDrafts(purchaseLineDrafts),
    [purchaseLineDrafts],
  );

  const purchaseGross = useMemo(() => {
    if (!affectsStock || parsedPurchaseLines.length === 0) return 0;
    return computePurchaseLinesTotals(parsedPurchaseLines).grossAmount;
  }, [affectsStock, parsedPurchaseLines]);

  const usesForeign =
    (txType === 'partner_capital' && useForeignAmount)
    || (txType === 'customer_collection' && useForeignCollection);

  const customExpenseCategories = store.settings.customExpenseCategories ?? [];
  const expenseCategoryOptions = useMemo(
    () => listExpenseCategorySelectOptions(customExpenseCategories),
    [customExpenseCategories],
  );
  const expenseAccountOptions = useMemo(
    () => CHART_OF_ACCOUNTS.filter((account) => account.type === 'expense'),
    [],
  );

  const draftInput = useMemo((): VoucherInput => ({
    type: txType,
    date,
    description,
    amount: txType === 'purchase_invoice'
      ? (affectsStock ? purchaseGross : parseAmountInput(amount))
      : parseAmountInput(amount),
    paymentSource,
    bankAccountId: bankAccountId || undefined,
    customerId: customerId || undefined,
    supplierId: supplierId || undefined,
    supplierName: supplierName.trim() || undefined,
    expenseCategory,
    customExpenseCategories,
    bankMovementKind: txType === 'bank_movement' ? bankMovementKind : undefined,
    documentNo: documentNo.trim() || undefined,
    vatRate: parseFloat(vatRate) || 0,
    invoiceNo: invoiceNo.trim() || undefined,
    invoiceDate: date,
    affectsStock,
    purchaseLines: parsedPurchaseLines.length > 0 ? parsedPurchaseLines : undefined,
    checkDrawer: checkDrawer.trim() || undefined,
    checkDueDate,
    systemBalance: parseAmountInput(systemBalance),
    countedBalance: parseAmountInput(countedBalance),
    partnerId: partnerId || undefined,
    partnerAccountCode: selectedPartner?.accountCode,
    partnerName: selectedPartner?.name,
    currency: usesForeign ? currency : undefined,
    amountForeign: usesForeign ? parseAmountInput(amountForeign) : undefined,
    exchangeRate: usesForeign ? parseAmountInput(exchangeRate) : undefined,
    attachmentName: attachmentName || undefined,
    attachmentDataUrl: attachmentDataUrl || undefined,
    linkedSaleId: linkedSaleId || undefined,
  }), [
    txType, date, description, amount, paymentSource, bankAccountId, customerId, linkedSaleId,
    supplierId, supplierName, expenseCategory, customExpenseCategories, bankMovementKind, documentNo, vatRate, invoiceNo,
    affectsStock, checkDrawer, checkDueDate,
    systemBalance, countedBalance, partnerId, selectedPartner, currency, amountForeign,
    exchangeRate, usesForeign, purchaseGross, parsedPurchaseLines, attachmentName, attachmentDataUrl,
  ]);

  const resolvedAmount = useMemo(() => resolveVoucherAmount(draftInput), [draftInput]);
  const previewLines = useMemo(() => buildJournalLinesPreview(draftInput), [draftInput]);
  const lineSummary = useMemo(() => summarizeVoucherLines(previewLines), [previewLines]);

  const recentVouchers = useMemo(() => {
    let list = [...store.journalVouchers].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (txType === 'customer_collection') {
      if (recentFilter === 'collection') {
        list = list.filter((v) => v.transactionType === 'customer_collection');
      } else if (recentFilter === 'customer' && customerId) {
        list = list.filter((v) => v.transactionType === 'customer_collection' && v.customerId === customerId);
      }
    }
    return list.slice(0, 8);
  }, [store.journalVouchers, txType, recentFilter, customerId]);

  const balanceAfterCollection = useMemo(() => {
    if (customerBalance == null || txType !== 'customer_collection') return null;
    return Math.round((customerBalance - resolvedAmount) * 100) / 100;
  }, [customerBalance, resolvedAmount, txType]);

  const balanceAfterSupplierPayment = useMemo(() => {
    if (supplierBalance == null || txType !== 'supplier_payment') return null;
    return Math.round((supplierBalance - resolvedAmount) * 100) / 100;
  }, [supplierBalance, resolvedAmount, txType]);

  useEffect(() => {
    if (!usesForeign || currency === 'TRY') return;
    const rate = getRateToTry(currency, store.settings.currency);
    if (rate > 0) setExchangeRate(formatAmountInput(rate));
  }, [currency, usesForeign, store.settings.currency]);

  useEffect(() => {
    const supplierLabel = supplierName.trim()
      || store.suppliers.find((s) => s.id === supplierId)?.name;
    const auto = buildAutoDescription(txType, {
      customerName: selectedCustomer?.name,
      supplierName: supplierLabel,
      expenseLabel: getExpenseCategoryLabel(expenseCategory, customExpenseCategories),
    });
    if (!auto) return;
    if (!description.trim() || description === lastAutoDesc.current) {
      setDescription(auto);
      lastAutoDesc.current = auto;
    }
  }, [txType, customerId, selectedCustomer?.name, supplierId, supplierName, expenseCategory, customExpenseCategories, description]);

  useEffect(() => {
    setLinkedSaleId('');
  }, [customerId]);

  useEffect(() => {
    if (txType !== 'bank_movement' || bankMovementKind !== 'customer_refund' || !linkedSaleId) return;
    const match = refundableSalesForBank.find((entry) => entry.sale.id === linkedSaleId);
    if (match) {
      setAmount(formatAmountInput(match.refundTotal));
    }
  }, [txType, bankMovementKind, linkedSaleId, refundableSalesForBank]);

  const resetSoftFields = useCallback(() => {
    setDescription('');
    setAmount('');
    setDocumentNo('');
    setInvoiceNo('');
    setCountedBalance('');
    setCheckDrawer('');
    setAmountForeign('');
    setExchangeRate('');
    setAttachmentName('');
    setAttachmentDataUrl('');
    setLinkedSaleId('');
    setPurchaseLineDrafts([createEmptyPurchaseLineDraft()]);
    setFieldErrors({});
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  const resetFormForNewVoucher = useCallback(() => {
    resetSoftFields();
    setCustomerId('');
    setLinkedSaleId('');
    setPaymentSource('cash');
    setBankAccountId('');
    setUseForeignCollection(false);
    setCheckDueDate(todayIsoDate());
    setDate(todayIsoDate());
    lastAutoDesc.current = '';
  }, [resetSoftFields]);

  const handleTypeChange = (type: VoucherTransactionType) => {
    setTxType(type);
    setSaveMessage('');
    setSupplierId('');
    setSupplierName('');
    setInvoiceNo('');
    setAmount('');
    setDocumentNo('');
    setCountedBalance('');
    setCheckDrawer('');
    setAmountForeign('');
    setExchangeRate('');
    setUseForeignAmount(false);
    setUseForeignCollection(false);
    setPartnerId('');
    setFieldErrors({});
    setAttachmentName('');
    setAttachmentDataUrl('');
    if (fileRef.current) fileRef.current.value = '';
    if (type === 'cash_variance') {
      setSystemBalance(String(systemCashBalance(store)));
    }
    if (type === 'bank_movement') {
      setPaymentSource('bank');
      setBankMovementKind('cash_to_bank');
      if (!bankAccountId && store.bankAccounts.length > 0) {
        setBankAccountId(store.bankAccounts[0].id);
      }
    }
    if (type === 'purchase_invoice') {
      setPurchaseLineDrafts([createEmptyPurchaseLineDraft()]);
      setAffectsStock(true);
      setPurchaseInvoiceWideLayout(true);
    } else {
      setPurchaseInvoiceWideLayout(false);
    }
    if (type !== 'customer_collection' && type !== 'check_received' && type !== 'bank_movement') {
      setCustomerId('');
    }
    if (type !== 'bank_movement') {
      setBankMovementKind('cash_to_bank');
    }
  };

  const showSaveToast = (message: string, voucherId?: string) => {
    setToastMessage(message);
    if (voucherId) {
      setHighlightVoucherId(voucherId);
      window.setTimeout(() => {
        recentListRef.current?.querySelector(`[data-voucher-id="${voucherId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 120);
    }
    window.setTimeout(() => {
      setToastMessage('');
      setHighlightVoucherId(null);
    }, 4500);
  };

  const collectFullDebt = () => {
    if (customerBalance == null || customerBalance <= 0) return;
    setAmount(formatAmountInput(customerBalance));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.amount;
      return next;
    });
  };

  const handleSave = () => {
    setSaveMessage('');
    const errors = validateVoucherInput(draftInput, store.bankAccounts.length);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setSaveMessage('Lütfen işaretli alanları düzeltin.');
      return;
    }
    setFieldErrors({});

    const isLinkedBankSaleRefund =
      txType === 'bank_movement'
      && bankMovementKind === 'customer_refund'
      && Boolean(linkedSaleId);

    let result: JournalVoucher | null = null;
    if (isLinkedBankSaleRefund) {
      const sale = store.sales.find((entry) => entry.id === linkedSaleId);
      if (!sale) {
        setSaveMessage('Satış fişi bulunamadı.');
        return;
      }
      const returnRequest = buildFullSaleReturnRequest(sale, store.saleReturns);
      const built = buildReturnLines(sale, store.saleReturns, returnRequest);
      if (!built.ok) {
        setSaveMessage(built.message ?? 'İade satırları oluşturulamadı.');
        return;
      }
      const enteredAmount = parseAmountInput(amount);
      if (Math.abs(enteredAmount - built.refundTotal) > 0.009) {
        setFieldErrors({
          amount: `Tutar tam iade toplamı ile eşleşmeli (${formatAmountInput(built.refundTotal)} ₺)`,
        });
        setSaveMessage('Lütfen işaretli alanları düzeltin.');
        return;
      }
      const returnResult = store.processSaleReturn(
        linkedSaleId,
        returnRequest,
        'transfer',
        'Banka müşteri iadesi',
        description.trim() || undefined,
      );
      if (!returnResult.ok || !returnResult.returnRecord) {
        setSaveMessage(returnResult.message ?? 'Satış iadesi kaydedilemedi.');
        return;
      }
      result = store.postAccountingVoucher({
        ...draftInput,
        amount: built.refundTotal,
        linkedSaleId,
        linkedSaleReturnId: returnResult.returnRecord.id,
      });
      if (!result) {
        setSaveMessage('Banka fişi kaydedilemedi — muhasebe kaydını kontrol edin.');
        return;
      }
    } else {
      result = store.postAccountingVoucher(draftInput);
      if (!result) {
        setSaveMessage('Kayıt yapılamadı — zorunlu alanları kontrol edin.');
        return;
      }
    }
    if (txType === 'customer_collection') {
      resetFormForNewVoucher();
    } else {
      resetSoftFields();
    }
    if (txType === 'cash_variance') setSystemBalance(String(systemCashBalance(store)));
    const msg = `Fiş kaydedildi: ${result.voucherNo}`;
    setSaveMessage(msg);
    showSaveToast(msg, result.id);
    if (txType === 'purchase_invoice') {
      setPurchaseInvoiceWideLayout(false);
    }
  };

  const loadVoucherToForm = (voucher: JournalVoucher) => {
    if (voucher.status === 'voided') return;
    const legacyKind = legacyTypeToBankMovementKind(voucher.transactionType);
    if (legacyKind) {
      setTxType('bank_movement');
      setBankMovementKind(legacyKind);
    } else {
      setTxType(voucher.transactionType);
      setBankMovementKind(voucher.bankMovementKind ?? 'cash_to_bank');
    }
    setDate(voucher.date);
    setDescription(voucher.description);
    setAmount(formatAmountInput(voucher.amount));
    setPaymentSource(voucher.paymentSource ?? 'cash');
    setBankAccountId(voucher.bankAccountId ?? '');
    setCustomerId(voucher.customerId ?? '');
    setLinkedSaleId(voucher.linkedSaleId ?? '');
    setSupplierId(voucher.supplierId ?? '');
    setSupplierName(voucher.supplierName ?? '');
    setPartnerId(voucher.partnerId ?? '');
    setDocumentNo(voucher.documentNo ?? '');
    setAttachmentName(voucher.attachmentName ?? '');
    setAttachmentDataUrl(voucher.attachmentDataUrl ?? '');
    if (voucher.transactionType === 'purchase_invoice') {
      setPurchaseInvoiceWideLayout(true);
    }
    if (voucher.transactionType === 'purchase_invoice' && voucher.sourceRefId) {
      const invoice = store.purchaseInvoices.find((item) => item.id === voucher.sourceRefId);
      if (invoice) {
        setInvoiceNo(invoice.invoiceNo);
        setAffectsStock(invoice.affectsStock ?? true);
        if (invoice.lines?.length) {
          setPurchaseLineDrafts(purchaseLineDraftsFromInvoiceLines(invoice.lines));
        }
      }
    }
    if (voucher.amountForeign && voucher.exchangeRate) {
      setAmountForeign(formatAmountInput(voucher.amountForeign));
      setExchangeRate(formatAmountInput(voucher.exchangeRate));
      setCurrency((voucher.currency as SupportedCurrency) ?? 'USD');
      if (voucher.transactionType === 'customer_collection') setUseForeignCollection(true);
      if (voucher.transactionType === 'partner_capital') setUseForeignAmount(true);
    }
    setDetailVoucher(null);
    setVoidReason('');
    setSaveMessage('Fiş formuna kopyalandı — düzenleyip yeniden kaydedin.');
  };

  const handleVoid = () => {
    if (!detailVoucher || !voidReason.trim()) return;
    const result = store.voidJournalVoucher(detailVoucher.id, voidReason.trim());
    if (!result) {
      setSaveMessage('Fiş iptal edilemedi.');
      return;
    }
    setDetailVoucher(null);
    setVoidReason('');
    setSaveMessage(`Fiş iptal edildi: ${detailVoucher.voucherNo}`);
  };

  const handleAttachment = (file: File | null) => {
    if (!file) {
      setAttachmentName('');
      setAttachmentDataUrl('');
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setFieldErrors((prev) => ({ ...prev, attachment: 'Dosya en fazla 2 MB olabilir.' }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachmentName(file.name);
      setAttachmentDataUrl(String(reader.result ?? ''));
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.attachment;
        return next;
      });
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const needsBank = (
    paymentSource === 'bank'
    && ['customer_collection', 'supplier_payment', 'expense', 'partner_capital'].includes(txType)
  ) && store.bankAccounts.length > 0;

  const selectedBankAccount = store.bankAccounts.find((a) => a.id === bankAccountId);
  const selectedBankBalance = selectedBankAccount
    ? getBankAccountBalance(selectedBankAccount, store.bankTransactions)
    : null;

  const showBankStatement = Boolean(
    bankAccountId
    && selectedBankAccount
    && (
      txType === 'bank_movement'
      || txType === 'bank_deposit'
      || txType === 'bank_withdrawal'
      || needsBank
    ),
  );

  const showAmountField =
    txType !== 'cash_variance'
    && txType !== 'partner_capital'
    && txType !== 'purchase_invoice'
    && txType !== 'customer_collection'
    && txType !== 'bank_movement';

  const showSupplierFields =
    txType === 'supplier_payment'
    || txType === 'purchase_invoice'
    || (txType === 'bank_movement' && bankMovementKindNeedsSupplier(bankMovementKind));

  const showExpenseFields =
    txType === 'expense'
    || (txType === 'bank_movement' && bankMovementKindNeedsExpenseFields(bankMovementKind));

  const collapsePurchasePreview = txType === 'purchase_invoice' && purchaseInvoiceWideLayout;

  return (
    <div className={`voucher-panel voucher-panel--enhanced ${collapsePurchasePreview ? 'voucher-panel--purchase-entry' : ''}`}>
      <div className="voucher-layout">
        <aside className="voucher-types" aria-label="İşlem türü">
          <h2>İşlem Türü</h2>
          {TRANSACTION_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className={`voucher-type-btn ${txType === type ? 'active' : ''}`}
              onClick={() => handleTypeChange(type)}
            >
              <span className="voucher-type-icon" aria-hidden>{voucherTypeIcon(type)}</span>
              <span>{VOUCHER_TYPE_LABELS[type]}</span>
            </button>
          ))}
        </aside>

        <div className="voucher-main">
          <div className={`voucher-split ${collapsePurchasePreview ? 'voucher-split--purchase-wide' : ''}`}>
          <section className="module-card voucher-form-card">
            <div className="voucher-form-head">
              <h2>{VOUCHER_TYPE_LABELS[txType]}</h2>
              {collapsePurchasePreview && (
                <p className="voucher-form-head__hint">Hesap planı önizleme kayıt sonrası tekrar görünür.</p>
              )}
            </div>

            <div className="voucher-form-body">
            <div className="accounting-form-grid voucher-form-grid">
              {txType === 'customer_collection' && (
                <div className="voucher-collection-form voucher-span-2">
                  <div className="voucher-collection-row voucher-collection-row--head">
                    <label>
                      <VoucherFieldLabel required>Tarih</VoucherFieldLabel>
                      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                      {fieldErrors.date && <span className="voucher-field-error">{fieldErrors.date}</span>}
                    </label>
                    <div className="voucher-field-block voucher-collection-customer">
                      <VoucherFieldLabel required>Müşteri</VoucherFieldLabel>
                      <VoucherEntitySearch
                        mode="inline"
                        options={store.customers.map((c) => ({
                          id: c.id,
                          label: c.name,
                          hint: [c.phone, c.greenleafNumber, c.email].filter(Boolean).join(' · ') || undefined,
                        }))}
                        valueId={customerId}
                        placeholder="Yazın: ad, telefon, Greenleaf…"
                        onSelect={setCustomerId}
                        error={fieldErrors.customerId}
                        required
                        minQueryLength={2}
                      />
                    </div>
                  </div>

                  {customerBalance != null && customerId && (
                    <div className="voucher-balance-row voucher-balance-row--compact">
                      <p className={`voucher-balance-hint ${customerBalance > 0 ? 'is-unbalanced' : 'is-balanced'}`}>
                        Cari bakiye: <strong>{formatCurrency(customerBalance)}</strong>
                        {customerBalance > 0 ? ' (borçlu)' : customerBalance < 0 ? ' (alacaklı)' : ''}
                      </p>
                      {customerBalance > 0 && (
                        <button type="button" className="btn btn-outline btn-sm" onClick={collectFullDebt}>
                          Borç kadar tahsil et
                        </button>
                      )}
                    </div>
                  )}

                  <div className="voucher-collection-row voucher-collection-row--payment">
                    {!useForeignCollection && (
                      <label>
                        <VoucherFieldLabel required>Tutar (₺)</VoucherFieldLabel>
                        <input
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          onBlur={() => setAmount(formatAmountInput(parseAmountInput(amount)))}
                          placeholder="0,00"
                        />
                        {fieldErrors.amount && <span className="voucher-field-error">{fieldErrors.amount}</span>}
                      </label>
                    )}
                    <label>
                      <VoucherFieldLabel>Ödeme kaynağı</VoucherFieldLabel>
                      <select
                        value={paymentSource}
                        onChange={(e) => setPaymentSource(e.target.value as VoucherPaymentSource)}
                      >
                        {PAYMENT_SOURCES.map((s) => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="voucher-foreign-toggle">
                      <input
                        type="checkbox"
                        checked={useForeignCollection}
                        onChange={(e) => setUseForeignCollection(e.target.checked)}
                      />
                      <span>Dövizli tahsilat</span>
                    </label>
                    {paymentSource === 'check' && (
                      <label>
                        <VoucherFieldLabel>Çek vadesi</VoucherFieldLabel>
                        <input type="date" value={checkDueDate} onChange={(e) => setCheckDueDate(e.target.value)} />
                      </label>
                    )}
                    {needsBank && (
                      <label>
                        <VoucherFieldLabel required>Banka hesabı</VoucherFieldLabel>
                        <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
                          <option value="">Seçin</option>
                          {store.bankAccounts.map((a) => (
                            <option key={a.id} value={a.id}>{a.name} — {a.bankName}</option>
                          ))}
                        </select>
                        {fieldErrors.bankAccountId && <span className="voucher-field-error">{fieldErrors.bankAccountId}</span>}
                      </label>
                    )}
                  </div>

                  {useForeignCollection && (
                    <div className="voucher-foreign-panel">
                      <label>
                        <VoucherFieldLabel>Para birimi</VoucherFieldLabel>
                        <select value={currency} onChange={(e) => setCurrency(e.target.value as SupportedCurrency)}>
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                          <option value="GBP">GBP</option>
                          <option value="KZT">KZT</option>
                        </select>
                      </label>
                      <label>
                        <VoucherFieldLabel required>Döviz tutarı</VoucherFieldLabel>
                        <input
                          value={amountForeign}
                          onChange={(e) => setAmountForeign(e.target.value)}
                          onBlur={() => setAmountForeign(formatAmountInput(parseAmountInput(amountForeign)))}
                          placeholder="0,00"
                        />
                        {fieldErrors.amountForeign && <span className="voucher-field-error">{fieldErrors.amountForeign}</span>}
                      </label>
                      <label>
                        <VoucherFieldLabel required>{`Kur (1 ${currency} = ? ₺)`}</VoucherFieldLabel>
                        <input
                          value={exchangeRate}
                          onChange={(e) => setExchangeRate(e.target.value)}
                          onBlur={() => setExchangeRate(formatAmountInput(parseAmountInput(exchangeRate)))}
                          placeholder="0,00"
                        />
                        {fieldErrors.exchangeRate && <span className="voucher-field-error">{fieldErrors.exchangeRate}</span>}
                      </label>
                      <label>
                        <VoucherFieldLabel>TL karşılığı</VoucherFieldLabel>
                        <input
                          value={resolvedAmount > 0 ? formatAmountInput(resolvedAmount) : ''}
                          readOnly
                          className="is-readonly"
                        />
                      </label>
                    </div>
                  )}

                  <div className="voucher-desc-attach-row">
                    <label className="voucher-desc-attach-row__desc">
                      <VoucherFieldLabel>Açıklama</VoucherFieldLabel>
                      <input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Otomatik doldurulur; düzenleyebilirsiniz"
                      />
                    </label>
                    <label className="voucher-desc-attach-row__file" title="İsteğe bağlı, en fazla 2 MB">
                      <VoucherFieldLabel>Belge eki</VoucherFieldLabel>
                      <input
                        ref={fileRef}
                        type="file"
                        className="voucher-desc-attach-file"
                        accept="image/*,.pdf"
                        onChange={(e) => handleAttachment(e.target.files?.[0] ?? null)}
                      />
                      {attachmentName && (
                        <span className="voucher-attachment-name voucher-attachment-name--compact">{attachmentName}</span>
                      )}
                      {fieldErrors.attachment && <span className="voucher-field-error">{fieldErrors.attachment}</span>}
                    </label>
                  </div>
                </div>
              )}

              {txType === 'bank_movement' && (
                <div className="voucher-bank-movement voucher-span-2">
                  {store.bankAccounts.length === 0 ? (
                    <p className="module-hint voucher-bank-empty">
                      Banka işlemi için önce <strong>Dönem & Diğer</strong> sekmesinden banka hesabı tanımlayın.
                    </p>
                  ) : (
                    <>
                      <div className="voucher-bank-movement__row">
                        <label>
                          <VoucherFieldLabel required>Banka hesabı</VoucherFieldLabel>
                          <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
                            <option value="">Seçin</option>
                            {store.bankAccounts.filter((a) => a.isActive).map((a) => (
                              <option key={a.id} value={a.id}>{a.name} — {a.bankName}</option>
                            ))}
                          </select>
                          {fieldErrors.bankAccountId && <span className="voucher-field-error">{fieldErrors.bankAccountId}</span>}
                        </label>
                        <label>
                          <VoucherFieldLabel required>İşlem türü</VoucherFieldLabel>
                          <select
                            value={bankMovementKind}
                            onChange={(e) => setBankMovementKind(e.target.value as BankMovementKind)}
                          >
                            {BANK_MOVEMENT_KINDS.map((kind) => (
                              <option key={kind} value={kind}>{BANK_MOVEMENT_KIND_LABELS[kind]}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      {selectedBankBalance != null && bankAccountId && (
                        <p className="voucher-bank-balance-hint">
                          Seçili hesap bakiyesi: <strong>{formatCurrency(selectedBankBalance)}</strong>
                        </p>
                      )}
                      <label>
                        <VoucherFieldLabel required>Tutar (₺)</VoucherFieldLabel>
                        <input
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          onBlur={() => setAmount(formatAmountInput(parseAmountInput(amount)))}
                          placeholder="0,00"
                        />
                        {fieldErrors.amount && <span className="voucher-field-error">{fieldErrors.amount}</span>}
                      </label>
                    </>
                  )}
                </div>
              )}

              {txType !== 'customer_collection' && txType !== 'bank_movement' && txType !== 'purchase_invoice' && (
                <label>
                  <VoucherFieldLabel required>Tarih</VoucherFieldLabel>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  {fieldErrors.date && <span className="voucher-field-error">{fieldErrors.date}</span>}
                </label>
              )}

              {txType === 'bank_movement' && (
                <label>
                  <VoucherFieldLabel required>Tarih</VoucherFieldLabel>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  {fieldErrors.date && <span className="voucher-field-error">{fieldErrors.date}</span>}
                </label>
              )}

              {txType === 'check_received' && (
                <div className="voucher-field-block voucher-span-2">
                  <VoucherFieldLabel required>Müşteri</VoucherFieldLabel>
                  <VoucherEntitySearch
                    mode="inline"
                    options={store.customers.map((c) => ({
                      id: c.id,
                      label: c.name,
                      hint: [c.phone, c.greenleafNumber, c.email].filter(Boolean).join(' · ') || undefined,
                    }))}
                    valueId={customerId}
                    placeholder="Yazın: ad, telefon, Greenleaf…"
                    onSelect={setCustomerId}
                    error={fieldErrors.customerId}
                    required
                    minQueryLength={2}
                  />
                </div>
              )}

              {txType === 'bank_movement' && bankMovementKindNeedsCustomer(bankMovementKind) && (
                <div className="voucher-field-block voucher-span-2">
                  <VoucherFieldLabel required>Müşteri</VoucherFieldLabel>
                  <VoucherEntitySearch
                    mode="inline"
                    options={store.customers.map((c) => ({
                      id: c.id,
                      label: c.name,
                      hint: [c.phone, c.greenleafNumber, c.email].filter(Boolean).join(' · ') || undefined,
                    }))}
                    valueId={customerId}
                    placeholder="Müşteri ara…"
                    onSelect={setCustomerId}
                    error={fieldErrors.customerId}
                    required
                    minQueryLength={2}
                  />
                  {bankMovementKind === 'customer_refund' && customerId && (
                    <div className="voucher-bank-refund-sale">
                      <VoucherFieldLabel>Bağlı satış iadesi (isteğe bağlı)</VoucherFieldLabel>
                      <select
                        value={linkedSaleId}
                        onChange={(e) => setLinkedSaleId(e.target.value)}
                      >
                        <option value="">Sadece cari iade (satışa bağlama)</option>
                        {refundableSalesForBank.map(({ sale, refundTotal }) => (
                          <option key={sale.id} value={sale.id}>
                            {sale.id} — {formatDateTime(sale.createdAt)} — {formatCurrency(refundTotal)}
                          </option>
                        ))}
                      </select>
                      <span className="voucher-attach-hint">
                        Satış seçildiğinde stok ve cari iade kaydı oluşturulur; tutar otomatik dolar.
                      </span>
                      {fieldErrors.linkedSaleId && (
                        <span className="voucher-field-error">{fieldErrors.linkedSaleId}</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {(showSupplierFields && txType !== 'purchase_invoice') && (
                <>
                  <div className="voucher-field-block">
                    <span className="voucher-field-label">Tedarikçi</span>
                    <VoucherEntitySearch
                      options={store.suppliers.map((s) => ({ id: s.id, label: s.name }))}
                      valueId={supplierId}
                      placeholder="Tedarikçi ara…"
                      onSelect={(id) => {
                        setSupplierId(id);
                        const match = store.suppliers.find((s) => s.id === id);
                        if (match) setSupplierName(match.name);
                      }}
                      error={fieldErrors.supplierName}
                    />
                  </div>
                  <label>
                    Tedarikçi Adı (yeni)
                    <input
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      placeholder="Kayıtlı değilse firma adı"
                    />
                    {fieldErrors.supplierName && <span className="voucher-field-error">{fieldErrors.supplierName}</span>}
                  </label>
                </>
              )}

              {txType === 'partner_capital' && (
                <>
                  <label>
                    Ortak (Yurtdışı) <em className="req">*</em>
                    <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
                      <option value="">Seçin</option>
                      {store.equityPartners.filter((p) => p.isActive).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.accountCode} — {p.name}{p.country ? ` (${p.country})` : ''}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.partnerId && <span className="voucher-field-error">{fieldErrors.partnerId}</span>}
                  </label>
                  <label className="accounting-checkbox voucher-span-2">
                    <input
                      type="checkbox"
                      checked={useForeignAmount}
                      onChange={(e) => setUseForeignAmount(e.target.checked)}
                    />
                    Dövizli sermaye girişi
                  </label>
                  {useForeignAmount ? (
                    <>
                      <label>
                        Para Birimi
                        <select value={currency} onChange={(e) => setCurrency(e.target.value as SupportedCurrency)}>
                          <option value="USD">USD — Dolar</option>
                          <option value="KZT">KZT — Tenge</option>
                          <option value="TRY">TRY — TL</option>
                        </select>
                      </label>
                      {currency !== 'TRY' && (
                        <>
                          <label>
                            Döviz Tutarı
                            <input
                              value={amountForeign}
                              onChange={(e) => setAmountForeign(e.target.value)}
                              onBlur={() => setAmountForeign(formatAmountInput(parseAmountInput(amountForeign)))}
                            />
                          </label>
                          <label>
                            Kur (1 {currency} = ? ₺)
                            <input
                              value={exchangeRate}
                              onChange={(e) => setExchangeRate(e.target.value)}
                              onBlur={() => setExchangeRate(formatAmountInput(parseAmountInput(exchangeRate)))}
                            />
                          </label>
                          <label>
                            TL Karşılığı
                            <input value={resolvedAmount > 0 ? formatAmountInput(resolvedAmount) : ''} readOnly />
                          </label>
                          {parseAmountInput(amountForeign) > 0 && (
                            <p className="module-hint voucher-conversion-hint voucher-span-2">
                              {formatConversionHint(parseAmountInput(amountForeign), currency, store.settings.currency)}
                            </p>
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <label>
                      Tutar (₺) <em className="req">*</em>
                      <input
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        onBlur={() => setAmount(formatAmountInput(parseAmountInput(amount)))}
                      />
                      {fieldErrors.amount && <span className="voucher-field-error">{fieldErrors.amount}</span>}
                    </label>
                  )}
                  <label>Belge / Dekont No<input value={documentNo} onChange={(e) => setDocumentNo(e.target.value)} /></label>
                </>
              )}

              {showAmountField && (
                <label>
                  Tutar (₺) <em className="req">*</em>
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onBlur={() => setAmount(formatAmountInput(parseAmountInput(amount)))}
                    placeholder="0,00"
                  />
                  {fieldErrors.amount && <span className="voucher-field-error">{fieldErrors.amount}</span>}
                </label>
              )}

              {(txType === 'supplier_payment' || txType === 'expense' || txType === 'partner_capital') && (
                <label>
                  Ödeme Kaynağı
                  <select
                    value={paymentSource}
                    onChange={(e) => setPaymentSource(e.target.value as VoucherPaymentSource)}
                  >
                    {(txType === 'partner_capital' ? CAPITAL_PAYMENT_SOURCES : PAYMENT_SOURCES).map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </label>
              )}

              {needsBank && txType !== 'customer_collection' && (
                <label>
                  Banka Hesabı <em className="req">*</em>
                  <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
                    <option value="">Seçin</option>
                    {store.bankAccounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name} — {a.bankName}</option>
                    ))}
                  </select>
                  {fieldErrors.bankAccountId && <span className="voucher-field-error">{fieldErrors.bankAccountId}</span>}
                </label>
              )}

              {showExpenseFields && (
                <>
                  <div className="voucher-templates voucher-span-2">
                    <span className="voucher-templates__label">Gider şablonu</span>
                    <div className="voucher-templates__chips">
                      {EXPENSE_TEMPLATES.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className="voucher-template-chip"
                          onClick={() => {
                            setExpenseCategory(t.category);
                            setDescription(t.description);
                            lastAutoDesc.current = t.description;
                          }}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label>
                    Gider Kategorisi
                    <select
                      value={expenseCategory}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === EXPENSE_CATEGORY_ADD_OPTION) {
                          setNewExpenseCategoryError(null);
                          setNewExpenseCategoryName('');
                          setNewExpenseCategoryAccount('770');
                          setShowNewExpenseCategory(true);
                          return;
                        }
                        setExpenseCategory(value as ExpenseCategory);
                      }}
                    >
                      {expenseCategoryOptions.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                      <option value={EXPENSE_CATEGORY_ADD_OPTION}>+ Yeni kategori ekle…</option>
                    </select>
                  </label>
                  <label>Belge No<input value={documentNo} onChange={(e) => setDocumentNo(e.target.value)} /></label>
                  <label>KDV %<input value={vatRate} onChange={(e) => setVatRate(e.target.value)} /></label>
                  <div className="voucher-desc-attach-row voucher-span-2">
                    <label className="voucher-desc-attach-row__desc">
                      <span className="voucher-field-label">
                        Açıklama <em className="req">*</em>
                      </span>
                      <input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Gider açıklaması"
                      />
                      {fieldErrors.description && <span className="voucher-field-error">{fieldErrors.description}</span>}
                    </label>
                    <label className="voucher-desc-attach-row__file" title="İsteğe bağlı, en fazla 2 MB">
                      <VoucherFieldLabel>Belge eki</VoucherFieldLabel>
                      <input
                        ref={fileRef}
                        type="file"
                        className="voucher-desc-attach-file"
                        accept="image/*,.pdf"
                        onChange={(e) => handleAttachment(e.target.files?.[0] ?? null)}
                      />
                      {attachmentName && (
                        <span className="voucher-attachment-name voucher-attachment-name--compact">{attachmentName}</span>
                      )}
                      {fieldErrors.attachment && <span className="voucher-field-error">{fieldErrors.attachment}</span>}
                    </label>
                  </div>
                </>
              )}

              {txType === 'purchase_invoice' && (
                <>
                  <div className="voucher-purchase-head-row voucher-span-2">
                    <label className="voucher-purchase-head-field">
                      <VoucherFieldLabel required>Tarih</VoucherFieldLabel>
                      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                      {fieldErrors.date && <span className="voucher-field-error">{fieldErrors.date}</span>}
                    </label>
                    <div className="voucher-field-block voucher-purchase-head-field">
                      <span className="voucher-field-label">
                        Tedarikçi <em className="req">*</em>
                      </span>
                      <VoucherEntitySearch
                        options={store.suppliers.map((s) => ({ id: s.id, label: s.name }))}
                        valueId={supplierId}
                        placeholder="Tedarikçi ara…"
                        onSelect={(id) => {
                          setSupplierId(id);
                          const match = store.suppliers.find((s) => s.id === id);
                          if (match) setSupplierName(match.name);
                        }}
                        error={fieldErrors.supplierName}
                      />
                    </div>
                    <label className="voucher-purchase-head-field">
                      <span className="voucher-field-label">Tedarikçi Adı (yeni)</span>
                      <input
                        value={supplierName}
                        onChange={(e) => setSupplierName(e.target.value)}
                        placeholder="Kayıtlı değilse firma adı"
                      />
                    </label>
                    <label className="voucher-purchase-head-field voucher-purchase-fatura-field">
                      <span className="voucher-field-label">
                        Fatura No <em className="req">*</em>
                      </span>
                      <input
                        value={invoiceNo}
                        onChange={(e) => setInvoiceNo(e.target.value)}
                        placeholder="AF-2026-001"
                        autoComplete="off"
                      />
                      {fieldErrors.invoiceNo && (
                        <span className="voucher-field-error">{fieldErrors.invoiceNo}</span>
                      )}
                    </label>
                    <label className="voucher-premium-switch voucher-purchase-stock-switch voucher-purchase-head-field">
                      <input
                        type="checkbox"
                        className="voucher-premium-switch__input"
                        checked={affectsStock}
                        onChange={(e) => setAffectsStock(e.target.checked)}
                      />
                      <span className="voucher-premium-switch__control" aria-hidden="true">
                        <span className="voucher-premium-switch__thumb" />
                      </span>
                      <span className="voucher-premium-switch__copy">
                        <strong>Stoka işle</strong>
                        <small>Stok ve alış fiyatı</small>
                      </span>
                    </label>
                  </div>
                  {affectsStock ? (
                    <div className="voucher-purchase-lines voucher-span-2">
                      <div className="voucher-purchase-lines__head">
                        <span className="voucher-field-label">Fatura satırları</span>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() => setPurchaseLineDrafts((prev) => [...prev, createEmptyPurchaseLineDraft()])}
                        >
                          + Satır ekle
                        </button>
                      </div>
                      <p className="voucher-attach-hint">
                        Ürün araması: ad, stok numarası (#37) veya ürün kodu (örn. DAA062).
                      </p>
                      <div className="voucher-purchase-lines-table-wrap">
                        <table className="module-table voucher-purchase-lines-table">
                          <thead>
                            <tr>
                              <th>Ürün</th>
                              <th>Stok no</th>
                              <th>Adet</th>
                              <th>Birim net</th>
                              <th>KDV %</th>
                              <th>Satır toplamı</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {purchaseLineDrafts.map((row) => {
                              const lineGross = (() => {
                                const qty = parseFloat(row.quantity.replace(',', '.')) || 0;
                                const cost = parseAmountInput(row.unitCostNet);
                                const rate = parseFloat(row.vatRate.replace(',', '.')) || 0;
                                if (qty <= 0 || cost <= 0) return 0;
                                return Math.round(cost * qty * (1 + rate / 100) * 100) / 100;
                              })();
                              const selectedProduct = row.productId
                                ? store.products.find((p) => String(p.id) === row.productId)
                                : undefined;
                              const patchLine = (patch: Partial<PurchaseLineDraft>) => {
                                setPurchaseLineDrafts((prev) => prev.map((item) => (
                                  item.key === row.key ? { ...item, ...patch } : item
                                )));
                              };
                              const syncGrossFromNet = () => {
                                const net = parseAmountInput(row.unitCostNet);
                                const rate = parseFloat(row.vatRate.replace(',', '.')) || 0;
                                if (net <= 0) return;
                                patchLine({ purchasePriceGross: formatAmountInput(grossFromNetUnit(net, rate)) });
                              };

                              return (
                                <Fragment key={row.key}>
                                <tr className="voucher-purchase-line-main">
                                  <td>
                                    <VoucherEntitySearch
                                      options={productSearchOptions}
                                      valueId={row.productId}
                                      placeholder="Ad, stok no veya kod…"
                                      onSelect={(id) => {
                                        const product = store.products.find((p) => String(p.id) === id);
                                        setPurchaseLineDrafts((prev) => prev.map((item) => {
                                          if (item.key !== row.key) return item;
                                          let next = { ...item, productId: id };
                                          if (product) {
                                            next = fillPurchaseLineDraftFromProduct(next, product);
                                            const net = parseAmountInput(next.unitCostNet);
                                            const rate = parseFloat(next.vatRate.replace(',', '.')) || 0;
                                            if (net > 0) {
                                              next.purchasePriceGross = formatAmountInput(grossFromNetUnit(net, rate));
                                            }
                                          }
                                          return next;
                                        }));
                                      }}
                                      minQueryLength={1}
                                    />
                                  </td>
                                  <td className="voucher-purchase-lines-stock">
                                    {selectedProduct ? (
                                      <>
                                        <span className="voucher-purchase-lines-stock__no">#{selectedProduct.id}</span>
                                        {selectedProduct.productCode && (
                                          <span className="voucher-purchase-lines-stock__code">{selectedProduct.productCode}</span>
                                        )}
                                      </>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                  <td>
                                    <input
                                      className="voucher-purchase-lines-input voucher-purchase-lines-input--qty"
                                      inputMode="decimal"
                                      value={row.quantity}
                                      onChange={(e) => patchLine({ quantity: e.target.value })}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      className="voucher-purchase-lines-input"
                                      inputMode="decimal"
                                      value={row.unitCostNet}
                                      onChange={(e) => patchLine({ unitCostNet: e.target.value })}
                                      onBlur={() => {
                                        const formatted = formatAmountInput(parseAmountInput(row.unitCostNet));
                                        patchLine({ unitCostNet: formatted });
                                        syncGrossFromNet();
                                      }}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      className="voucher-purchase-lines-input voucher-purchase-lines-input--vat"
                                      value={row.vatRate}
                                      onChange={(e) => patchLine({ vatRate: e.target.value })}
                                      onBlur={syncGrossFromNet}
                                    />
                                  </td>
                                  <td className="voucher-purchase-lines-total">
                                    {lineGross > 0 ? formatCurrency(lineGross) : '—'}
                                  </td>
                                  <td>
                                    {purchaseLineDrafts.length > 1 && (
                                      <button
                                        type="button"
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => setPurchaseLineDrafts((prev) => prev.filter((item) => item.key !== row.key))}
                                      >
                                        Sil
                                      </button>
                                    )}
                                  </td>
                                </tr>
                                <tr className="voucher-purchase-line-prices-row">
                                  <td colSpan={7}>
                                    <div className="voucher-purchase-price-grid" role="group" aria-label="Ürün fiyat kartı">
                                      <label className="voucher-purchase-price-field">
                                        <span title="Point Value">PV</span>
                                        <input
                                          inputMode="decimal"
                                          value={row.pv}
                                          onChange={(e) => patchLine({ pv: e.target.value })}
                                          placeholder="0"
                                          disabled={!row.productId}
                                        />
                                      </label>
                                      <label className="voucher-purchase-price-field">
                                        <span title="Alış fiyatı (KDV dahil)">Alış</span>
                                        <input
                                          inputMode="decimal"
                                          value={row.purchasePriceGross}
                                          onChange={(e) => patchLine({ purchasePriceGross: e.target.value })}
                                          onBlur={() => patchLine({
                                            purchasePriceGross: formatAmountInput(parseAmountInput(row.purchasePriceGross)),
                                          })}
                                          placeholder="0,00"
                                          disabled={!row.productId}
                                        />
                                      </label>
                                      <label className="voucher-purchase-price-field">
                                        <span>Partner</span>
                                        <input
                                          inputMode="decimal"
                                          value={row.partnerPrice}
                                          onChange={(e) => patchLine({ partnerPrice: e.target.value })}
                                          onBlur={() => patchLine({
                                            partnerPrice: formatAmountInput(parseAmountInput(row.partnerPrice)),
                                          })}
                                          placeholder="0,00"
                                          disabled={!row.productId}
                                        />
                                      </label>
                                      <label className="voucher-purchase-price-field">
                                        <span>Kupon</span>
                                        <input
                                          inputMode="decimal"
                                          value={row.couponPrice}
                                          onChange={(e) => patchLine({ couponPrice: e.target.value })}
                                          onBlur={() => patchLine({
                                            couponPrice: formatAmountInput(parseAmountInput(row.couponPrice)),
                                          })}
                                          placeholder="0,00"
                                          disabled={!row.productId}
                                        />
                                      </label>
                                      <label className="voucher-purchase-price-field">
                                        <span>Perakende</span>
                                        <input
                                          inputMode="decimal"
                                          value={row.fullSalePrice}
                                          onChange={(e) => patchLine({ fullSalePrice: e.target.value })}
                                          onBlur={() => patchLine({
                                            fullSalePrice: formatAmountInput(parseAmountInput(row.fullSalePrice)),
                                          })}
                                          placeholder="0,00"
                                          disabled={!row.productId}
                                        />
                                      </label>
                                      <label className="voucher-purchase-price-field">
                                        <span title="Toptan kademeleri (10+ adet)">Toptan</span>
                                        <input
                                          inputMode="decimal"
                                          value={row.wholesalePrice}
                                          onChange={(e) => patchLine({ wholesalePrice: e.target.value })}
                                          onBlur={() => patchLine({
                                            wholesalePrice: formatAmountInput(parseAmountInput(row.wholesalePrice)),
                                          })}
                                          placeholder="0,00"
                                          disabled={!row.productId}
                                        />
                                      </label>
                                    </div>
                                  </td>
                                </tr>
                                </Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {fieldErrors.purchaseLines && (
                        <span className="voucher-field-error">{fieldErrors.purchaseLines}</span>
                      )}
                      <p className="voucher-computed-total">
                        Toplam (KDV dahil): <strong>{formatCurrency(purchaseGross)}</strong>
                        {parsedPurchaseLines.length > 0 && (
                          <span className="voucher-computed-total__meta">
                            {' '}· {parsedPurchaseLines.length} satır
                          </span>
                        )}
                      </p>
                    </div>
                  ) : (
                    <>
                      <label>
                        Tutar (KDV dahil) <em className="req">*</em>
                        <input
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          onBlur={() => setAmount(formatAmountInput(parseAmountInput(amount)))}
                          placeholder="0,00"
                        />
                        {fieldErrors.unitCost && <span className="voucher-field-error">{fieldErrors.unitCost}</span>}
                        {fieldErrors.amount && <span className="voucher-field-error">{fieldErrors.amount}</span>}
                      </label>
                      <label>KDV %<input value={vatRate} onChange={(e) => setVatRate(e.target.value)} /></label>
                    </>
                  )}
                </>
              )}

              {txType === 'check_received' && (
                <>
                  <label>
                    Keşideci <em className="req">*</em>
                    <input value={checkDrawer} onChange={(e) => setCheckDrawer(e.target.value)} />
                    {fieldErrors.checkDrawer && <span className="voucher-field-error">{fieldErrors.checkDrawer}</span>}
                  </label>
                  <label>Vade<input type="date" value={checkDueDate} onChange={(e) => setCheckDueDate(e.target.value)} /></label>
                </>
              )}

              {txType === 'cash_variance' && (
                <>
                  <label>
                    Sistem Bakiye
                    <input value={systemBalance} onChange={(e) => setSystemBalance(e.target.value)} />
                    {fieldErrors.systemBalance && <span className="voucher-field-error">{fieldErrors.systemBalance}</span>}
                  </label>
                  <label>
                    Sayılan Bakiye <em className="req">*</em>
                    <input value={countedBalance} onChange={(e) => setCountedBalance(e.target.value)} />
                    {fieldErrors.countedBalance && <span className="voucher-field-error">{fieldErrors.countedBalance}</span>}
                  </label>
                </>
              )}

              {txType !== 'expense'
                && txType !== 'customer_collection'
                && (
                <div
                  className={`voucher-desc-attach-row voucher-span-2 ${
                    txType === 'bank_movement' && bankMovementKindNeedsExpenseFields(bankMovementKind)
                      ? 'voucher-desc-attach-row--attach-only'
                      : ''
                  }`}
                >
                  {!(txType === 'bank_movement' && bankMovementKindNeedsExpenseFields(bankMovementKind)) && (
                    <label className="voucher-desc-attach-row__desc">
                      <VoucherFieldLabel>Açıklama</VoucherFieldLabel>
                      <input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Otomatik doldurulur; düzenleyebilirsiniz"
                      />
                    </label>
                  )}
                  <label className="voucher-desc-attach-row__file" title="İsteğe bağlı, en fazla 2 MB">
                    <VoucherFieldLabel>Belge eki</VoucherFieldLabel>
                    <input
                      ref={fileRef}
                      type="file"
                      className="voucher-desc-attach-file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleAttachment(e.target.files?.[0] ?? null)}
                    />
                    {attachmentName && (
                      <span className="voucher-attachment-name voucher-attachment-name--compact">{attachmentName}</span>
                    )}
                    {fieldErrors.attachment && <span className="voucher-field-error">{fieldErrors.attachment}</span>}
                  </label>
                </div>
              )}
            </div>
            </div>

            {saveMessage && (
              <p className={`voucher-save-msg ${saveMessage.includes('kaydedildi') || saveMessage.includes('kopyalandı') || saveMessage.includes('iptal') ? 'is-success' : 'is-error'}`}>
                {saveMessage}
              </p>
            )}
            <div className="voucher-form-fill" aria-hidden="true" />
          </section>

          {!collapsePurchasePreview && (
          <section className="module-card voucher-journal-card voucher-preview-side">
            <h2 className="voucher-preview-side__title">Hesap Planı Önizleme</h2>

            <div className="voucher-recent-inline voucher-recent-inline--panel">
              <div className="voucher-recent-inline__head">
                <h3>Son Fişler</h3>
                {txType === 'customer_collection' && (
                  <div className="voucher-recent-filters">
                    <button
                      type="button"
                      className={recentFilter === 'collection' ? 'active' : ''}
                      onClick={() => setRecentFilter('collection')}
                    >
                      Tahsilat
                    </button>
                    <button
                      type="button"
                      className={recentFilter === 'all' ? 'active' : ''}
                      onClick={() => setRecentFilter('all')}
                    >
                      Tümü
                    </button>
                    {customerId && (
                      <button
                        type="button"
                        className={recentFilter === 'customer' ? 'active' : ''}
                        onClick={() => setRecentFilter('customer')}
                      >
                        Bu müşteri
                      </button>
                    )}
                  </div>
                )}
              </div>
              {recentVouchers.length === 0 ? (
                <p className="module-empty module-empty--compact voucher-recent-empty">Henüz fiş kaydı yok</p>
              ) : (
                <ul
                  className="voucher-recent-list voucher-recent-list--compact voucher-recent-list--scroll"
                  ref={recentListRef}
                >
                  {recentVouchers.map((v) => (
                    <li
                      key={v.id}
                      className={`${v.status === 'voided' ? 'is-voided' : ''} ${highlightVoucherId === v.id ? 'is-highlighted' : ''}`}
                      data-voucher-id={v.id}
                    >
                      <button
                        type="button"
                        className="voucher-recent-item voucher-recent-item--premium"
                        onClick={() => setDetailVoucher(v)}
                      >
                        <span className="voucher-recent-item__no">{v.voucherNo}</span>
                        <div className="voucher-recent-item__main">
                          <span className="voucher-recent-item__party">{voucherPartyLabel(v)}</span>
                          <span className="voucher-recent-item__time">{formatDateTime(v.createdAt)}</span>
                        </div>
                        <div className="voucher-recent-item__tail">
                          <span className="voucher-recent-item__amount">{formatCurrency(v.amount)}</span>
                          {v.status === 'voided' && <span className="voucher-void-badge">İptal</span>}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="voucher-preview-body">
              {txType === 'customer_collection' && customerId && (
                <div className="voucher-preview-summary">
                  <div className="voucher-preview-summary__row">
                    <span>Müşteri</span>
                    <strong>{selectedCustomer?.name ?? '—'}</strong>
                  </div>
                  <div className="voucher-preview-summary__row">
                    <span>Tutar</span>
                    <strong>{resolvedAmount > 0 ? formatCurrency(resolvedAmount) : '—'}</strong>
                  </div>
                  <div className="voucher-preview-summary__row">
                    <span>Ödeme</span>
                    <strong>{paymentSourceLabel(paymentSource)}</strong>
                  </div>
                  {customerBalance != null && (
                    <div className="voucher-preview-summary__row voucher-preview-summary__row--highlight">
                      <span>Tahsilat sonrası bakiye</span>
                      <strong>{formatCurrency(balanceAfterCollection ?? customerBalance)}</strong>
                    </div>
                  )}
                </div>
              )}

              {txType === 'supplier_payment' && supplierId && (
                <div className="voucher-preview-summary">
                  <div className="voucher-preview-summary__row">
                    <span>Tedarikçi</span>
                    <strong>{selectedSupplier?.name ?? (supplierName.trim() || '—')}</strong>
                  </div>
                  <div className="voucher-preview-summary__row">
                    <span>Tutar</span>
                    <strong>{resolvedAmount > 0 ? formatCurrency(resolvedAmount) : '—'}</strong>
                  </div>
                  <div className="voucher-preview-summary__row">
                    <span>Ödeme kaynağı</span>
                    <strong>{paymentSourceLabel(paymentSource)}</strong>
                  </div>
                  {supplierBalance != null && (
                    <>
                      <div className="voucher-preview-summary__row">
                        <span>Güncel borç</span>
                        <strong>{formatCurrency(supplierBalance)}</strong>
                      </div>
                      <div className="voucher-preview-summary__row voucher-preview-summary__row--highlight">
                        <span>Ödeme sonrası borç</span>
                        <strong>{formatCurrency(balanceAfterSupplierPayment ?? supplierBalance)}</strong>
                      </div>
                    </>
                  )}
                </div>
              )}

              {previewLines.length > 0 && (
                <>
                  <table className="module-table voucher-journal-table">
                    <thead>
                      <tr><th>Kod</th><th>Hesap</th><th>Borç</th><th>Alacak</th></tr>
                    </thead>
                    <tbody>
                      {previewLines.map((row, idx) => (
                        <tr key={`${row.accountCode}-${idx}`}>
                          <td><code>{row.accountCode}</code></td>
                          <td>{row.accountName}</td>
                          <td className="is-positive">{row.debit > 0 ? formatCurrency(row.debit) : '—'}</td>
                          <td className="is-negative">{row.credit > 0 ? formatCurrency(row.credit) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="voucher-journal-total">
                        <td colSpan={2}>Toplam</td>
                        <td>{formatCurrency(lineSummary.totalDebit)}</td>
                        <td>{formatCurrency(lineSummary.totalCredit)}</td>
                      </tr>
                    </tfoot>
                  </table>
                  <p className={`voucher-balance-hint ${lineSummary.balanced ? 'is-balanced' : 'is-unbalanced'}`}>
                    {lineSummary.balanced ? '✓ Borç ve alacak dengeli' : '⚠ Borç/alacak dengesi bekleniyor'}
                  </p>
                </>
              )}
            </div>
          </section>
          )}
          </div>

          {txType === 'customer_collection' && customerId && selectedCustomer && (
            <CustomerStatementPanel
              customerId={customerId}
              customerName={selectedCustomer.name}
              ledger={store.customerLedger}
              compact
            />
          )}

          {txType === 'supplier_payment' && supplierId && selectedSupplier && (
            <SupplierStatementPanel
              supplierId={supplierId}
              supplierName={selectedSupplier.name}
              ledger={store.supplierLedger}
              compact
            />
          )}

          {showBankStatement && selectedBankAccount && (
            <BankStatementPanel
              account={selectedBankAccount}
              transactions={store.bankTransactions}
              compact
            />
          )}
        </div>
      </div>

      {toastMessage && (
        <div className="voucher-toast" role="status">
          {toastMessage}
        </div>
      )}

      <div className="voucher-sticky-bar">
        <button type="button" className="btn btn-primary" onClick={handleSave}>
          Fişi Kaydet
        </button>
        <span className="voucher-sticky-bar__hint">Ctrl+Enter</span>
        {saveMessage && (
          <span className={`voucher-sticky-bar__msg ${saveMessage.includes('kaydedildi') ? 'is-success' : 'is-error'}`}>
            {saveMessage}
          </span>
        )}
      </div>

      {showNewExpenseCategory && (
        <div
          className="modal-overlay voucher-detail-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-expense-category-title"
          onClick={() => setShowNewExpenseCategory(false)}
        >
          <div
            className="module-card voucher-detail-modal voucher-expense-category-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="voucher-detail-head">
              <h3 id="new-expense-category-title">Yeni gider kategorisi</h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowNewExpenseCategory(false)}
                aria-label="Kapat"
              >
                ×
              </button>
            </header>
            <div className="module-form voucher-expense-category-form">
              <label>
                Kategori adı <em className="req">*</em>
                <input
                  value={newExpenseCategoryName}
                  onChange={(e) => {
                    setNewExpenseCategoryName(e.target.value);
                    setNewExpenseCategoryError(null);
                  }}
                  placeholder="Örn. Reklam, Bakım"
                  autoFocus
                />
              </label>
              <label>
                Gider hesabı (yevmiye)
                <select
                  value={newExpenseCategoryAccount}
                  onChange={(e) => setNewExpenseCategoryAccount(e.target.value)}
                >
                  {expenseAccountOptions.map((account) => (
                    <option key={account.code} value={account.code}>
                      {account.code} — {account.name}
                    </option>
                  ))}
                </select>
              </label>
              {newExpenseCategoryError && (
                <p className="voucher-field-error" role="alert">{newExpenseCategoryError}</p>
              )}
            </div>
            <div className="voucher-detail-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const validation = validateNewExpenseCategoryLabel(
                    newExpenseCategoryName,
                    customExpenseCategories,
                  );
                  if (validation) {
                    setNewExpenseCategoryError(validation);
                    return;
                  }
                  const created = store.addCustomExpenseCategory(
                    newExpenseCategoryName,
                    newExpenseCategoryAccount,
                  );
                  if (!created) {
                    setNewExpenseCategoryError('Kategori kaydedilemedi.');
                    return;
                  }
                  setExpenseCategory(created.id as ExpenseCategory);
                  if (!description.trim() || description === lastAutoDesc.current) {
                    setDescription(created.label);
                    lastAutoDesc.current = created.label;
                  }
                  setShowNewExpenseCategory(false);
                  setToastMessage(`Kategori eklendi: ${created.label}`);
                  setTimeout(() => setToastMessage(''), 2500);
                }}
              >
                Kaydet ve seç
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowNewExpenseCategory(false)}
              >
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      )}

      {detailVoucher && (
        <div className="modal-overlay voucher-detail-overlay" role="dialog" aria-modal="true">
          <div className="module-card voucher-detail-modal">
            <header className="voucher-detail-head">
              <h3>{detailVoucher.voucherNo}</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDetailVoucher(null)}>×</button>
            </header>
            <dl className="voucher-detail-dl">
              <dt>İşlem</dt>
              <dd>{VOUCHER_TYPE_LABELS[detailVoucher.transactionType]}</dd>
              <dt>Tutar</dt>
              <dd>{formatCurrency(detailVoucher.amount)}</dd>
              <dt>Tarih</dt>
              <dd>{formatDateTime(detailVoucher.createdAt)}</dd>
              <dt>Müşteri / Taraf</dt>
              <dd>{voucherPartyLabel(detailVoucher)}</dd>
              <dt>Açıklama</dt>
              <dd>{detailVoucher.description || '—'}</dd>
              {detailVoucher.linkedSaleId && (
                <>
                  <dt>Bağlı satış</dt>
                  <dd><code>{detailVoucher.linkedSaleId}</code></dd>
                </>
              )}
              {detailVoucher.linkedSaleReturnId && (
                <>
                  <dt>Satış iadesi</dt>
                  <dd><code>{detailVoucher.linkedSaleReturnId}</code></dd>
                </>
              )}
              {detailVoucher.attachmentName && (
                <>
                  <dt>Belge eki</dt>
                  <dd className="voucher-attachment-preview">
                    {detailVoucher.attachmentDataUrl?.startsWith('data:image/') ? (
                      <a href={detailVoucher.attachmentDataUrl} target="_blank" rel="noopener noreferrer">
                        <img src={detailVoucher.attachmentDataUrl} alt={detailVoucher.attachmentName} className="voucher-attachment-thumb" />
                      </a>
                    ) : (
                      <a
                        href={detailVoucher.attachmentDataUrl ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={detailVoucher.attachmentName}
                      >
                        {detailVoucher.attachmentName}
                      </a>
                    )}
                  </dd>
                </>
              )}
              <dt>Durum</dt>
              <dd>
                {detailVoucher.status === 'voided'
                  ? `İptal — ${detailVoucher.voidReason ?? ''}`
                  : 'Aktif'}
              </dd>
            </dl>
            {detailVoucher.lines.length > 0 && (
              <table className="module-table voucher-journal-table">
                <thead>
                  <tr><th>Hesap</th><th>Borç</th><th>Alacak</th></tr>
                </thead>
                <tbody>
                  {detailVoucher.lines.map((line, i) => (
                    <tr key={i}>
                      <td><code>{line.accountCode}</code> {line.accountName}</td>
                      <td>{line.debit > 0 ? formatCurrency(line.debit) : '—'}</td>
                      <td>{line.credit > 0 ? formatCurrency(line.credit) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="voucher-detail-actions">
              {detailVoucher.status !== 'voided' && (
                <>
                  <button type="button" className="btn btn-outline" onClick={() => loadVoucherToForm(detailVoucher)}>
                    Forma kopyala
                  </button>
                  <div className="voucher-void-row">
                    <input
                      type="text"
                      placeholder="İptal nedeni"
                      value={voidReason}
                      onChange={(e) => setVoidReason(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      disabled={!voidReason.trim()}
                      onClick={handleVoid}
                    >
                      Fişi iptal et
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
