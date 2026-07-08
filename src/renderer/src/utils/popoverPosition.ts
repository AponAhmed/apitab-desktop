export interface PopoverPosition {
  x: number;
  y: number;
}

/**
 * Positions a fixed-position popover relative to its anchor, clamped to the
 * viewport on both axes and flipped above the anchor when there isn't
 * enough room below — otherwise a popover opened near the bottom of the
 * screen (e.g. a "rows per page" select near the bottom of a panel) renders
 * partly or fully off-screen with no way to reach its options.
 */
export function computePopoverPosition(
  anchor: DOMRect,
  size: { width: number; height: number },
  gap = 4,
): PopoverPosition {
  const spaceBelow = window.innerHeight - anchor.bottom;
  const spaceAbove = anchor.top;
  const openAbove = spaceBelow < size.height + gap && spaceAbove > spaceBelow;

  const y = openAbove
    ? Math.max(8, anchor.top - size.height - gap)
    : Math.min(anchor.bottom + gap, Math.max(8, window.innerHeight - size.height - 8));
  const x = Math.max(8, Math.min(anchor.left, window.innerWidth - size.width - 8));

  return { x, y };
}
