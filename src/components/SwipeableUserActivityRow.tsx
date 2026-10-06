import { useRef, useState } from 'react';
import type { UserSessionSummary } from '../utils/userUsageStats';
import { formatDateTime } from '../utils/format';
import { formatDuration } from '../utils/userUsageStats';

const SWIPE_WIDTH = 280;

interface SwipeableUserActivityRowProps {
  user: UserSessionSummary;
  isPrimary: boolean;
  canManage: boolean;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onEdit: () => void;
  onToggleLock: () => void;
  onDelete: () => void;
  onLoginRecord: () => void;
}

export function SwipeableUserActivityRow({
  user,
  isPrimary,
  canManage,
  isOpen,
  onOpen,
  onClose,
  onEdit,
  onToggleLock,
  onDelete,
  onLoginRecord,
}: SwipeableUserActivityRowProps) {
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragBase = useRef(0);
  const liveOffset = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const showActions = canManage && !isPrimary;
  const offset = isDragging ? dragOffset : (isOpen ? SWIPE_WIDTH : 0);

  const finishDrag = (nextOffset: number) => {
    setIsDragging(false);
    setDragOffset(0);
    if (nextOffset > SWIPE_WIDTH * 0.35) {
      onOpen();
    } else {
      onClose();
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!showActions) return;
    setIsDragging(true);
    dragStartX.current = event.clientX;
    dragBase.current = isOpen ? SWIPE_WIDTH : 0;
    panelRef.current?.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const delta = dragStartX.current - event.clientX;
    const next = Math.min(SWIPE_WIDTH, Math.max(0, dragBase.current + delta));
    liveOffset.current = next;
    setDragOffset(next);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    panelRef.current?.releasePointerCapture(event.pointerId);
    finishDrag(liveOffset.current);
  };

  const handlePointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    panelRef.current?.releasePointerCapture(event.pointerId);
    finishDrag(liveOffset.current);
  };

  return (
    <div className={`user-activity-swipe ${user.isOnline ? 'is-online' : ''} ${isOpen ? 'is-open' : ''}`}>
      {showActions && (
        <div className="user-activity-swipe-actions" aria-hidden={!isOpen}>
          <button
            type="button"
            className="user-activity-action user-activity-action--edit"
            onClick={(event) => { event.stopPropagation(); onEdit(); }}
          >
            Düzenle
          </button>
          <button
            type="button"
            className={`user-activity-action user-activity-action--lock ${user.isActive ? '' : 'is-unlock'}`}
            onClick={(event) => { event.stopPropagation(); onToggleLock(); }}
          >
            {user.isActive ? 'Kilitle' : 'Kilidi Aç'}
          </button>
          <button
            type="button"
            className="user-activity-action user-activity-action--delete"
            onClick={(event) => { event.stopPropagation(); onDelete(); }}
          >
            Sil
          </button>
          <button
            type="button"
            className="user-activity-action user-activity-action--log"
            onClick={(event) => { event.stopPropagation(); onLoginRecord(); }}
          >
            Giriş Kaydı
          </button>
        </div>
      )}

      <div
        ref={panelRef}
        className={`user-activity-swipe-panel ${isDragging ? 'is-dragging' : ''}`}
        style={{ transform: `translateX(-${offset}px)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div className="user-activity-swipe-cells">
          <div className="user-activity-cell user-activity-cell--name">
            <strong>{user.displayName}</strong>
            <span className="dashboard-user-usage-username">@{user.username}</span>
          </div>
          <div className="user-activity-cell">
            <span className={`dashboard-user-usage-pill ${user.isActive ? 'is-active' : 'is-passive'}`}>
              {user.isActive ? 'Aktif' : 'Kilitli'}
            </span>
          </div>
          <div className="user-activity-cell">
            <span className={`dashboard-user-usage-pill ${user.totpEnabled ? 'is-2fa-on' : 'is-2fa-off'}`}>
              {user.totpEnabled ? 'Aktif' : 'Kapalı'}
            </span>
          </div>
          <div className="user-activity-cell">
            {user.isOnline ? (
              <span className="dashboard-user-usage-pill is-online">Oturumda</span>
            ) : (
              <span className="dashboard-user-usage-muted">Çıkış</span>
            )}
          </div>
          <div className="user-activity-cell">{user.sessionCount}</div>
          <div className="user-activity-cell">{formatDuration(user.todayDurationMs)}</div>
          <div className="user-activity-cell">{formatDuration(user.totalDurationMs)}</div>
          <div className="user-activity-cell user-activity-cell--last">
            <span>{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : '—'}</span>
            {showActions && (
              <span className="user-activity-swipe-hint" aria-hidden>‹</span>
            )}
            {isPrimary && (
              <span className="dashboard-user-usage-muted user-activity-primary-tag">Ana yönetici</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
