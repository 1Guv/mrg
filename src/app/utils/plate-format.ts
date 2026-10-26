import { currentPattern } from '../regex-plate-patterns/current';
import { prefixPattern } from '../regex-plate-patterns/prefix';
import { suffixPattern } from '../regex-plate-patterns/suffix';
import { datelessPattern } from '../regex-plate-patterns/dateless';

export type PlateFormat = 'current' | 'prefix' | 'suffix' | 'dateless';

export interface PlateFormatInfo {
  label: string;
  summary: string;
  vehicleRule: string;
}

/**
 * Plate format worked out from the characters. Listings' own plateType field
 * says "Current" for almost every plate whatever its format, so it can't be
 * relied on. Null when the characters match no DVLA format.
 */
export function plateFormat(plateCharacters: string): PlateFormat | null {
  const plate = plateCharacters.replace(/\s/g, '');
  if (currentPattern.test(plate)) return 'current';
  if (prefixPattern.test(plate)) return 'prefix';
  if (suffixPattern.test(plate)) return 'suffix';
  if (datelessPattern.test(plate)) return 'dateless';
  return null;
}

export const PLATE_FORMAT_INFO: Record<PlateFormat, PlateFormatInfo> = {
  current: {
    label: 'Current-style plate',
    summary: 'Current-style registrations have been issued since September 2001: two letters for the area, two numbers for the age identifier, then three letters, as in AB12 CDE.',
    vehicleRule: 'The age identifier means it can only go on a vehicle first registered on or after the date it represents, because a plate can never make a vehicle look newer than it is.',
  },
  prefix: {
    label: 'Prefix plate',
    summary: 'Prefix registrations were issued from 1983 to 2001. The letter at the start shows the year of issue, followed by up to three numbers and three letters, as in A123 BCD.',
    vehicleRule: 'The year letter means it can only go on a vehicle first registered in or after that year, because a plate can never make a vehicle look newer than it is.',
  },
  suffix: {
    label: 'Suffix plate',
    summary: 'Suffix registrations were issued from 1963 to 1983: three letters and up to three numbers, with the year letter at the end, as in ABC 123D.',
    vehicleRule: 'The year letter means it can only go on a vehicle first registered in or after that year, because a plate can never make a vehicle look newer than it is.',
  },
  dateless: {
    label: 'Dateless plate',
    summary: 'Dateless registrations are the oldest UK format, made of up to four numbers and up to three letters with no year identifier, as in 1 AB or ABC 123.',
    vehicleRule: 'With no year identifier, it can go on a vehicle of any age, which is a big part of why dateless plates are so sought after.',
  },
};
