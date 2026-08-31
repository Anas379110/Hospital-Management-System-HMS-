import createCache from '@emotion/cache';
import { prefixer } from 'stylis';
import rtlPlugin from 'stylis-plugin-rtl';
import type { StylisPlugin } from '@emotion/cache';
import { createTheme } from '@mui/material/styles';

/**
 * راجع UI-UX.md §10 و TECH-STACK.md — MUI يدعم RTL/LTR رسمياً.
 * نحتاج Emotion Cache منفصل لكل اتجاه لأن stylis-plugin-rtl يعالج CSS مسبقاً.
 * ملاحظة: مكتبة `stylis` بلا تصريحات TypeScript رسمية (راجع src/types/stylis.d.ts) —
 * التحويل هنا (as StylisPlugin) استثناء ضيق ومبرَّر لحدود مكتبة خارجية غير مكتوبة بـ TS،
 * وليس تراخياً عاماً في قواعد "لا any" المتبعة بالمشروع.
 */
export function createDirectionalCache(direction: 'rtl' | 'ltr') {
  return createCache({
    key: direction === 'rtl' ? 'muirtl' : 'muiltr',
    stylisPlugins:
      direction === 'rtl'
        ? [prefixer as unknown as StylisPlugin, rtlPlugin as unknown as StylisPlugin]
        : [prefixer as unknown as StylisPlugin],
  });
}

export function createAppTheme(direction: 'rtl' | 'ltr') {
  return createTheme({
    direction,
    typography: {
      fontFamily:
        direction === 'rtl'
          ? '"Cairo", "Tajawal", "Roboto", sans-serif'
          : '"Inter", "Roboto", sans-serif',
    },
    palette: {
      primary: { main: '#0f5c8f' },
      success: { main: '#2e7d32' }, // متاح
      error: { main: '#c62828' }, // مشغول/خطر
      warning: { main: '#ed6c02' }, // تنبيه/صيانة
    },
  });
}
