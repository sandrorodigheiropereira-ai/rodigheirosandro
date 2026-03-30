import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FinancialRecord } from '@/types/financial';

interface SheetResponse {
  data: FinancialRecord[];
  regionais: string[];
  unidades: string[];
}

async function fetchSheetData(): Promise<SheetResponse> {
  const { data, error } = await supabase.functions.invoke('fetch-sheets');
  if (error) throw new Error(error.message);
  return data as SheetResponse;
}

export function useSheetData() {
  return useQuery({
    queryKey: ['sheet-data'],
    queryFn: fetchSheetData,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // auto-refresh every 5 min
  });
}

export function getRegionaisFromData(data: FinancialRecord[]): string[] {
  return [...new Set(data.map(r => r.regional))].filter(Boolean).sort();
}

export function getUnidadesFromData(data: FinancialRecord[], regional?: string): string[] {
  const filtered = regional ? data.filter(r => r.regional === regional) : data;
  return [...new Set(filtered.map(r => r.unidade))].filter(Boolean).sort();
}
