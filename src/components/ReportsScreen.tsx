import type { Store } from '../store/useStore';
import { AccountingScreen, type ReportsSubTab } from './AccountingScreen';

export type ReportsMenuSubTab = ReportsSubTab;

interface ReportsScreenProps {
  store: Store;
  initialReportsSubTab?: ReportsMenuSubTab;
}

/** Üst menü Raporlar — sol menü (Gelir / İşlemler / Müşteri raporları) */
export function ReportsScreen({ store, initialReportsSubTab }: ReportsScreenProps) {
  return (
    <AccountingScreen
      store={store}
      reportsOnly
      initialReportsSubTab={initialReportsSubTab}
    />
  );
}
