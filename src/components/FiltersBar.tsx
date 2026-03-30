import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getRegionais, getUnidades } from '@/data/mockData';
import { mockFinancialData } from '@/data/mockData';

interface FiltersBarProps {
  periodo: string;
  regional: string;
  unidade: string;
  onPeriodoChange: (v: string) => void;
  onRegionalChange: (v: string) => void;
  onUnidadeChange: (v: string) => void;
}

export function FiltersBar({ periodo, regional, unidade, onPeriodoChange, onRegionalChange, onUnidadeChange }: FiltersBarProps) {
  const meses = [...new Set(mockFinancialData.map(r => r.data))].sort();
  const regionais = getRegionais();
  const unidades = getUnidades(regional === 'all' ? undefined : regional);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={periodo} onValueChange={onPeriodoChange}>
        <SelectTrigger className="w-[140px] bg-secondary border-border">
          <SelectValue placeholder="Período" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {meses.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={regional} onValueChange={(v) => { onRegionalChange(v); onUnidadeChange('all'); }}>
        <SelectTrigger className="w-[160px] bg-secondary border-border">
          <SelectValue placeholder="Regional" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          {regionais.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={unidade} onValueChange={onUnidadeChange}>
        <SelectTrigger className="w-[180px] bg-secondary border-border">
          <SelectValue placeholder="Unidade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          {unidades.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
