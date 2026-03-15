'use client';

import { useEffect, useEffectEvent, useState } from 'react';

type MarketState = 'pre' | 'open' | 'post' | 'closed';

function getEasternNow() {
  return new Date(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date()),
  );
}

function getMarketState(date: Date): MarketState {
  const day = date.getDay();
  const minutes = date.getHours() * 60 + date.getMinutes();

  if (day === 0 || day === 6) {
    return 'closed';
  }
  if (minutes >= 240 && minutes < 570) {
    return 'pre';
  }
  if (minutes >= 570 && minutes < 960) {
    return 'open';
  }
  if (minutes >= 960 && minutes < 1200) {
    return 'post';
  }
  return 'closed';
}

function formatClock(date: Date) {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export function MarketPulse() {
  const [clock, setClock] = useState('');
  const [state, setState] = useState<MarketState>('closed');

  const tick = useEffectEvent(() => {
    const eastern = getEasternNow();
    setClock(formatClock(eastern));
    setState(getMarketState(eastern));
  });

  useEffect(() => {
    tick();
    const intervalId = window.setInterval(() => {
      tick();
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="pulse-card">
      <div className={`pulse-dot pulse-${state}`} />
      <div>
        <div className="pulse-label">Market state</div>
        <div className="pulse-value">
          {state.toUpperCase()} / {clock} ET
        </div>
      </div>
    </div>
  );
}
