// Administrative units that are excluded from operational dashboards
export const ADM_UNITS = ['ADM/TO', 'ADM/GO', 'ADM/PR', 'ADM/ES'];

export function isAdmUnit(unidade: string): boolean {
  return ADM_UNITS.includes(unidade.toUpperCase());
}

export function filterOutAdm<T extends { unidade: string }>(records: T[]): T[] {
  return records.filter(r => !isAdmUnit(r.unidade));
}

export function filterOnlyAdm<T extends { unidade: string }>(records: T[]): T[] {
  return records.filter(r => isAdmUnit(r.unidade));
}
