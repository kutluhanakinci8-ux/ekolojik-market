import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { getCategoryLabel } from '../data/categories';
import type { AppSettings } from '../types/business';
import { listProductCategorySelectOptions } from '../utils/productCategories';
import type { Product, WholesalePrices } from '../types/product';
import type { ProductPricingInput } from '../utils/productPricing';
import type { ProductSet, ProductSetItem } from '../types/productSet';
import { ProductImage } from './ProductImage';
import { isCustomImage } from '../utils/productImage';
import { ProductSetPanel } from './ProductSetPanel';
import { formatCurrencyTry } from '../utils/format';
import {
  appendStockCountPauseToDraft,
  clearStockCountSessionDraft,
  loadStockCountSessionDraft,
  resumeStockCountPauseInDraft,
  saveStockCountSessionDraft,
} from '../storage/stockCountSession';
import type { AuthSession } from '../types/user';
import { formatStockCountReportDateTime } from '../utils/stockCountReportFormat';
import { normalizeBarcodeScanInput, resolveBarcodeScan } from '../utils/barcodeScan';
import { formatDateTime } from '../utils/format';
import type { StockCountBreakRecord, StockCountReport } from '../types/stockCountReport';
import {
  buildStockCountReportLines,
  isStockCountReportComplete,
  newStockCountReportId,
  stockCountReportPendingApply,
} from '../types/stockCountReport';
import { printStockCountReceiptReport } from '../utils/stockCountReceiptReport';
import { STANDARD_WINDOWS_ZYWELL_PRINTER_NAME } from '../types/receiptPrinter';
import './StockOperationsModal.css';

type StockCountLine = {
  productId: number;
  /** Sayım başladığında sistemdeki stok (değişmez). */
  systemStock: number;
  scannedQty: number;
};

export type StockOperationType = 'in' | 'out' | 'set' | 'clear' | 'bundle';

interface StockOperationsModalProps {
  open: boolean;
  products: Product[];
  productSets: ProductSet[];
  lowStockThreshold: number;
  initialProductId?: number;
  initialOperation?: StockOperationType;
  onClose: () => void;
  onAdjust: (productId: number, delta: number, note: string) => void;
  onSetStock: (productId: number, stock: number, note: string) => void;
  onSaveSet: (data: {
    id?: string;
    stockCode: string;
    name: string;
    description?: string;
    items: ProductSetItem[];
    ourPriceWithVat: number;
    partnerPriceWithVat: number;
    wholesalePrices?: WholesalePrices;
    isActive?: boolean;
  }) => ProductSet | null;
  onAssembleSet: (setId: string, quantity: number, note?: string) => { ok: boolean; message?: string };
  onAdjustSetStock: (setId: string, delta: number, note?: string) => void;
  onRemoveSet: (setId: string) => void;
  onUpdateBarcode?: (productId: number, barcode: string) => void;
  onUploadImage?: (productId: number, imageUrl: string) => void;
  onRemoveImage?: (productId: number) => void;
  onUpdatePricing?: (productId: number, input: ProductPricingInput) => void;
  onPricingSaveResult?: (saved: boolean) => void;
  /** Lima / pos-lite: perakende KDV hariç */
  perakendeKdvHaric?: boolean;
  settings?: AppSettings;
  authSession?: AuthSession | null;
  stockCountReports?: StockCountReport[];
  onSaveStockCountReport?: (report: StockCountReport) => void;
  onMarkStockCountReportPrinted?: (reportId: string) => void;
  onMarkStockCountLineApplied?: (reportId: string, productId: number) => void;
  onUpdateProductCategory?: (productId: number, categoryId: string) => void;
  onManageCategories?: () => void;
}

const OPERATIONS: Array<{
  id: StockOperationType;
  label: string;
  hint: string;
  icon: string;
  tone: 'in' | 'out' | 'set' | 'clear' | 'bundle';
}> = [
  { id: 'in', label: 'Giriş', hint: 'Stoğa ekle', icon: '↗', tone: 'in' },
  { id: 'out', label: 'Çıkış', hint: 'Stoktan düş', icon: '↘', tone: 'out' },
  { id: 'set', label: 'Sayım', hint: 'Barkod ile sayım', icon: '✎', tone: 'set' },
  { id: 'clear', label: 'Sıfırla', hint: 'Stok = 0', icon: '⊘', tone: 'clear' },
  { id: 'bundle', label: 'Set Oluştur', hint: 'Ürün paketi', icon: '🎁', tone: 'bundle' as const },
];

const QUICK_AMOUNTS = [1, 5, 10, 25, 50, 100];

function getStockStatus(product: Product, threshold: number): 'ok' | 'low' | 'out' {
  if (product.stock <= 0) return 'out';
  if (product.stock <= threshold) return 'low';
  return 'ok';
}

function getStockStatusLabel(status: 'ok' | 'low' | 'out'): string {
  if (status === 'out') return 'Tükendi';
  if (status === 'low') return 'Az Stok';
  return 'Yeterli';
}

function defaultNote(operation: StockOperationType): string {
  switch (operation) {
    case 'in':
      return 'Stok girişi';
    case 'out':
      return 'Stok çıkışı';
    case 'set':
      return 'Stok sayımı / düzeltme';
    case 'clear':
      return 'Stok sıfırlama';
    default:
      return 'Stok işlemi';
  }
}

