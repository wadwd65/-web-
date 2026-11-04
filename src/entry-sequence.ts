/** Visible-time phases. Loading and an idle welcome screen never consume the sequence. */
export const ENTRY_TIMING = {
  mark: 900,
  reveal: 2700,
  open: 3100,
  fade: 4450,
  complete: 4900,
};

export function createEntrySequence(reduced = false) {
  let requested = false;
  let elapsed = 0;
  let completed = false;

  function state() {
    let phase = 0;
    if (requested) phase = 1;
    if (elapsed >= ENTRY_TIMING.mark) phase = 2;
    if (elapsed >= ENTRY_TIMING.open) phase = 3;
    if (completed || elapsed >= ENTRY_TIMING.fade) phase = 4;
    return {
      requested, elapsed, completed, phase,
      reveal: requested && (reduced || elapsed >= ENTRY_TIMING.reveal),
    };
  }

  return {
    state,
    start() {
      requested = true;
      return state();
    },
    advance(delta: number, ready: boolean, visible = true) {
      if (!requested || !ready || !visible || completed) return state();
      elapsed += Math.max(0, Math.min(Number.isFinite(delta) ? delta : 0, 250));
      if (reduced || elapsed >= ENTRY_TIMING.complete) completed = true;
      return state();
    },
    skip() {
      requested = true;
      completed = true;
      return state();
    },
  };
}
