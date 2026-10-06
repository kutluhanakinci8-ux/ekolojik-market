import { useEffect, useMemo, useState } from 'react';

const DIAL_RADIUS = 88;
const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_RADIUS;

function formatClockParts(date: Date) {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');

  const dateLine = date.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const weekday = date.toLocaleDateString('tr-TR', { weekday: 'long' });

  return { hours, minutes, seconds, dateLine, weekday };
}

interface CartIdleClockProps {
  businessName: string;
}

export function CartIdleClock({ businessName }: CartIdleClockProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const { hours, minutes, seconds, dateLine, weekday } = formatClockParts(now);
  const secondValue = now.getSeconds();
  const minuteValue = now.getMinutes();
  const secondProgress = secondValue / 60;
  const minuteProgress = (minuteValue + secondValue / 60) / 60;

  const rings = useMemo(() => ({
    secondOffset: DIAL_CIRCUMFERENCE * (1 - secondProgress),
    minuteOffset: DIAL_CIRCUMFERENCE * (1 - minuteProgress),
  }), [secondProgress, minuteProgress]);

  const ariaTime = `${hours}:${minutes}:${seconds}`;

  return (
    <div className="cart-idle-clock" aria-live="polite" aria-label={`Saat ${ariaTime}`}>
      <div className="cart-idle-clock-ambient" aria-hidden>
        <span className="cart-idle-clock-glow" />
        <span className="cart-idle-clock-orbit cart-idle-clock-orbit--a" />
        <span className="cart-idle-clock-orbit cart-idle-clock-orbit--b" />
      </div>

      <div className="cart-idle-clock-inner">
        <div className="cart-idle-clock-brand">
          <span className="cart-idle-clock-live" aria-hidden />
          <span>{businessName}</span>
        </div>

        <div className="cart-idle-clock-dateblock">
          <span className="cart-idle-clock-weekday">{weekday}</span>
          <span className="cart-idle-clock-date">{dateLine}</span>
        </div>

        <div className="cart-idle-clock-stage">
          <svg className="cart-idle-clock-dial" viewBox="0 0 200 200" aria-hidden>
            <defs>
              <linearGradient id="cartClockMinuteGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(81, 184, 72, 0.35)" />
                <stop offset="100%" stopColor="rgba(45, 106, 79, 0.12)" />
              </linearGradient>
              <linearGradient id="cartClockSecondGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#7dd56f" />
                <stop offset="50%" stopColor="#51b848" />
                <stop offset="100%" stopColor="#2d6b28" />
              </linearGradient>
            </defs>

            {Array.from({ length: 60 }).map((_, index) => {
              const angle = (index / 60) * Math.PI * 2 - Math.PI / 2;
              const outer = index % 5 === 0 ? 94 : 91;
              const inner = index % 5 === 0 ? 84 : 87;
              const x1 = 100 + Math.cos(angle) * inner;
              const y1 = 100 + Math.sin(angle) * inner;
              const x2 = 100 + Math.cos(angle) * outer;
              const y2 = 100 + Math.sin(angle) * outer;
              return (
                <line
                  key={index}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  className={index % 5 === 0 ? 'cart-idle-clock-tick cart-idle-clock-tick--major' : 'cart-idle-clock-tick'}
                />
              );
            })}

            <circle
              className="cart-idle-clock-track"
              cx="100"
              cy="100"
              r={DIAL_RADIUS}
              fill="none"
            />
            <circle
              className="cart-idle-clock-progress cart-idle-clock-progress--minute"
              cx="100"
              cy="100"
              r={DIAL_RADIUS}
              fill="none"
              stroke="url(#cartClockMinuteGrad)"
              strokeDasharray={DIAL_CIRCUMFERENCE}
              strokeDashoffset={rings.minuteOffset}
              transform="rotate(-90 100 100)"
            />
            <circle
              className="cart-idle-clock-progress cart-idle-clock-progress--second"
              cx="100"
              cy="100"
              r={DIAL_RADIUS - 10}
              fill="none"
              stroke="url(#cartClockSecondGrad)"
              strokeDasharray={DIAL_CIRCUMFERENCE - 62.8}
              strokeDashoffset={(DIAL_CIRCUMFERENCE - 62.8) * (1 - secondProgress)}
              transform="rotate(-90 100 100)"
            />
          </svg>

          <div className="cart-idle-clock-face">
            <div className="cart-idle-clock-time" key={`${hours}${minutes}`}>
              <span className="cart-idle-clock-digit">{hours}</span>
              <span className="cart-idle-clock-colon" aria-hidden>
                <i />
                <i />
              </span>
              <span className="cart-idle-clock-digit">{minutes}</span>
            </div>
            <div className="cart-idle-clock-seconds-wrap">
              <span className="cart-idle-clock-seconds" key={seconds}>{seconds}</span>
              <span className="cart-idle-clock-seconds-label">saniye</span>
            </div>
          </div>
        </div>

        <div className="cart-idle-clock-footer">
          <span className="cart-idle-clock-chip">Satış modu</span>
          <p className="cart-idle-clock-hint">Ürün eklediğinizde sepet burada görünür</p>
        </div>
      </div>
    </div>
  );
}
