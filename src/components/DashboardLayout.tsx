import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SystemConfig {
  cmv_danger: number;
  cmv_warning: number;
  mdo_danger: number;
  mdo_warning: number;
  adm_limit: number;
}

const DEFAULTS: SystemConfig = {
  cmv_danger: 50,
  cmv_warning: 40,
  mdo_danger: 35,
  mdo_warning: 30,
  adm_limit: 4,
};

async function fetchConfig(): Promise<SystemConfig> {
  const { data, error } = await supabase.from("system_config").select("key, value");
  if (error || !data) return DEFAULTS;
  const map: Record<string, number> = {};
  for (const row of data) map[row.key] = parseFloat(row.value) || 0;
  return {
    cmv_danger: map.cmv_danger ?? DEFAULTS.cmv_danger,
    cmv_warning: map.cmv_warning ?? DEFAULTS.cmv_warning,
    mdo_danger: map.mdo_danger ?? DEFAULTS.mdo_danger,
    mdo_warning: map.mdo_warning ?? DEFAULTS.mdo_warning,
    adm_limit: map.adm_limit ?? DEFAULTS.adm_limit,
  };
}

export function useSystemConfig() {
  return useQuery({
    queryKey: ["system-config"],
    queryFn: fetchConfig,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export { DEFAULTS as CONFIG_DEFAULTS };