export function StockOperationsModal({
  open,
  products,
  productSets,
  lowStockThreshold,
  initialProductId,
  initialOperation = 'in',
  onClose,
  onAdjust,
  onSetStock,
  onSaveSet,
  onAssembleSet,
  onAdjustSetStock,
  onRemoveSet,
  onUpdateBarcode,
  onUploadImage,
  onRemoveImage,
  onUpdatePricing,
  onPricingSaveResult,
  perakendeKdvHaric = false,
  settings,
  authSession,
  stockCountReports = [],
  onSaveStockCountReport,
  onMarkStockCountReportPrinted,
  onMarkStockCountLineApplied,
  onUpdateProductCategory,
  onManageCategories,
}: StockOperationsModalProps) {
  const [operation, setOperation] = useState<StockOperationType>(initialOperation);
  const [productId, setProductId] = useState('');
  const [search, setSearch] = useState('');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [barcodeDraft, setBarcodeDraft] = useState('');
  const [purchaseDraft, setPurchaseDraft] = useState('');
  const [partnerDraft, setPartnerDraft] = useState('');
  const [couponDraft, setCouponDraft] = useState('');
  const [retailDraft, setRetailDraft] = useState('');
  const [categoryDraft, setCategoryDraft] = useState('');
  const [countPhase, setCountPhase] = useState<'scan' | 'report' | 'apply'>('scan');
  const [countLines, setCountLines] = useState<Record<number, StockCountLine>>({});
  const [countLastProductId, setCountLastProductId] = useState<number | null>(null);
  const [countReportId, setCountReportId] = useState<string | null>(null);
  const [countScanInput, setCountScanInput] = useState('');
  const [countScanError, setCountScanError] = useState<string | null>(null);
  const [countSessionStartedAt, setCountSessionStartedAt] = useState<string | null>(null);
  const [countDraftRestored, setCountDraftRestored] = useState(false);
  const [countPrintMessage, setCountPrintMessage] = useState<string | null>(null);
  const [countPrinting, setCountPrinting] = useState(false);
  const [countLocalPrinted, setCountLocalPrinted] = useState(false);
  const [countBreaks, setCountBreaks] = useState<StockCountBreakRecord[]>([]);
  const [countCountedByDisplayName, setCountCountedByDisplayName] = useState('');
  const [countCountedByUsername, setCountCountedByUsername] = useState('');
  const [countResponsiblePersonName, setCountResponsiblePersonName] = useState('');
  const [countEndedAt, setCountEndedAt] = useState<string | null>(null);
  const [countApplyQtyDraft, setCountApplyQtyDraft] = useState<Record<number, string>>({});
  const [countAbandonPrompt, setCountAbandonPrompt] = useState(false);
  const countScanInputRef = useRef<HTMLInputElement>(null);
  const countModalWasOpenRef = useRef(false);

  const applyCountDraftToState = useCallback((draft: ReturnType<typeof loadStockCountSessionDraft>) => {
    if (!draft || Object.keys(draft.countLines).length === 0) return false;
    if (draft.reportId) {
      const archived = stockCountReports.find((r) => r.id === draft.reportId);
      if (archived?.abandonedAt || (archived?.completedAt && isStockCountReportComplete(archived))) {
        clearStockCountSessionDraft();
        return false;
      }
    }
    const archivedForPrint = draft.reportId
      ? stockCountReports.find((r) => r.id === draft.reportId)
      : undefined;
    setCountPhase(draft.countPhase);
    setCountLines(draft.countLines);
    setCountLastProductId(draft.countLastProductId);
    setNote(draft.note ?? '');
    setCountSessionStartedAt(draft.startedAt);
    setCountReportId(draft.reportId ?? null);
    setCountBreaks(draft.breaks ?? []);
    setCountCountedByDisplayName(draft.countedByDisplayName ?? '');
    setCountCountedByUsername(draft.countedByUsername ?? '');
    setCountResponsiblePersonName(draft.responsiblePersonName ?? '');
    setCountEndedAt(draft.endedAt ?? null);
    setCountScanInput('');
    setCountScanError(null);
    setCountPrintMessage(null);
    setCountLocalPrinted(Boolean(archivedForPrint?.printedAt));
    setCountDraftRestored(true);
    return true;
  }, [stockCountReports]);

  const resetCountSession = useCallback(() => {
    setCountPhase('scan');
    setCountLines({});
    setCountLastProductId(null);
    setCountReportId(null);
    setCountScanInput('');
    setCountScanError(null);
    setCountSessionStartedAt(null);
    setCountDraftRestored(false);
    setCountPrintMessage(null);
    setCountLocalPrinted(false);
    setCountBreaks([]);
    setCountCountedByDisplayName('');
    setCountCountedByUsername('');
    setCountResponsiblePersonName('');
    setCountEndedAt(null);
    setCountApplyQtyDraft({});
    setCountAbandonPrompt(false);
    clearStockCountSessionDraft();
  }, []);

  useEffect(() => {
    if (open) {
      if (operation === 'set') {
        const resumed = resumeStockCountPauseInDraft();
        setCountBreaks(resumed);
      }
      countModalWasOpenRef.current = true;
      return;
    }
    if (!countModalWasOpenRef.current) return;
    countModalWasOpenRef.current = false;
    appendStockCountPauseToDraft();
  }, [open, operation]);

  const categoryOptions = useMemo(
    () => listProductCategorySelectOptions(settings),
    [settings],
  );

  useEffect(() => {
    if (!open) return;
    setCountAbandonPrompt(false);
    setOperation(initialOperation);
    setProductId(initialProductId ? String(initialProductId) : '');
    setSearch('');
    setQuantity('');
    if (initialOperation === 'set') {
      const draft = loadStockCountSessionDraft();
      if (!applyCountDraftToState(draft)) {
        setNote('');
        setCountPhase('scan');
        setCountLines({});
        setCountLastProductId(null);
        setCountSessionStartedAt(null);
        setCountDraftRestored(false);
      }
    } else {
      setNote('');
    }
  }, [open, initialProductId, initialOperation, applyCountDraftToState]);

  useEffect(() => {
    if (!open || operation !== 'set') return;
    if (Object.keys(countLines).length > 0) return;
    const draft = loadStockCountSessionDraft();
    applyCountDraftToState(draft);
  }, [open, operation, countLines, applyCountDraftToState]);

  useEffect(() => {
    if (!open || operation !== 'set') return;
    const lineCount = Object.keys(countLines).length;
    if (lineCount === 0 && countPhase === 'scan' && !countSessionStartedAt) {
      clearStockCountSessionDraft();
      return;
    }
    if (lineCount === 0) return;
    const startedAt = countSessionStartedAt ?? new Date().toISOString();
    if (!countSessionStartedAt) setCountSessionStartedAt(startedAt);
    saveStockCountSessionDraft({
      startedAt,
      countPhase,
      countLines,
      countLastProductId,
      note,
      reportId: countReportId,
      countedByDisplayName: countCountedByDisplayName || undefined,
      countedByUsername: countCountedByUsername || undefined,
      breaks: countBreaks.length ? countBreaks : undefined,
      responsiblePersonName: countResponsiblePersonName || undefined,
      endedAt: countEndedAt ?? undefined,
    });
  }, [
    open,
    operation,
    countPhase,
    countLines,
    countLastProductId,
    note,
    countSessionStartedAt,
    countReportId,
    countCountedByDisplayName,
    countCountedByUsername,
    countBreaks,
    countResponsiblePersonName,
    countEndedAt,
  ]);

  useEffect(() => {
    if (!open || operation !== 'set' || countPhase !== 'scan') return;
    const t = window.setTimeout(() => countScanInputRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, [open, operation, countPhase]);

  const selectedProduct = useMemo(() => {
    const id = Number.parseInt(productId, 10);
    if (Number.isNaN(id)) return undefined;
    return products.find((product) => product.id === id);
  }, [productId, products]);

  useEffect(() => {
    setBarcodeDraft(selectedProduct?.barcode ?? '');
  }, [selectedProduct?.id, selectedProduct?.barcode]);

  useEffect(() => {
    setCategoryDraft(selectedProduct?.category ?? '');
  }, [selectedProduct?.id, selectedProduct?.category]);

  useEffect(() => {
    if (!selectedProduct) {
      setPurchaseDraft('');
      setPartnerDraft('');
      setCouponDraft('');
      setRetailDraft('');
      return;
    }
    setPurchaseDraft(selectedProduct.purchasePrice > 0 ? String(selectedProduct.purchasePrice) : '');
    setPartnerDraft(selectedProduct.partnerPrice > 0 ? String(selectedProduct.partnerPrice) : '');
    setCouponDraft(
      (selectedProduct.couponPrice ?? 0) > 0 ? String(selectedProduct.couponPrice) : '',
    );
    setRetailDraft(selectedProduct.fullSalePrice > 0 ? String(selectedProduct.fullSalePrice) : '');
  }, [
    selectedProduct?.id,
    selectedProduct?.purchasePrice,
    selectedProduct?.partnerPrice,
    selectedProduct?.couponPrice,
    selectedProduct?.fullSalePrice,
  ]);

  const parsePriceDraft = (draft: string): number | undefined => {
    const normalized = draft.trim().replace(',', '.');
    if (!normalized) return undefined;
    const value = Number.parseFloat(normalized);
    if (!Number.isFinite(value) || value < 0) return undefined;
    return value;
  };

  const priceDraftChanged = (draft: number | undefined, current: number) => {
    if (draft == null) return false;
    return Math.abs(draft - current) > 0.004;
  };

  const buildPricingPatch = (): ProductPricingInput | null => {
    if (!selectedProduct || !onUpdatePricing) return null;
    const patch: ProductPricingInput = {};
    const purchase = parsePriceDraft(purchaseDraft);
    const partner = parsePriceDraft(partnerDraft);
    const coupon = parsePriceDraft(couponDraft);
    const retail = parsePriceDraft(retailDraft);
    if (priceDraftChanged(purchase, selectedProduct.purchasePrice)) patch.purchasePrice = purchase;
    if (priceDraftChanged(partner, selectedProduct.partnerPrice)) patch.partnerPrice = partner;
    const couponBase = selectedProduct.couponPrice ?? selectedProduct.partnerPrice;
    if (priceDraftChanged(coupon, couponBase)) patch.couponPrice = coupon;
    if (priceDraftChanged(retail, selectedProduct.fullSalePrice)) patch.fullSalePrice = retail;
    return Object.keys(patch).length > 0 ? patch : null;
  };

  const applyPricingDraft = (): boolean => {
    const id = Number.parseInt(productId, 10);
    if (Number.isNaN(id) || !onUpdatePricing) return false;
    const patch = buildPricingPatch();
    if (!patch) return false;
    onUpdatePricing(id, patch);
    return true;
  };

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? products.filter((product) =>
        product.name.toLowerCase().includes(q)
        || String(product.id).includes(q)
        || (product.productCode ?? '').toLowerCase().includes(q)
        || (product.barcode ?? '').toLowerCase().includes(q),
      )
      : products;
    return list.slice(0, 12);
  }, [products, search]);

  const parsedQty = Number.parseInt(quantity, 10);
  const hasValidQty = !Number.isNaN(parsedQty) && parsedQty > 0;

  const previewStock = useMemo(() => {
    if (!selectedProduct) return null;
    if (operation === 'clear') return 0;
    if (!hasValidQty) return selectedProduct.stock;
    if (operation === 'in') return selectedProduct.stock + parsedQty;
    if (operation === 'out') return Math.max(0, selectedProduct.stock - parsedQty);
    if (operation === 'set') return Math.max(0, parsedQty);
    return selectedProduct.stock;
  }, [selectedProduct, operation, hasValidQty, parsedQty]);

  const previewDelta = selectedProduct && previewStock != null
    ? previewStock - selectedProduct.stock
    : 0;

  const activeOperation = OPERATIONS.find((item) => item.id === operation)!;

  const previewPricing = useMemo(() => {
    if (!selectedProduct) return null;
    return {
      purchase: parsePriceDraft(purchaseDraft) ?? selectedProduct.purchasePrice,
      partner: parsePriceDraft(partnerDraft) ?? selectedProduct.partnerPrice,
      coupon: parsePriceDraft(couponDraft) ?? selectedProduct.couponPrice ?? selectedProduct.partnerPrice,
      retail: parsePriceDraft(retailDraft) ?? selectedProduct.fullSalePrice,
    };
  }, [selectedProduct, purchaseDraft, partnerDraft, couponDraft, retailDraft]);

  const previewStockValue = useMemo(() => {
    if (!previewPricing || previewStock == null) return null;
    return previewStock * previewPricing.purchase;
  }, [previewPricing, previewStock]);

  const selectProduct = (product: Product) => {
    setProductId(String(product.id));
    setSearch(product.productCode ?? product.name);
  };

  const clearProduct = () => {
    setProductId('');
    setSearch('');
  };

  const countLineList = useMemo(
    () => Object.values(countLines).sort((a, b) => b.scannedQty - a.scannedQty),
    [countLines],
  );

  const countLastProduct = useMemo(() => {
    if (countLastProductId == null) return undefined;
    return products.find((p) => p.id === countLastProductId);
  }, [countLastProductId, products]);

  const countLastLine = countLastProductId != null ? countLines[countLastProductId] : undefined;

  const countReportRows = useMemo(() => countLineList.map((line) => {
    const product = products.find((p) => p.id === line.productId);
    const diff = line.scannedQty - line.systemStock;
    return { line, product, diff };
  }).filter((row) => row.product), [countLineList, products]);

  const countDiscrepancyRows = useMemo(
    () => countReportRows.filter((row) => row.diff !== 0),
    [countReportRows],
  );

  const activeCountReport = useMemo(
    () => (countReportId ? stockCountReports.find((r) => r.id === countReportId) : undefined),
    [countReportId, stockCountReports],
  );

  const countReportPrinted = Boolean(activeCountReport?.printedAt || countLocalPrinted);

  const countPendingApplyRows = useMemo(() => {
    if (!activeCountReport) return countDiscrepancyRows;
    const pendingIds = new Set(
      stockCountReportPendingApply(activeCountReport).map((line) => line.productId),
    );
    return countDiscrepancyRows.filter((row) => pendingIds.has(row.line.productId));
  }, [activeCountReport, countDiscrepancyRows]);

  useEffect(() => {
    if (countPhase !== 'apply') return;
    setCountApplyQtyDraft((prev) => {
      const next = { ...prev };
      for (const { line } of countPendingApplyRows) {
        if (next[line.productId] === undefined) {
          next[line.productId] = String(line.scannedQty);
        }
      }
      return next;
    });
  }, [countPhase, countPendingApplyRows]);

  const businessName = settings?.businessName?.trim() || 'Mağaza';
  const receiptPrinterName =
    settings?.receiptPrinter?.windowsPrinterName?.trim() || STANDARD_WINDOWS_ZYWELL_PRINTER_NAME;

  const registerCountScan = (product: Product) => {
    setCountDraftRestored(false);
    if (!countCountedByDisplayName && authSession?.displayName) {
      setCountCountedByDisplayName(authSession.displayName);
      setCountCountedByUsername(authSession.username);
    }
    setCountLines((prev) => {
      const existing = prev[product.id];
      const systemStock = existing?.systemStock ?? product.stock;
      return {
        ...prev,
        [product.id]: {
          productId: product.id,
          systemStock,
          scannedQty: (existing?.scannedQty ?? 0) + 1,
        },
      };
    });
    setCountLastProductId(product.id);
    setCountScanError(null);
    setCountScanInput('');
    window.requestAnimationFrame(() => countScanInputRef.current?.focus());
  };

  const handleCountBarcodeSubmit = () => {
    const raw = normalizeBarcodeScanInput(countScanInput);
    if (!raw) return;
    const result = resolveBarcodeScan(raw, products, productSets, { allowZeroStock: true });
    if (result.kind === 'product') {
      const product = products.find((p) => p.id === result.productId);
      if (!product) {
        setCountScanError('Ürün bulunamadı');
        return;
      }
      registerCountScan(product);
      return;
    }
    if (result.kind === 'set') {
      setCountScanError('Set barkodu — stok sayımı için ürün barkodu okutun');
      return;
    }
    setCountScanError(result.message);
  };

  const switchOperation = (next: StockOperationType) => {
    if (operation === 'set' && next !== 'set' && countLineList.length > 0) {
      if (!window.confirm('Devam eden sayım oturumu var. Sekmeyi değiştirmek oturumu siler. Emin misiniz?')) {
        return;
      }
      resetCountSession();
    }
    setOperation(next);
    setQuantity('');
  };

  const persistCountReport = useCallback((endedAtOverride?: string): StockCountReport | null => {
    if (countLineList.length === 0) return null;
    const id = countReportId ?? newStockCountReportId();
    const startedAt = countSessionStartedAt ?? new Date().toISOString();
    const endedAt = endedAtOverride ?? countEndedAt ?? activeCountReport?.endedAt ?? undefined;
    const baseLines = buildStockCountReportLines(countLineList);
    const lines = baseLines.map((line) => {
      const prev = activeCountReport?.lines.find((item) => item.productId === line.productId);
      return prev?.appliedAt ? { ...line, appliedAt: prev.appliedAt } : line;
    });
    const report: StockCountReport = {
      id,
      startedAt,
      endedAt,
      createdAt: activeCountReport?.createdAt ?? new Date().toISOString(),
      note: note.trim(),
      lines,
      countedByDisplayName: countCountedByDisplayName
        || authSession?.displayName
        || activeCountReport?.countedByDisplayName,
      countedByUsername: countCountedByUsername
        || authSession?.username
        || activeCountReport?.countedByUsername,
      breaks: countBreaks.length ? countBreaks : activeCountReport?.breaks,
      responsiblePersonName: countResponsiblePersonName.trim() || activeCountReport?.responsiblePersonName,
      printedAt: activeCountReport?.printedAt,
      completedAt: activeCountReport?.completedAt,
    };
    onSaveStockCountReport?.(report);
    setCountReportId(id);
    return report;
  }, [
    activeCountReport,
    countBreaks,
    countCountedByDisplayName,
    countCountedByUsername,
    countEndedAt,
    countLineList,
    countReportId,
    countResponsiblePersonName,
    countSessionStartedAt,
    note,
    onSaveStockCountReport,
    authSession,
  ]);

  const ensureCountReportId = useCallback((): string | null => {
    if (countReportId) return countReportId;
    const report = persistCountReport();
    return report?.id ?? null;
  }, [countReportId, persistCountReport]);

  const requestAbandonCountSession = useCallback((event?: MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (countLineList.length === 0) {
      clearStockCountSessionDraft();
      resetCountSession();
      onClose();
      return;
    }
    setCountAbandonPrompt(true);
  }, [countLineList.length, onClose, resetCountSession]);

  const executeAbandonCountSession = useCallback(() => {
    const abandonedAt = new Date().toISOString();
    const report = persistCountReport();
    if (report) {
      const noteSuffix = 'Yarım bırakılan sayım';
      const mergedNote = report.note.trim()
        ? `${report.note.trim()} (${noteSuffix})`
        : noteSuffix;
      onSaveStockCountReport?.({
        ...report,
        abandonedAt,
        note: mergedNote,
      });
    }
    clearStockCountSessionDraft();
    resetCountSession();
    setCountAbandonPrompt(false);
    onClose();
  }, [onClose, onSaveStockCountReport, persistCountReport, resetCountSession]);

  const cancelAbandonCountSession = useCallback(() => {
    setCountAbandonPrompt(false);
  }, []);

  const completeCountSession = useCallback((options?: { force?: boolean }) => {
    const reportId = ensureCountReportId();
    const report = reportId
      ? stockCountReports.find((r) => r.id === reportId) ?? persistCountReport()
      : persistCountReport();
    if (
      !options?.force
      && report
      && stockCountReportPendingApply(report).length > 0
    ) {
      window.alert(
        'Henüz uygulanmamış düzeltme var. Düzeltmeyi uygulayın veya «Sayımdan çık (yarım bırak)» ile oturumu sonlandırın.',
      );
      return;
    }
    if (report) {
      onSaveStockCountReport?.({
        ...report,
        completedAt: report.completedAt ?? new Date().toISOString(),
      });
    }
    resetCountSession();
    onClose();
  }, [
    ensureCountReportId,
    onClose,
    onSaveStockCountReport,
    persistCountReport,
    resetCountSession,
    stockCountReports,
  ]);

  const finishCountSession = () => {
    if (countLineList.length === 0) {
      setCountScanError('Önce en az bir ürün okutun');
      return;
    }
    if (!countCountedByDisplayName && authSession?.displayName) {
      setCountCountedByDisplayName(authSession.displayName);
      setCountCountedByUsername(authSession.username);
    }
    const ended = new Date().toISOString();
    setCountEndedAt(ended);
    persistCountReport(ended);
    setCountPhase('report');
    setCountScanError(null);
    setCountPrintMessage(null);
  };

  const handlePrintCountReport = async () => {
    const report = persistCountReport();
    if (!report) return;
    setCountPrinting(true);
    setCountPrintMessage(null);
    try {
      const printedAt = new Date();
      const result = await printStockCountReceiptReport({
        businessName,
        report,
        products,
        printedAt,
      }, receiptPrinterName);
      if (result.printed) {
        onMarkStockCountReportPrinted?.(report.id);
        setCountLocalPrinted(true);
      }
      setCountPrintMessage(result.message ?? (result.printed ? 'Rapor yazdırıldı' : 'Yazdırılamadı'));
    } finally {
      setCountPrinting(false);
    }
  };

  const goToCountApplyPhase = () => {
    if (!countReportPrinted) {
      window.alert('Önce sayım raporunu fiş yazıcısından yazdırın.');
      return;
    }
    persistCountReport();
    if (countDiscrepancyRows.length === 0) {
      completeCountSession();
      return;
    }
    setCountPhase('apply');
  };

  const applySingleCountCorrection = (productId: number) => {
    if (!countReportPrinted) {
      window.alert('Önce sayım raporunu yazdırın.');
      return;
    }
    const reportId = ensureCountReportId();
    if (!reportId) {
      window.alert('Sayım raporu kaydı oluşturulamadı. Rapora dönüp «Sayımı bitir» adımını tekrarlayın.');
      return;
    }
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const raw = countApplyQtyDraft[productId] ?? '';
    const newStock = Number.parseInt(raw, 10);
    if (Number.isNaN(newStock) || newStock < 0) {
      window.alert('Geçerli bir stok adedi girin (0 veya üzeri tam sayı).');
      return;
    }
    const trimmedNote = note.trim() || 'Stok sayımı düzeltmesi (barkod)';
    const label = product.productCode ?? String(product.id);
    if (!window.confirm(
      `${product.name} (${label})\nGüncel stok ${product.stock} → ${newStock} olarak kaydedilsin mi?`,
    )) {
      return;
    }
    onSetStock(productId, newStock, trimmedNote);
    onMarkStockCountLineApplied?.(reportId, productId);
    const remainingAfter = countPendingApplyRows.filter(
      (row) => row.line.productId !== productId,
    ).length;
    if (remainingAfter === 0) {
      window.alert('Tüm düzeltmeler işlendi.');
      completeCountSession({ force: true });
    }
  };

  const finishCountWithoutCorrections = () => {
    if (!countReportPrinted) {
      window.alert('Önce sayım raporunu yazdırın.');
      return;
    }
    completeCountSession();
  };

  const applyQuickAmount = (amount: number) => {
    if (operation === 'set') {
      setQuantity(String(amount));
      return;
    }
    const current = Number.parseInt(quantity, 10);
    const base = Number.isNaN(current) ? 0 : current;
    setQuantity(String(base + amount));
  };

  const handleSubmit = () => {
    const id = Number.parseInt(productId, 10);
    if (Number.isNaN(id) || !selectedProduct) return;

    applyPricingDraft();

    const trimmedNote = note.trim() || defaultNote(operation);

    if (operation === 'clear') {
      if (!window.confirm(`${selectedProduct.name} stoğu sıfırlansın mı?`)) return;
      onSetStock(id, 0, trimmedNote);
      onClose();
      return;
    }

    if (!hasValidQty) return;

    if (operation === 'set') {
      onSetStock(id, parsedQty, trimmedNote);
      onClose();
      return;
    }

    const delta = operation === 'in' ? parsedQty : -parsedQty;
    if (operation === 'out' && selectedProduct.stock - parsedQty < 0) {
      if (!window.confirm(`Stok ${selectedProduct.stock} adet. ${parsedQty} çıkış yapılsın mı? (0'a düşer)`)) return;
    }
    onAdjust(id, delta, trimmedNote);
    onClose();
  };

  const canSubmit = Boolean(selectedProduct) && (operation === 'clear' || hasValidQty);
  const submitLabel = operation === 'clear'
    ? 'Stoku Sıfırla'
    : operation === 'set'
      ? 'Stoku Güncelle'
      : operation === 'in'
        ? 'Stok Girişi Yap'
        : 'Stok Çıkışı Yap';

  const quantityLabel = operation === 'set'
    ? 'Yeni stok miktarı'
    : operation === 'in'
      ? 'Eklenecek miktar'
      : 'Çıkarılacak miktar';

  if (!open) return null;

  const selectedStatus = selectedProduct ? getStockStatus(selectedProduct, lowStockThreshold) : null;

  return createPortal(
    <div className="stock-ops-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="stock-ops-dialog"
        style={{ width: 'min(960px, calc(100vw - 48px))', maxWidth: '960px' }}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="stock-ops-dialog__header">
          <div>
            <p className="stock-ops-dialog__eyebrow">Stok Merkezi</p>
            <h2>Stok İşlemleri</h2>
          </div>
          <button type="button" className="stock-ops-dialog__close" onClick={onClose} aria-label="Kapat">×</button>
        </header>

        {operation === 'set' && countAbandonPrompt && (
          <div
            className="stock-ops-dialog__count-abandon-prompt"
            role="alertdialog"
            aria-labelledby="stock-count-abandon-title"
            aria-describedby="stock-count-abandon-desc"
          >
            <p id="stock-count-abandon-title" className="stock-ops-dialog__count-abandon-title">
              Sayımdan çıkılsın mı?
            </p>
            <p id="stock-count-abandon-desc" className="stock-ops-dialog__count-abandon-desc">
              Oturum <strong>yarım bırakılan</strong> olarak arşivlenir; stok düzeltilmez. Ardından yeni sayım başlatabilirsiniz.
            </p>
            <div className="stock-ops-dialog__count-abandon-actions">
              <button type="button" className="btn btn-outline" onClick={cancelAbandonCountSession}>
                Vazgeç
              </button>
              <button
                type="button"
                className="btn btn-primary stock-ops-dialog__count-btn-abandon-solid"
                onClick={executeAbandonCountSession}
              >
                Evet, sayımdan çık
              </button>
            </div>
          </div>
        )}

        <div className="stock-ops-dialog__tabs" role="tablist" aria-label="Stok işlem tipi">
          {OPERATIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={operation === item.id}
              className={`stock-ops-dialog__tab stock-ops-dialog__tab--${item.tone} ${operation === item.id ? 'is-active' : ''}`}
              onClick={() => switchOperation(item.id)}
            >
              <span className="stock-ops-dialog__tab-icon" aria-hidden>{item.icon}</span>
              <span className="stock-ops-dialog__tab-text">
                <strong>{item.label}</strong>
                <small>{item.hint}</small>
              </span>
            </button>
          ))}
        </div>

        {operation === 'bundle' ? (
          <div className="stock-ops-dialog__body stock-ops-dialog__body--bundle">
            <ProductSetPanel
              products={products}
              productSets={productSets}
              onSave={onSaveSet}
              onAssemble={onAssembleSet}
              onAdjustStock={onAdjustSetStock}
              onRemove={onRemoveSet}
            />
            <div className="stock-ops-dialog__footer stock-ops-dialog__footer--bundle">
              <button type="button" className="btn btn-outline" onClick={onClose}>Kapat</button>
            </div>
          </div>
        ) : (
        <div className={`stock-ops-dialog__body${operation === 'set' ? ' stock-ops-dialog__body--count' : ''}`}>
          {operation === 'set' ? (
            <>
              <section className="stock-ops-dialog__main stock-ops-dialog__main--count">
                {countPhase === 'scan' ? (
                  <>
                    <p className="stock-ops-dialog__count-lead">
                      Barkod okuyucu ile ürün okutun. <strong>Sistem stoğu</strong> sayım bitene kadar değişmez;
                      her okutma <strong>sayım adedini</strong> artırır ve konumda kalan miktarı gösterir.
                      Oturum bu cihazda otomatik kaydedilir (çıkış / şifre ekranı sonrası devam edebilirsiniz).
                    </p>
                    {countDraftRestored && countLineList.length > 0 && (
                      <p className="stock-ops-dialog__count-resume" role="status">
                        Yarım kalan sayım yüklendi
                        {countSessionStartedAt ? ` · başlangıç ${formatDateTime(countSessionStartedAt)}` : ''}
                        {' · '}
                        {countLineList.length} kalem, {countLineList.reduce((s, l) => s + l.scannedQty, 0)} okutma
                      </p>
                    )}
                    <form
                      className="stock-ops-dialog__count-scan"
                      onSubmit={(event) => {
                        event.preventDefault();
                        handleCountBarcodeSubmit();
                      }}
                    >
                      <label className="stock-ops-dialog__field stock-ops-dialog__field--scan">
                        <span>Barkod okut</span>
                        <input
                          ref={countScanInputRef}
                          type="text"
                          autoComplete="off"
                          spellCheck={false}
                          value={countScanInput}
                          onChange={(event) => {
                            setCountScanInput(event.target.value);
                            setCountScanError(null);
                          }}
                          placeholder="Okuyucu buraya odaklı — barkod + Enter"
                        />
                      </label>
                    </form>
                    {countScanError && (
                      <p className="stock-ops-dialog__count-error" role="alert">{countScanError}</p>
                    )}
                    {countLastProduct && countLastLine && (
                      <div className="stock-ops-dialog__count-hero">
                        <div className="stock-ops-dialog__count-hero-photo">
                          <ProductImage product={countLastProduct} size="lg" />
                        </div>
                        <div className="stock-ops-dialog__count-hero-info">
                          <h3 className="stock-ops-dialog__count-hero-title">{countLastProduct.name}</h3>
                          <p className="stock-ops-dialog__count-hero-meta">
                            {countLastProduct.productCode?.trim() || `No ${countLastProduct.id}`}
                            {countLastProduct.barcode ? ` · ${countLastProduct.barcode}` : ''}
                          </p>
                          <div className="stock-ops-dialog__count-stats">
                            <div className="stock-ops-dialog__count-stat">
                              <span>Mevcut (sistem)</span>
                              <strong>{countLastLine.systemStock}</strong>
                            </div>
                            <div className="stock-ops-dialog__count-stat stock-ops-dialog__count-stat--accent">
                              <span>Sayım adeti</span>
                              <strong>{countLastLine.scannedQty}</strong>
                            </div>
                            <div className="stock-ops-dialog__count-stat">
                              <span>Konumda kalan</span>
                              <strong>
                                {Math.max(0, countLastLine.systemStock - countLastLine.scannedQty)}
                              </strong>
                            </div>
                          </div>
                          {countLastLine.scannedQty > countLastLine.systemStock && (
                            <p className="stock-ops-dialog__count-warn">
                              Sistem stoğundan fazla okutma — raporda fazla görünecek.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    {countLineList.length > 0 && (
                      <div className="stock-ops-dialog__count-table-wrap">
                        <table className="stock-ops-dialog__count-table">
                          <thead>
                            <tr>
                              <th>Ürün</th>
                              <th>Sistem</th>
                              <th>Sayım</th>
                              <th>Kalan</th>
                            </tr>
                          </thead>
                          <tbody>
                            {countLineList.map((line) => {
                              const product = products.find((p) => p.id === line.productId);
                              if (!product) return null;
                              const remaining = Math.max(0, line.systemStock - line.scannedQty);
                              return (
                                <tr
                                  key={line.productId}
                                  className={line.productId === countLastProductId ? 'is-last' : ''}
                                >
                                  <td>
                                    <span className="stock-ops-dialog__count-table-name">{product.name}</span>
                                    <span className="stock-ops-dialog__count-table-code">
                                      {product.productCode ?? product.id}
                                    </span>
                                  </td>
                                  <td>{line.systemStock}</td>
                                  <td><strong>{line.scannedQty}</strong></td>
                                  <td>{remaining}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : countPhase === 'report' ? (
                  <>
                    <h3 className="stock-ops-dialog__count-report-title">Sayım raporu</h3>
                    <p className="stock-ops-dialog__count-lead">
                      Önce raporu fiş yazıcısından yazdırın. Aynı rapor Muhasebe → Raporlar → Sayım Raporları altında saklanır.
                      {countDiscrepancyRows.length === 0
                        ? ' Tüm satırlar uyumlu — yazdırdıktan sonra sayımı tamamlayabilirsiniz.'
                        : ` ${countDiscrepancyRows.length} üründe fark var; yazdırdıktan sonra ürün kartlarından tek tek düzeltme uygulayın.`}
                    </p>
                    {countPrintMessage && (
                      <p className="stock-ops-dialog__count-print-msg" role="status">{countPrintMessage}</p>
                    )}
                    <div className="stock-ops-dialog__count-meta">
                      <p>
                        <strong>Sayım yapan:</strong>{' '}
                        {countCountedByDisplayName || activeCountReport?.countedByDisplayName || '—'}
                      </p>
                      <p>
                        <strong>Başlangıç:</strong>{' '}
                        {formatStockCountReportDateTime(countSessionStartedAt ?? activeCountReport?.startedAt ?? new Date().toISOString())}
                        {' · '}
                        <strong>Bitiş:</strong>{' '}
                        {(countEndedAt || activeCountReport?.endedAt)
                          ? formatStockCountReportDateTime(countEndedAt ?? activeCountReport!.endedAt!)
                          : '—'}
                      </p>
                      {countBreaks.length > 0 && (
                        <ul className="stock-ops-dialog__count-breaks">
                          {countBreaks.map((entry, index) => (
                            <li key={`${entry.pausedAt}-${index}`}>
                              Ara {index + 1}: {formatStockCountReportDateTime(entry.pausedAt)}
                              {entry.resumedAt
                                ? ` → devam ${formatStockCountReportDateTime(entry.resumedAt)}`
                                : ' → devam bekleniyor'}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <label className="stock-ops-dialog__field">
                      <span>Sorumlu kişi (fiş imza satırı)</span>
                      <input
                        type="text"
                        value={countResponsiblePersonName}
                        onChange={(event) => setCountResponsiblePersonName(event.target.value)}
                        placeholder="Ad soyad — boş bırakılırsa fişte çizgi"
                        disabled={countReportPrinted}
                      />
                    </label>
                    <div className="stock-ops-dialog__count-table-wrap">
                      <table className="stock-ops-dialog__count-table stock-ops-dialog__count-table--report">
                        <thead>
                          <tr>
                            <th>Ürün</th>
                            <th>Sistem</th>
                            <th>Sayım</th>
                            <th>Fark</th>
                          </tr>
                        </thead>
                        <tbody>
                          {countReportRows.map(({ line, product, diff }) => (
                            <tr key={line.productId} className={diff !== 0 ? 'has-diff' : ''}>
                              <td>
                                <div className="stock-ops-dialog__count-report-product">
                                  <ProductImage product={product!} size="sm" />
                                  <div>
                                    <span className="stock-ops-dialog__count-table-name">{product!.name}</span>
                                    <span className="stock-ops-dialog__count-table-code">
                                      {product!.productCode ?? product!.id}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td>{line.systemStock}</td>
                              <td><strong>{line.scannedQty}</strong></td>
                              <td className={diff > 0 ? 'is-up' : diff < 0 ? 'is-down' : ''}>
                                {diff > 0 ? `+${diff}` : diff}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="stock-ops-dialog__count-report-title">Düzeltme — adet girin</h3>
                    <p className="stock-ops-dialog__count-lead">
                      Her ürün için <strong>yeni stok miktarını</strong> yazın (varsayılan sayım adedi; gerekirse değiştirin).
                      Kalan: <strong>{countPendingApplyRows.length}</strong> ürün.
                      Sorunlu sayımda <strong>Sayımdan çık</strong> ile yarım bırakılan olarak arşivleyip yeni sayım başlatın.
                    </p>
                    {countPendingApplyRows.length === 0 && (
                      <p className="stock-ops-dialog__count-lead">
                        Bekleyen düzeltme yok. Oturumu kapatabilirsiniz.
                      </p>
                    )}
                    <div className="stock-ops-dialog__count-apply-grid">
                      {countPendingApplyRows.map(({ line, product, diff }) => (
                        <div key={line.productId} className="stock-ops-dialog__count-apply-card">
                          <ProductImage product={product!} size="md" />
                          <strong className="stock-ops-dialog__count-apply-name">{product!.name}</strong>
                          <span className="stock-ops-dialog__count-apply-meta">
                            Sistem {line.systemStock} · Sayım {line.scannedQty}
                          </span>
                          <span className={`stock-ops-dialog__count-apply-diff ${diff > 0 ? 'is-up' : 'is-down'}`}>
                            Fark {diff > 0 ? `+${diff}` : diff}
                          </span>
                          <label className="stock-ops-dialog__count-apply-qty">
                            <span>Yeni stok</span>
                            <input
                              type="number"
                              min={0}
                              step={1}
                              inputMode="numeric"
                              value={countApplyQtyDraft[line.productId] ?? String(line.scannedQty)}
                              onChange={(event) => {
                                setCountApplyQtyDraft((prev) => ({
                                  ...prev,
                                  [line.productId]: event.target.value,
                                }));
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            className="btn btn-primary stock-ops-dialog__count-apply-btn"
                            onClick={() => applySingleCountCorrection(line.productId)}
                          >
                            Düzeltmeyi uygula
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <label className="stock-ops-dialog__field">
                  <span>Not (düzeltme kaydı)</span>
                  <input
                    type="text"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={defaultNote('set')}
                    disabled={countPhase !== 'scan' && countReportPrinted}
                  />
                </label>
              </section>
              <aside className="stock-ops-dialog__aside stock-ops-dialog__aside--count">
                <div className="stock-ops-dialog__preview">
                  <div className="stock-ops-dialog__preview-head">
                    <p className="stock-ops-dialog__preview-label">Sayım oturumu</p>
                    <span className="stock-ops-dialog__preview-badge stock-ops-dialog__preview-badge--set">
                      ✎ Sayım
                    </span>
                  </div>
                  <div className="stock-ops-dialog__preview-body">
                    <div className="stock-ops-dialog__preview-row">
                      <span>Okutulan kalem</span>
                      <strong>{countLineList.length}</strong>
                    </div>
                    <div className="stock-ops-dialog__preview-row">
                      <span>Toplam okutma</span>
                      <strong>
                        {countLineList.reduce((sum, line) => sum + line.scannedQty, 0)}
                      </strong>
                    </div>
                    {countPhase !== 'scan' && (
                      <>
                        <div className="stock-ops-dialog__preview-row">
                          <span>Farklı ürün</span>
                          <strong className={countDiscrepancyRows.length ? 'is-down' : ''}>
                            {countDiscrepancyRows.length}
                          </strong>
                        </div>
                        <div className="stock-ops-dialog__preview-row">
                          <span>Rapor</span>
                          <strong>{countReportPrinted ? 'Yazdırıldı' : 'Yazdırılmadı'}</strong>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="stock-ops-dialog__footer">
                  {countPhase === 'scan' ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => {
                          if (countLineList.length > 0 && !window.confirm('Sayım oturumu silinsin mi?')) return;
                          resetCountSession();
                          onClose();
                        }}
                      >
                        İptal
                      </button>
                      {countLineList.length > 0 && (
                        <button
                          type="button"
                          className="btn btn-outline stock-ops-dialog__count-btn-abandon"
                          onClick={(event) => requestAbandonCountSession(event)}
                        >
                          Sayımdan çık
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-outline"
                        disabled={countLineList.length === 0}
                        onClick={() => {
                          if (!window.confirm('Sayım listesi temizlensin mi?')) return;
                          resetCountSession();
                        }}
                      >
                        Oturumu sıfırla
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={countLineList.length === 0}
                        onClick={finishCountSession}
                      >
                        Sayımı bitir
                      </button>
                    </>
                  ) : countPhase === 'report' ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-outline stock-ops-dialog__count-btn-abandon"
                        onClick={(event) => requestAbandonCountSession(event)}
                      >
                        Sayımdan çık
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline"
                        disabled={countPrinting}
                        onClick={() => void handlePrintCountReport()}
                      >
                        {countPrinting ? 'Yazdırılıyor…' : 'Fiş yazdır'}
                      </button>
                      {countDiscrepancyRows.length > 0 ? (
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={!countReportPrinted}
                          onClick={goToCountApplyPhase}
                        >
                          Düzeltmelere geç
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={!countReportPrinted}
                          onClick={finishCountWithoutCorrections}
                        >
                          Sayımı tamamla
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn btn-outline stock-ops-dialog__count-btn-abandon"
                        onClick={(event) => requestAbandonCountSession(event)}
                      >
                        Sayımdan çık
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => setCountPhase('report')}
                      >
                        Rapora dön
                      </button>
                      {countPendingApplyRows.length === 0 && (
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => completeCountSession({ force: true })}
                        >
                          Sayımı tamamla
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => {
                          persistCountReport();
                          onClose();
                        }}
                      >
                        Oturumu kaydet ve kapat
                      </button>
                    </>
                  )}
                </div>
              </aside>
            </>
          ) : (
          <>
          <section className="stock-ops-dialog__main">
            <div className="stock-ops-dialog__search">
              <span className="stock-ops-dialog__search-icon" aria-hidden>🔍</span>
              <input
                type="search"
                placeholder="Ürün ara — ad, kod veya no..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  if (selectedProduct) clearProduct();
                }}
              />
              {selectedProduct && (
                <button type="button" className="stock-ops-dialog__search-clear" onClick={clearProduct}>
                  Temizle
                </button>
              )}
            </div>

            {selectedProduct ? (
              <div className="stock-ops-dialog__selected">
                <div className="stock-ops-dialog__photo-col">
                  <ProductImage
                    product={selectedProduct}
                    size="lg"
                    editable={Boolean(onUploadImage)}
                    onUpload={onUploadImage}
                    onRemove={onRemoveImage}
                  />
                  {onUploadImage && (
                    <div className="stock-ops-dialog__photo-actions">
                      <button
                        type="button"
                        className="stock-ops-dialog__photo-btn"
                        onClick={() => {
                          const input = document.querySelector(
                            '.stock-ops-dialog__selected .image-upload-input',
                          ) as HTMLInputElement | null;
                          input?.click();
                        }}
                      >
                        📷 {isCustomImage(selectedProduct) ? 'Fotoğrafı değiştir' : 'Fotoğraf ekle'}
                      </button>
                      {isCustomImage(selectedProduct) && onRemoveImage && (
                        <button
                          type="button"
                          className="stock-ops-dialog__photo-btn stock-ops-dialog__photo-btn--muted"
                          onClick={() => onRemoveImage(selectedProduct.id)}
                        >
                          Kaldır
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="stock-ops-dialog__selected-info">
                  <div className="stock-ops-dialog__selected-top">
                    {onUpdateProductCategory ? (
                      <label className="stock-ops-dialog__category-field">
                        <span>Kategori</span>
                        <div className="stock-ops-dialog__category-row">
                          <select
                            value={categoryDraft}
                            onChange={(e) => {
                              const next = e.target.value;
                              setCategoryDraft(next);
                              onUpdateProductCategory(selectedProduct.id, next);
                            }}
                          >
                            {categoryOptions.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.icon} {cat.label}
                              </option>
                            ))}
                          </select>
                          {onManageCategories && (
                            <button
                              type="button"
                              className="stock-ops-dialog__category-manage"
                              onClick={onManageCategories}
                            >
                              Düzenle
                            </button>
                          )}
                        </div>
                      </label>
                    ) : (
                      <span className="stock-cat-pill">
                        {getCategoryLabel(selectedProduct.category, settings)}
                      </span>
                    )}
                    {selectedStatus && (
                      <span className={`stock-ops-dialog__status stock-ops-dialog__status--${selectedStatus}`}>
                        {getStockStatusLabel(selectedStatus)}
                      </span>
                    )}
                  </div>
                  <h3>{selectedProduct.name}</h3>
                  <p>
                    {selectedProduct.productCode ? `${selectedProduct.productCode} · ` : ''}
                    No {selectedProduct.id}
                  </p>
                  {onUpdateBarcode && (
                    <label className="stock-ops-dialog__barcode-field">
                      <span>Barkod (okuyucu)</span>
                      <input
                        type="text"
                        value={barcodeDraft}
                        placeholder={selectedProduct.productCode ?? `Stok no ${selectedProduct.id}`}
                        autoComplete="off"
                        spellCheck={false}
                        onChange={(e) => setBarcodeDraft(e.target.value)}
                        onBlur={() => onUpdateBarcode(selectedProduct.id, barcodeDraft)}
                      />
                    </label>
                  )}
                </div>
                <div className="stock-ops-dialog__selected-stock">
                  <span>Mevcut</span>
                  <strong>{selectedProduct.stock}</strong>
                </div>
              </div>
            ) : (
              <div className="stock-ops-dialog__products">
                {searchResults.length === 0 ? (
                  <p className="stock-ops-dialog__empty">Ürün bulunamadı</p>
                ) : (
                  searchResults.map((product) => {
                    const status = getStockStatus(product, lowStockThreshold);
                    return (
                      <button
                        key={product.id}
                        type="button"
                        className="stock-ops-dialog__product"
                        onClick={() => selectProduct(product)}
                      >
                        <ProductImage product={product} size="sm" />
                        <div className="stock-ops-dialog__product-text">
                          <strong>{product.name}</strong>
                          <span>
                            {product.productCode ? `${product.productCode} · ` : ''}No {product.id}
                          </span>
                        </div>
                        <span className={`stock-qty stock-qty--${status}`}>{product.stock}</span>
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {selectedProduct && onUpdatePricing && (
              <fieldset className="stock-ops-dialog__pricing">
                <legend>Fiyatlar (₺)</legend>
                <p className="stock-ops-dialog__pricing-hint">
                  Mevcut ürün ve stok girişinde aynı kayıt güncellenir.
                  {perakendeKdvHaric ? ' Perakende — KDV hariç (kasa ile uyumlu).' : ' Perakende — liste (KDV hariç); kasa KDV dahil.'}
                </p>
                <div className="stock-ops-dialog__pricing-grid">
                  <label className="stock-ops-dialog__field">
                    <span>Alış</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={purchaseDraft}
                      placeholder="0,00"
                      onChange={(e) => setPurchaseDraft(e.target.value)}
                    />
                  </label>
                  <label className="stock-ops-dialog__field">
                    <span>Partner</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={partnerDraft}
                      placeholder="0,00"
                      onChange={(e) => setPartnerDraft(e.target.value)}
                    />
                  </label>
                  <label className="stock-ops-dialog__field">
                    <span>Kupon</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={couponDraft}
                      placeholder="0,00"
                      onChange={(e) => setCouponDraft(e.target.value)}
                    />
                  </label>
                  <label className="stock-ops-dialog__field">
                    <span>{perakendeKdvHaric ? 'Perakende (KDV hariç)' : 'Perakende'}</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={retailDraft}
                      placeholder="0,00"
                      onChange={(e) => setRetailDraft(e.target.value)}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  className="stock-ops-dialog__pricing-save"
                  onClick={() => onPricingSaveResult?.(applyPricingDraft())}
                >
                  Fiyatları kaydet
                </button>
              </fieldset>
            )}

            {operation === 'clear' && selectedProduct && (
              <div className="stock-ops-dialog__alert">
                Bu işlem seçili ürünün stok miktarını <strong>0</strong> yapar.
              </div>
            )}

            {operation !== 'clear' && (
              <div className="stock-ops-dialog__quantity">
                <label className="stock-ops-dialog__field">
                  <span>{quantityLabel}</span>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    placeholder="Örn. 50"
                  />
                </label>
                <div className="stock-ops-dialog__chips" aria-label="Hızlı miktar">
                  {QUICK_AMOUNTS.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      className="stock-ops-dialog__chip"
                      onClick={() => applyQuickAmount(amount)}
                    >
                      {`+${amount}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <label className="stock-ops-dialog__field">
              <span>Not (isteğe bağlı)</span>
              <input
                type="text"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={defaultNote(operation)}
              />
            </label>
          </section>

          <aside className="stock-ops-dialog__aside">
            <div className="stock-ops-dialog__preview">
              <div className="stock-ops-dialog__preview-head">
                <p className="stock-ops-dialog__preview-label">İşlem özeti</p>
                <span className={`stock-ops-dialog__preview-badge stock-ops-dialog__preview-badge--${activeOperation.tone}`}>
                  {activeOperation.icon} {activeOperation.label}
                </span>
              </div>

              {selectedProduct ? (
                <div className="stock-ops-dialog__preview-body">
                  <h4 className="stock-ops-dialog__preview-title" title={selectedProduct.name}>
                    {selectedProduct.name}
                  </h4>

                  <div className="stock-ops-dialog__preview-block">
                    <p className="stock-ops-dialog__preview-block-title">Ürün</p>
                    <div className="stock-ops-dialog__preview-rows">
                      <div className="stock-ops-dialog__preview-row">
                        <span>Kod</span>
                        <strong>{selectedProduct.productCode?.trim() || '—'}</strong>
                      </div>
                      <div className="stock-ops-dialog__preview-row">
                        <span>No</span>
                        <strong>{selectedProduct.id}</strong>
                      </div>
                      <div className="stock-ops-dialog__preview-row">
                        <span>Barkod</span>
                        <strong className="stock-ops-dialog__preview-mono">
                          {barcodeDraft.trim() || selectedProduct.barcode?.trim() || '—'}
                        </strong>
                      </div>
                      <div className="stock-ops-dialog__preview-row">
                        <span>Kategori</span>
                        <strong>{getCategoryLabel(selectedProduct.category, settings)}</strong>
                      </div>
                      {selectedStatus && (
                        <div className="stock-ops-dialog__preview-row">
                          <span>Durum</span>
                          <strong>{getStockStatusLabel(selectedStatus)}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="stock-ops-dialog__preview-block">
                    <p className="stock-ops-dialog__preview-block-title">Stok</p>
                    <div className="stock-ops-dialog__preview-flow">
                      <div>
                        <span>Mevcut</span>
                        <strong>{selectedProduct.stock}</strong>
                      </div>
                      <span className="stock-ops-dialog__preview-arrow" aria-hidden>→</span>
                      <div>
                        <span>Yeni</span>
                        <strong className={previewDelta < 0 ? 'is-down' : previewDelta > 0 ? 'is-up' : ''}>
                          {previewStock ?? selectedProduct.stock}
                        </strong>
                      </div>
                    </div>
                    {operation !== 'clear' && hasValidQty && (
                      <p className="stock-ops-dialog__preview-hint">
                        {operation === 'in' && `+${parsedQty} adet giriş`}
                        {operation === 'out' && `−${parsedQty} adet çıkış`}
                      </p>
                    )}
                    {operation === 'clear' && (
                      <p className="stock-ops-dialog__preview-hint stock-ops-dialog__preview-hint--warn">
                        Stok sıfırlanacak
                      </p>
                    )}
                    {previewDelta !== 0 && (
                      <p className={`stock-ops-dialog__preview-delta ${previewDelta > 0 ? 'is-up' : 'is-down'}`}>
                        Net değişim: {previewDelta > 0 ? '+' : ''}{previewDelta} adet
                      </p>
                    )}
                  </div>

                  {previewPricing && onUpdatePricing && (
                    <div className="stock-ops-dialog__preview-block">
                      <p className="stock-ops-dialog__preview-block-title">
                        Fiyatlar {perakendeKdvHaric ? '(perakende KDV hariç)' : ''}
                      </p>
                      <div className="stock-ops-dialog__preview-rows">
                        <div className="stock-ops-dialog__preview-row">
                          <span>Alış</span>
                          <strong>{formatCurrencyTry(previewPricing.purchase)}</strong>
                        </div>
                        <div className="stock-ops-dialog__preview-row">
                          <span>Partner</span>
                          <strong>{formatCurrencyTry(previewPricing.partner)}</strong>
                        </div>
                        <div className="stock-ops-dialog__preview-row">
                          <span>Kupon</span>
                          <strong>{formatCurrencyTry(previewPricing.coupon)}</strong>
                        </div>
                        <div className="stock-ops-dialog__preview-row stock-ops-dialog__preview-row--accent">
                          <span>Perakende</span>
                          <strong>{formatCurrencyTry(previewPricing.retail)}</strong>
                        </div>
                      </div>
                      {previewStockValue != null && previewStockValue > 0 && (
                        <p className="stock-ops-dialog__preview-hint">
                          Stok değeri (alış × yeni): {formatCurrencyTry(previewStockValue)}
                        </p>
                      )}
                    </div>
                  )}

                  {note.trim() && (
                    <div className="stock-ops-dialog__preview-block">
                      <p className="stock-ops-dialog__preview-block-title">Not</p>
                      <p className="stock-ops-dialog__preview-note">{note.trim()}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="stock-ops-dialog__empty">İşlem için ürün seçin</p>
              )}
            </div>

            <div className="stock-ops-dialog__footer">
              <button type="button" className="btn btn-outline" onClick={onClose}>İptal</button>
              <button
                type="button"
                className={`btn ${operation === 'clear' ? 'btn-danger-soft' : 'btn-primary'}`}
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                {submitLabel}
              </button>
            </div>
          </aside>
          </>
          )}
        </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
