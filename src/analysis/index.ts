import type { Analyzer, SessionView } from '../shared/contracts';
import { emptyView } from '../shared/defaults';
/** B replaces this honest no-op with the measured pushup analyzer. */
export function createAnalyzer(): Analyzer {
  let view: SessionView = emptyView();
  return {
    update() { return view; },
    finish() { return view; },
    reset() { view = emptyView(); }
  };
}
