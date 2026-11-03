import { NumberPlateType } from '../models/reg.model';
import { currentPattern } from './current';
import { datelessPattern } from './dateless';
import { prefixPattern } from './prefix';
import { suffixPattern } from './suffix';

export interface DetectedPlate {
  type: NumberPlateType;
  registration: string;
}

/**
 * Works out a plate's type from the reg alone, for entry points that only ask
 * for the reg (article boxes, ?plate= links). The four patterns don't overlap.
 * Spaces are dropped, except for dateless plates, which keep one.
 */
export function detectPlateType(input: string): DetectedPlate | null {
  const raw = (input ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
  const compact = raw.replace(/\s/g, '');
  if (!compact) return null;

  if (currentPattern.test(compact)) return { type: NumberPlateType.Current, registration: compact };
  if (prefixPattern.test(compact)) return { type: NumberPlateType.Prefix, registration: compact };
  if (suffixPattern.test(compact)) return { type: NumberPlateType.Suffix, registration: compact };
  if (datelessPattern.test(raw)) return { type: NumberPlateType.Dateless, registration: raw };
  if (datelessPattern.test(compact)) return { type: NumberPlateType.Dateless, registration: compact };
  return null;
}
