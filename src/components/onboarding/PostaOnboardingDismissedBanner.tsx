import { useCallback, useEffect, useState } from 'react';
import { fetchPostaOnboardingHub, patchPostaOnboarding } from '../../services/postaOnboardingService';
import { signalPostaOnboardingOpen } from '../../storage/postaOnboardingSession';

export function PostaOnboardingDismissedBanner() {
  const [visible, setVisible] = useState(false);

  const refresh = useCallback(async () => {
    const hub = await fetchPostaOnboardingHub();
    if (!hub) {
      setVisible(false);
      return;
    }
    setVisible(hub.onboarding.status === 'dismissed');
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!visible) return null;

  return (
    <div className="posta-onboarding-dismissed-banner" role="status">
      <p>
        Posta kurulumunu daha önce kapattınız. İşletme e-postası ve mesajlaşma anahtarı için kurulumu sürdürebilirsiniz.
      </p>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => {
          void patchPostaOnboarding({ status: 'in_progress' }).then(() => {
            signalPostaOnboardingOpen();
            setVisible(false);
          });
        }}
      >
        Kurulumu sürdür
      </button>
      <button type="button" className="btn btn-text btn-sm" onClick={() => setVisible(false)}>
        Gizle
      </button>
    </div>
  );
}
