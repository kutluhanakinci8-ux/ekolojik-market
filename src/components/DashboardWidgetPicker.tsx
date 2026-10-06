import type { Store } from '../store/useStore';
import {
  DASHBOARD_WIDGET_OPTIONS,
  type DashboardWidgetId,
} from '../types/dashboard';

interface DashboardWidgetPickerProps {
  store: Store;
  isAdmin: boolean;
}

export function DashboardWidgetPicker({ store, isAdmin }: DashboardWidgetPickerProps) {
  const widgets = store.settings.dashboardWidgets;
  const options = DASHBOARD_WIDGET_OPTIONS.filter((item) => !item.adminOnly || isAdmin);

  const toggle = (id: DashboardWidgetId) => {
    store.updateDashboardWidgets({ [id]: !widgets[id] });
  };

  return (
    <div className="dashboard-widget-picker" aria-label="Panel kartları">
      <span className="dashboard-widget-picker-label">Kartlar</span>
      <div className="dashboard-widget-picker-list">
        {options.map((option) => {
          const active = widgets[option.id];
          return (
            <button
              key={option.id}
              type="button"
              className={`dashboard-widget-chip ${active ? 'is-active' : ''}`}
              onClick={() => toggle(option.id)}
              aria-pressed={active}
              title={option.label}
            >
              <span className="dashboard-widget-chip-check" aria-hidden>{active ? '✓' : ''}</span>
              {option.shortLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}
