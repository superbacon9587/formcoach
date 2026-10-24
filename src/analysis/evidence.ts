import type { CheckStatus } from '../shared/contracts';
import { FRONT_RULES as RULES } from './front-view-rules';
/** Time hysteresis: disconnected samples cannot become a continuous fault. */
export function createEvidenceGate() {
  let status: CheckStatus = 'unknown';
  let pending: 'pass' | 'fail' | null = null;
  let since = 0;
  return {
    reset() { status = 'unknown'; pending = null; since = 0; },
    update(error: number, timestamp: number): CheckStatus {
      const candidate = error > RULES.failDistance ? 'fail' : error < RULES.passDistance ? 'pass' : null;
      if (!candidate) { pending = null; return status; }
      if (candidate === status) { pending = null; return status; }
      if (candidate !== pending) { pending = candidate; since = timestamp; }
      const wait = candidate === 'pass' && status === 'fail' ? RULES.recoveryMs : RULES.evidenceMs;
      if (timestamp - since >= wait) { status = candidate; pending = null; }
      return status;
    }
  };
}
