import { useState, useMemo, useEffect } from 'react';
import { DollarSign, ShoppingCart, Users, TrendingUp, TrendingDown, Percent } from 'lucide-react';
import { KpiCard } from '@/components/KpiCard';
import { calcMetrics, groupBy, formatCurrency } from '@/lib/calculations';
import { filterOutAdm } from '@/lib/constants';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelectUnidade } from '@/components/MultiSelectUnidade';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useSheetData, getRegionaisFromData, getUnidadesFromData } from '@/hooks/useSheetData';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DonutChart } from '@/components/DonutChart';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';

type CompareMode = 'previous-month' | 'previous-window';

export default function UnidadeDashboard() {
  const { data: sheetData, isLoading, error } = useSheetData();
  const allRecords = useMemo(() => filterOutAdm(sheetData?.data || []), [sheetData]);
  const regionais = useMemo(() => getRegionaisFromData(allRecords), [allRecords]);
  const [regional, setRegional] = useState('');
  const [unidade, setUnidade] = useState('');
  const [periodo, setPeriodo] = useState<string[]>([]);
  const [compareMode, setCompareMode] = useState<CompareMode>('previous-window');

  const meses = useMemo(
    () => [...new Set(allRecords.map(r => r.data))].filter(Boolean).sort(),
    [allRecords]
  );

  const unidades = useMemo(() => getUnidadesFromData(allRecords, regional), [allRecords, regional]);

  useEffect(() => {
    if (regionais.length > 0 && !regional) setRegional(regionais[0]);
  }, [regionais]);

  useEffect(() => {
    if (unidades.length > 0 && (!unidade || !unidades.includes(unidade))) {
      setUnidade(unidades[0]);
    }
  }, [unidades]);

  const unidadeRecords = useMemo(() => allRecords.filter(r => r.unidade === unidade), [unidade, allRecords]);
  const filtered = useMemo(
    () => unidadeRecords.filter(r => periodo.length === 0 || periodo.includes(r.data)),
    [unidadeRecords, periodo]
  );

  const selectedMonths = useMemo(() => (periodo.length > 0 ? [...periodo].sort() : meses), [periodo, meses]);
  const prevMonths = useMemo(() => {
    if (selectedMonths.length === 0) return [];
    const earliestIdx = meses.indexOf(selectedMonths[0]);
    if (earliestIdx <= 0) return [];
    const N = compareMode === 'previous-month' ? 1 : selectedMonths.length;
    return meses.slice(Math.max(0, earliestIdx - N), earliestIdx);
  }, [selectedMonths, meses, compareMode]);

  const prevData = prevMonths.length > 0
    ? unidadeRecords.filter(r => prevMonths.includes(r.data))
    : undefined;

  const metrics = calcMetrics(filtered, prevData);
  const prevMetrics = prevData ? calcMetrics(prevData) : undefined;
  const pct = (cur: number, prev?: number) => prev !== undefined && prev > 0 ? ((cur - prev) / prev) * 100 : undefined;
  const periodLabel = prevMonths.length > 0
    ? `vs ${prevMonths.length === 1 ? 'mês anterior' : `${prevMonths.length} meses anteriores`}`
    : undefined;

  // Evolução mensal usa todos os meses (não filtra pelo seletor de mês)
  const monthlyData = useMemo(() => {
    const byMonth = groupBy(unidadeRecords, 'data');
    return Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, recs]) => {
      const m = calcMetrics(recs);
      return { mes: month, receita: m.receitaBruta, cmv: m.cmvPercent, maoDeObra: m.maoDeObraPercent, despesa: m.despesaTotal, margem: m.margem };
    });
  }, [unidadeRecords]);

  const sparklines = useMemo(() => ({
    receita: monthlyData.map(d => d.receita),
    cmv: monthlyData.map(d => d.cmv),
    maoDeObra: monthlyData.map(d => d.maoDeObra),
    despesa: monthlyData.map(d => d.despesa),
    margem: monthlyData.map(d => d.margem),
  }), [monthlyData]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive font-semibold">Erro ao carregar dados: {(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Dashboard por Unidade</h1>
          <p className="text-sm text-muted-foreground">Análise detalhada da unidade</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <MultiSelectUnidade
            options={meses}
            selected={periodo}
            onChange={setPeriodo}
            allLabel="Todos os meses"
            pluralLabel="meses"
            width="w-[170px]"
          />
          <Select value={regional} onValueChange={(v) => { setRegional(v); const u = getUnidadesFromData(allRecords, v); setUnidade(u[0] || ''); }}>
            <SelectTrigger className="w-[160px] bg-secondary border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              {regionais.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={unidade} onValueChange={setUnidade}>
            <SelectTrigger className="w-[180px] bg-secondary border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              {unidades.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedMonths.length > 1 && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-muted-foreground">Comparar com:</span>
          <ToggleGroup
            type="single"
            value={compareMode}
            onValueChange={(v) => v && setCompareMode(v as CompareMode)}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="previous-month" className="text-xs">Mês anterior</ToggleGroupItem>
            <ToggleGroupItem value="previous-window" className="text-xs">Janela anterior ({selectedMonths.length} meses)</ToggleGroupItem>
          </ToggleGroup>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard title="Receita" value={metrics.receitaBruta} format="currency" change={pct(metrics.receitaBruta, prevMetrics?.receitaBruta)} subtitle={periodLabel} icon={<DollarSign className="w-5 h-5" />} sparkline={sparklines.receita} />
        <KpiCard title="CMV" value={metrics.cmvPercent} format="percent" change={prevMetrics ? metrics.cmvPercent - prevMetrics.cmvPercent : undefined} subtitle={periodLabel} icon={<ShoppingCart className="w-5 h-5" />} delay={0.1} sparkline={sparklines.cmv} invertTrend />
        <KpiCard title="Mão de Obra" value={metrics.maoDeObraPercent} format="percent" change={prevMetrics ? metrics.maoDeObraPercent - prevMetrics.maoDeObraPercent : undefined} subtitle={periodLabel} icon={<Users className="w-5 h-5" />} delay={0.2} />
        <KpiCard title="Despesa Total" value={metrics.despesaTotal} format="currency" change={pct(metrics.despesaTotal, prevMetrics?.despesaTotal)} subtitle={periodLabel} icon={<TrendingUp className="w-5 h-5" />} delay={0.3} sparkline={sparklines.despesa} invertTrend />
        <KpiCard title="Margem (%)" value={metrics.margem} format="percent" change={prevMetrics ? metrics.margem - prevMetrics.margem : undefined} subtitle={`Meta: ${metrics.meta.toFixed(1)}%`} icon={<Percent className="w-5 h-5" />} delay={0.4} sparkline={sparklines.margem} />
      </div>

      {(() => {
        const monthsAvail = [...new Set(filtered.map(r => r.data))].filter(Boolean).sort();
        const refMonth = monthsAvail[monthsAvail.length - 1] ?? null;
        const prevMonth = monthsAvail.length > 1 ? monthsAvail[monthsAvail.length - 2] : null;
        const sumBy = (mes: string | null, key: 'maoDeObra' | 'materiaPrima' | 'impostos') =>
          mes ? filtered.filter(r => r.data === mes).reduce((s, r) => s + r[key], 0) : 0;
        const items = [
          { name: 'Mão de Obra', value: filtered.reduce((s, r) => s + r.maoDeObra, 0), prevValue: sumBy(prevMonth, 'maoDeObra'), color: '#378ADD' },
          { name: 'Matéria Prima', value: filtered.reduce((s, r) => s + r.materiaPrima, 0), prevValue: sumBy(prevMonth, 'materiaPrima'), color: '#1D9E75' },
          { name: 'Impostos', value: filtered.reduce((s, r) => s + r.impostos, 0), prevValue: sumBy(prevMonth, 'impostos'), color: '#EF9F27' },
        ];
        return (
          <DonutChart
            title="Composição de Custos"
            items={items}
            comparisonLabel={prevMonth ? `Comparação: ${prevMonth} → ${refMonth}` : 'Sem mês anterior para comparação.'}
          />
        );
      })()}

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Histórico de Evolução</h3>

        {monthlyData.length < 2 ? (
          <div className="glass-card rounded-xl p-8 text-center text-sm text-muted-foreground">
            Dados insuficientes para exibir o histórico. Selecione mais meses ou escolha outra unidade.
          </div>
        ) : (
          <>
            {/* Receita vs Despesa */}
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Receita vs Despesa Total</h4>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-success inline-block rounded" />Receita</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-danger inline-block rounded" />Despesa</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 18%)" />
                  <XAxis dataKey="mes" tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} width={45} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(222 44% 9%)", border: "1px solid hsl(222 30% 18%)", borderRadius: "8px", color: "hsl(210 40% 96%)", fontSize: 12 }}
                    formatter={(v: number) => formatCurrency(v)}
                  />
                  <Line type="monotone" dataKey="receita" name="Receita" stroke="#1D9E75" strokeWidth={2} dot={{ r: 3, fill: "#1D9E75" }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="despesa" name="Despesa" stroke="#E24B4A" strokeWidth={2} dot={{ r: 3, fill: "#E24B4A" }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Margem vs Meta */}
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Margem (%) vs Meta</h4>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-primary inline-block rounded" />Margem</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-[1px] border-t border-dashed border-warning inline-block" style={{width:12}} />Meta</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={monthlyData.map(d => ({ ...d, meta: metrics.meta }))} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 18%)" />
                  <XAxis dataKey="mes" tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `${v.toFixed(1)}%`} tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} width={45} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(222 44% 9%)", border: "1px solid hsl(222 30% 18%)", borderRadius: "8px", color: "hsl(210 40% 96%)", fontSize: 12 }}
                    formatter={(v: number) => `${v.toFixed(1)}%`}
                  />
                  <Line type="monotone" dataKey="margem" name="Margem" stroke="#378ADD" strokeWidth={2} dot={(props: any) => {
                    const { cx, cy, payload } = props;
                    const color = payload.margem < 0 ? "#E24B4A" : payload.margem < metrics.meta ? "#EF9F27" : "#1D9E75";
                    return <circle key={cx} cx={cx} cy={cy} r={4} fill={color} stroke="none" />;
                  }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="meta" name="Meta" stroke="#EF9F27" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* CMV vs Mão de Obra */}
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CMV vs Mão de Obra (%)</h4>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 inline-block rounded" style={{background:"#EF9F27"}} />CMV</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 inline-block rounded" style={{background:"#A78BFA"}} />Mão de Obra</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-[1px] border-t border-dashed border-danger inline-block" style={{width:12}} />Limite 40%</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={monthlyData.map(d => ({ ...d, limite: 40 }))} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 18%)" />
                  <XAxis dataKey="mes" tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `${v.toFixed(0)}%`} tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} width={45} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(222 44% 9%)", border: "1px solid hsl(222 30% 18%)", borderRadius: "8px", color: "hsl(210 40% 96%)", fontSize: 12 }}
                    formatter={(v: number) => `${v.toFixed(1)}%`}
                  />
                  <Line type="monotone" dataKey="cmv" name="CMV" stroke="#EF9F27" strokeWidth={2} dot={{ r: 3, fill: "#EF9F27" }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="maoDeObra" name="Mão de Obra" stroke="#A78BFA" strokeWidth={2} dot={{ r: 3, fill: "#A78BFA" }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="limite" name="Limite CMV" stroke="#E24B4A" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
