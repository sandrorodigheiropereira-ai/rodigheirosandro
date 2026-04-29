import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FinancialRecord } from '@/types/financial';
import { useMemo } from 'react';
import { getRegionaisFromData, getUnidadesFromData } from '@/hooks/useSheetData';
import { MultiSelectUnidade } from '@/components/MultiSelectUnidade';

interface FiltersBarProps {
  periodo: string | string[];
  regional: string;
  unidade: string | string[];
  onPeriodoChange: (v: string | string[]) => void;
  onRegionalChange: (v: string) => void;
  onUnidadeChange: (v: string | string[]) => void;
  records: FinancialRecord[];
  multiSelectUnidade?: boolean;
  multiSelectPeriodo?: boolean;
}

export function FiltersBar({ periodo, regional, unidade, onPeriodoChange, onRegionalChange, onUnidadeChange, records, multiSelectUnidade, multiSelectPeriodo }: FiltersBarProps) {
  const meses = useMemo(() => [...new Set(records.map(r => r.data))].sort(), [records]);
  const regionais = useMemo(() => getRegionaisFromData(records), [records]);
  const unidades = useMemo(() => getUnidadesFromData(records, regional === 'all' ? undefined : regional), [records, regional]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {multiSelectPeriodo ? (
        <MultiSelectUnidade
          options={meses}
          selected={Array.isArray(periodo) ? periodo : periodo === 'all' ? [] : [periodo]}
          onChange={(sel) => onPeriodoChange(sel)}
          allLabel="Todos os meses"
          pluralLabel="meses"
          width="w-[180px]"
        />
      ) : (
        <Select value={typeof periodo === 'string' ? periodo : 'all'} onValueChange={onPeriodoChange}>
          <SelectTrigger className="w-[140px] bg-secondary border-border">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {meses.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      <Select value={regional} onValueChange={(v) => { onRegionalChange(v); onUnidadeChange('all'); }}>
        <SelectTrigger className="w-[160px] bg-secondary border-border">
          <SelectValue placeholder="Regional" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          {regionais.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
        </SelectContent>
      </Select>

      {multiSelectUnidade ? (
        <MultiSelectUnidade
          options={unidades}
          selected={Array.isArray(unidade) ? unidade : unidade === 'all' ? [] : [unidade]}
          onChange={(sel) => onUnidadeChange(sel.length === 0 ? [] : sel)}
        />
      ) : (
        <Select value={typeof unidade === 'string' ? unidade : 'all'} onValueChange={(v) => onUnidadeChange(v)}>
          <SelectTrigger className="w-[180px] bg-secondary border-border">
            <SelectValue placeholder="Unidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {unidades.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
