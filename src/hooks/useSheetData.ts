import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FinancialRecord } from '@/types/financial';

interface SheetResponse {
  data: FinancialRecord[];
  regionais: string[];
  unidades: string[];
}

async function fetchSheetData(): Promise<SheetResponse> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const functionUrl = `${supabaseUrl}/functions/v1/fetch-sheets`;
  const { data: sessionData } = await supabase.auth.getSession();

  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      authorization: `Bearer ${sessionData.session?.access_token ?? supabaseKey}`,
      'content-type': 'application/json',
      'x-client-info': 'maissabor-dashboard',
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Failed to fetch sheet data: ${response.status}`);
  }

  return await response.json() as SheetResponse;
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
