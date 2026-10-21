/*global chrome*/
import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'navigationTimerStartedAt';

function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = String(Math.floor(total / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const seconds = String(total % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

const NavigationTimer = ({ enabled }) => {
  const [label, setLabel] = useState('00:00:00');

  useEffect(() => {
    let startedAt = 0;
    let intervalId = 0;

    const paint = () => {
      if (!enabled || !startedAt) {
        setLabel('00:00:00');
        return;
      }
      setLabel(formatElapsed(Date.now() - startedAt));
    };

    const loadStart = () => {
      if (!enabled) {
        startedAt = 0;
        setLabel('00:00:00');
        return;
      }
      chrome.storage.local.get(STORAGE_KEY, (result) => {
        startedAt = result[STORAGE_KEY] || Date.now();
        if (!result[STORAGE_KEY]) {
          chrome.storage.local.set({ [STORAGE_KEY]: startedAt });
        }
        paint();
      });
    };

    const onChanged = (changes, areaName) => {
      if (areaName !== 'local' || !changes[STORAGE_KEY]) return;
      startedAt = changes[STORAGE_KEY].newValue || 0;
      paint();
    };

    loadStart();
    intervalId = setInterval(paint, 250);
    chrome.storage.onChanged.addListener(onChanged);

    return () => {
      clearInterval(intervalId);
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, [enabled]);

  return (
    <div
      className={`navigation-timer${enabled ? '' : ' is-off'}`}
      role="timer"
      aria-label="Tempo de navegação"
      aria-live="off">
      {label}
    </div>
  );
};

export default NavigationTimer;
