import type { Store } from '../store/useStore';
import { AccountingScreen, type ReportsSubTab } from './AccountingScreen';

export type ReportsMenuSubTab = ReportsSubTab;

interface ReportsScreenProps {
  store: Store;
  initialReportsSubTab?: ReportsMenuSubTab;
  /** Kasiyer: yalnızca İşlemler raporu — sol menüde tek seçenek */
  transactionsOnlyMenu?: boolean;
}

/** Üst menü Raporlar — sol menü (Gelir / İşlemler / Müşteri raporları) */
export function ReportsScreen({
  store,
  initialReportsSubTab,
  transactionsOnlyMenu = false,
}: ReportsScreenProps) {
  return (
    <AccountingScreen
      store={store}
      reportsOnly
      initialReportsSubTab={initialReportsSubTab}
      transactionsOnlyMenu={transactionsOnlyMenu}
    />
  );
}
