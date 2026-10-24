import type { SourceOptions, StopSource } from '../shared/contracts';
/** A replaces this boundary. No fabricated inference in camera mode. */
export async function startCameraSource(_options: SourceOptions): Promise<StopSource> {
  throw new Error('Camera adapter is not implemented yet. Use Mock preview while A builds tracking.');
}
