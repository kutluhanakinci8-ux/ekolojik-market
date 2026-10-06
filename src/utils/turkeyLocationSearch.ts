/** @deprecated Türkiye — `structuredAddressLocation` kullanın */
import {
  formatStructuredLocationInput,
  getDistrictInlineCompletion,
  getDistrictsForStructuredRegion,
  getRegionInlineCompletion,
  isTurkeyCountryName,
  resolveStructuredDistrict,
  resolveStructuredRegion,
  type LocationInlineCompletion,
} from './structuredAddressLocation';

export const TURKEY_PROVINCE_DISTRICTS = {} as Record<string, string[]>;
export const TURKEY_PROVINCE_NAMES: string[] = [];

const TR = 'TR' as const;

export type TurkeyLocationInlineCompletion = LocationInlineCompletion;

export function formatTurkeyLocationInput(value: string): string {
  return formatStructuredLocationInput(value, TR);
}

export function displayTurkeyLocationName(canonical: string): string {
  return formatStructuredLocationInput(canonical, TR);
}

export { isTurkeyCountryName };

export function getTurkeyProvinceInlineCompletion(query: string) {
  return getRegionInlineCompletion(query, TR);
}

export function resolveTurkeyProvince(name: string) {
  return resolveStructuredRegion(name, TR);
}

export function getDistrictsForTurkeyProvince(provinceName: string) {
  return getDistrictsForStructuredRegion(provinceName, TR);
}

export function getTurkeyDistrictInlineCompletion(query: string, provinceName: string) {
  return getDistrictInlineCompletion(query, provinceName, TR);
}

export function resolveTurkeyDistrict(provinceName: string, districtName: string) {
  return resolveStructuredDistrict(provinceName, districtName, TR);
}
