import { useCallback } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

/**
 * Returns a pointer-down handler that vertically resizes a bottom panel.
 * Dragging the divider upward increases `height`.
 */
export function usePanelResize(height: number, setHeight: (h: number) => void) {
  return useCallback(
    (e: ReactPointerEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = height;

      const onMove = (ev: PointerEvent) => {
        setHeight(startHeight + (startY - ev.clientY));
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'row-resize';
    },
    [height, setHeight],
  );
}

/**
 * Returns a pointer-down handler that horizontally resizes a left panel.
 * Dragging the divider to the right increases `width`.
 */
export function useHorizontalResize(width: number, setWidth: (w: number) => void) {
  return useCallback(
    (e: ReactPointerEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = width;

      const onMove = (ev: PointerEvent) => {
        setWidth(startWidth + (ev.clientX - startX));
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    },
    [width, setWidth],
  );
}
