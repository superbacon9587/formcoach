import type { CheckStatus } from '../shared/contracts';
import { RULES } from './rules';

export function createAlignmentCheck() {
  let status: CheckStatus = 'unknown';
  let pending: 'pass' | 'fail' | null = null, since = 0;
  function reset() { status = 'unknown'; pending = null; since = 0; }
  return { reset,
    update(deviation: number | null, timestamp: number): CheckStatus {
      if (deviation === null) { reset(); return status; }
      const next = deviation > RULES.alignmentFail ? 'fail' : deviation < RULES.alignmentRecover ? 'pass' : null;
      if (next === null || next === status) { pending = null; return status; }
      if (pending !== next) { pending = next; since = timestamp; }
      const duration = next === 'pass' && status === 'fail' ? RULES.alignmentRecoveryMs : RULES.alignmentEvidenceMs;
      if (timestamp - since >= duration) { status = next; pending = null; }
      return status;
    }
  };
}
