'use client';

import { useState, useEffect } from 'react';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';
export type Orientation = 'portrait' | 'landscape';

export interface DeviceInfo {
  /** Device category based on screen width */
  type: DeviceType;
  /** Whether the device supports touch input */
  isTouch: boolean;
  /** Whether the device is mobile (< 768px) */
  isMobile: boolean;
  /** Whether the device is tablet (768px - 1023px) */
  isTablet: boolean;
  /** Whether the device is desktop (>= 1024px) */
  isDesktop: boolean;
  /** Current screen orientation */
  orientation: Orientation;
  /** Viewport width in px */
  width: number;
  /** Viewport height in px */
  height: number;
  /** Whether we've hydrated (false during SSR) */
  isHydrated: boolean;
}

const SSR_DEFAULT: DeviceInfo = {
  type: 'desktop',
  isTouch: false,
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  orientation: 'landscape',
  width: 1280,
  height: 800,
  isHydrated: false,
};

function getDeviceType(width: number): DeviceType {
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

function getOrientation(width: number, height: number): Orientation {
  return width > height ? 'landscape' : 'portrait';
}

function detectTouch(): boolean {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

function measure(): DeviceInfo {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const type = getDeviceType(width);
  return {
    type,
    isTouch: detectTouch(),
    isMobile: type === 'mobile',
    isTablet: type === 'tablet',
    isDesktop: type === 'desktop',
    orientation: getOrientation(width, height),
    width,
    height,
    isHydrated: true,
  };
}

/**
 * Comprehensive device detection hook.
 * SSR-safe: assumes desktop during SSR, hydrates on mount.
 * Tracks viewport changes via resize observer.
 */
export function useDeviceDetect(): DeviceInfo {
  const [info, setInfo] = useState<DeviceInfo>(SSR_DEFAULT);

  useEffect(() => {
    let rafId: number;
    function onResize() {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => setInfo(measure()));
    }

    // Initial measurement
    onResize();

    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', onResize, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  return info;
}
