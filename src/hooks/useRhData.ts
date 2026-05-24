import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RhRecord } from '@/types/financial';

interface RhResponse {
  data: RhRecord[];
  regionais: string[];
  unidades: string[];
}

async function fetchRhData(): Promise<RhResponse> {
  const { data, error } = await supabase.functions.invoke('fetch-rh');
  if (error) throw new Error(error.message);
  return data as RhResponse;
}

export function useRhData() {
  return useQuery({
    queryKey: ['rh-data'],
    queryFn: fetchRhData,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}
