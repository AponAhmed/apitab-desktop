import { useCallback, useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';

export interface PanelPosition {
  x: number;
  y: number;
}

interface BaseRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Clamps a translate offset so `baseRect` (the panel's un-translated
 * position/size) plus that offset keeps the whole panel within the
 * viewport — not just some minimum sliver of it. A partial-visibility
 * clamp (e.g. "keep 40px of the top edge reachable") sounds sufficient but
 * isn't: this panel's collapsed list view has its interactive row content
 * (the Dismiss button) *below* the header, so guaranteeing only the header
 * stayed visible still let real buttons end up off-screen. Full containment
 * is safe here because the panel is always small relative to the window
 * (bounded width, height capped at 70vh) — it always fits. If it somehow
 * didn't (a tiny window), this falls back to pinning the top-left corner.
 */
function clampOffset(offset: PanelPosition, baseRect: BaseRect): PanelPosition {
  const newLeft = baseRect.left + offset.x;
  const newTop = baseRect.top + offset.y;
  const maxLeft = Math.max(0, window.innerWidth - baseRect.width);
  const maxTop = Math.max(0, window.innerHeight - baseRect.height);
  const clampedLeft = Math.min(Math.max(newLeft, 0), maxLeft);
  const clampedTop = Math.min(Math.max(newTop, 0), maxTop);
  return { x: clampedLeft - baseRect.left, y: clampedTop - baseRect.top };
}

/**
 * Free 2D dragging for a panel whose base position is set in CSS (e.g.
 * `fixed bottom-4 left-4`) — this hook only ever adds a `transform:
 * translate(x, y)` offset on top of that anchor. Generalizes the exact
 * pointer-event technique already used by usePanelResize.ts (pointerdown ->
 * window pointermove/pointerup listeners -> toggle body userSelect/cursor)
 * to two axes, plus viewport clamping so the panel can't be dragged fully
 * off-screen.
 */
export function useDraggablePanel() {
  // A plain useRef's mount-time effect would miss this element entirely:
  // StressTestPanel renders null until a run exists, so a `useEffect(fn, [])`
  // checking `panelRef.current` would fire once while it's still null and
  // never re-run once the panel actually appears. A callback ref turns
  // "the DOM node" into state, so effects can depend on it and correctly
  // (re-)run whenever the node mounts, unmounts, or is swapped.
  const [panelEl, setPanelEl] = useState<HTMLDivElement | null>(null);
  const panelRef = useCallback((node: HTMLDivElement | null) => setPanelEl(node), []);
  const [position, setPosition] = useState<PanelPosition>({ x: 0, y: 0 });

  // A position clamped for one size (e.g. the tall run-detail view) can put
  // a differently-sized render (e.g. the short collapsed run list, after
  // switching views) partly below the viewport — re-clamp whenever the
  // panel's rendered size changes, not just at drag time. getBoundingClientRect()
  // already reflects the current translate, so the un-translated "base" rect
  // is derived by subtracting the current offset before re-clamping.
  useEffect(() => {
    if (!panelEl) return;
    const observer = new ResizeObserver(() => {
      setPosition((prev) => {
        const rect = panelEl.getBoundingClientRect();
        const baseRect: BaseRect = {
          top: rect.top - prev.y,
          left: rect.left - prev.x,
          width: rect.width,
          height: rect.height,
        };
        return clampOffset(prev, baseRect);
      });
    });
    observer.observe(panelEl);
    return () => observer.disconnect();
  }, [panelEl]);

  const onDragHandlePointerDown = useCallback(
    (e: ReactPointerEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const startPos = position;
      const rect = panelEl?.getBoundingClientRect() ?? null;
      const baseRect: BaseRect | null = rect
        ? { top: rect.top - startPos.y, left: rect.left - startPos.x, width: rect.width, height: rect.height }
        : null;

      const onMove = (ev: PointerEvent) => {
        const rawOffset = { x: startPos.x + (ev.clientX - startX), y: startPos.y + (ev.clientY - startY) };
        setPosition(baseRect ? clampOffset(rawOffset, baseRect) : rawOffset);
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
      document.body.style.cursor = 'move';
    },
    [position, panelEl],
  );

  return { panelRef, position, onDragHandlePointerDown };
}
