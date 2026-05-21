import { useState, useMemo, useEffect } from 'react';
import { DollarSign, ShoppingCart, Users, TrendingUp, TrendingDown, Percent } from 'lucide-react';
import { KpiCard } from '@/components/KpiCard';
import { calcMetrics, groupBy, formatCurrency } from '@/lib/calculations';
import { filterOutAdm } from '@/lib/constants';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelectUnidade } from '@/components/MultiSelectUnidade';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useSheetData, getRegionaisFromData, getUnidadesFromData } from '@/hooks/useSheetData';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
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
        <KpiCard title="Mão de Obra" value={metrics.maoDeObraPercent} format="percent" change={prevMetrics ? metrics.maoDeObraPercent - prevMetrics.maoDeObraPercent : undefined} subtitle={periodLabel} icon={<Users className="w-5 h-5" />} delay={0.2} sparkline={sparklines.maoDeObra} invertTrend />
        <KpiCard title="Despesa Total" value={metrics.despesaTotal} format="currency" change={pct(metrics.despesaTotal, prevMetrics?.despesaTotal)} subtitle={periodLabel} icon={<TrendingUp className="w-5 h-5" />} delay={0.3} sparkline={sparklines.despesa} invertTrend />
        <KpiCard title="Margem (%)" value={metrics.margem} format="percent" change={prevMetrics ? metrics.margem - prevMetrics.margem : undefined} subtitle={`Meta: ${metrics.meta.toFixed(1)}%`} icon={<Percent className="w-5 h-5" />} delay={0.4} sparkline={sparklines.margem} />
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="glass-card rounded-xl p-4">
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Mão de Obra vs Matéria Prima</h3>
        {(() => {
          const monthsAvail = [...new Set(filtered.map(r => r.data))].filter(Boolean).sort();
          const refMonth = monthsAvail[monthsAvail.length - 1] ?? null;
          const prevMonth = monthsAvail.length > 1 ? monthsAvail[monthsAvail.length - 2] : null;
          const sumBy = (mes: string | null, key: 'maoDeObra' | 'materiaPrima') =>
            mes ? filtered.filter(r => r.data === mes).reduce((s, r) => s + r[key], 0) : 0;

          const pieData = [
            { name: 'Mão de Obra', value: filtered.reduce((s, r) => s + r.maoDeObra, 0), key: 'maoDeObra' as const },
            { name: 'Matéria Prima', value: filtered.reduce((s, r) => s + r.materiaPrima, 0), key: 'materiaPrima' as const },
          ];
          const total = pieData.reduce((s, d) => s + d.value, 0);
          const COLORS = ['hsl(210 90% 60%)', 'hsl(162 72% 46%)'];

          if (total <= 0) {
            return <p className="text-[10px] text-muted-foreground">Sem dados para o filtro atual.</p>;
          }
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    innerRadius={42}
                    paddingAngle={2}
                    isAnimationActive={false}
                  >
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} stroke="none" />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {pieData.map((d, i) => {
                  const atual = sumBy(refMonth, d.key);
                  const anterior = sumBy(prevMonth, d.key);
                  const variacao = anterior > 0 ? ((atual - anterior) / anterior) * 100 : null;
                  const isUp = variacao !== null && variacao > 0;
                  const isDown = variacao !== null && variacao < 0;
                  const trendColor = isUp ? 'text-destructive' : isDown ? 'text-success' : 'text-muted-foreground';
                  const TrendIcon = isUp ? TrendingUp : isDown ? TrendingDown : Percent;
                  return (
                    <div key={d.name} className="rounded-lg border border-border bg-secondary/40 p-2">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS[i] }} />
                          <span className="text-[10px] font-medium">{d.name}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{((d.value / total) * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex items-end justify-between gap-2">
                        <div className="space-y-0.5 min-w-0">
                          <p className="text-[10px] font-display font-bold truncate">{formatCurrency(d.value)}</p>
                          <p className="text-[10px] text-muted-foreground truncate">Ant: {formatCurrency(anterior)}</p>
                          <p className="text-[10px] text-muted-foreground truncate">Atual: {formatCurrency(atual)}</p>
                        </div>
                        <div className={`flex items-center gap-1 text-[10px] font-display font-bold shrink-0 ${trendColor}`}>
                          <TrendIcon className="w-3 h-3" />
                          <span>{variacao === null ? '—' : `${variacao > 0 ? '+' : ''}${variacao.toFixed(1)}%`}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between rounded-lg border border-border/60 p-2">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</span>
                  <span className="text-[10px] font-display font-bold">{formatCurrency(total)}</span>
                </div>
                {prevMonth ? (
                  <p className="text-[10px] text-muted-foreground text-right">Comparação: {prevMonth} → {refMonth}</p>
                ) : (
                  <p className="text-[10px] text-muted-foreground text-right">Sem mês anterior para comparação.</p>
                )}
              </div>
            </div>
          );
        })()}
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="glass-card rounded-xl p-5">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Evolução Mensal</h3>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 18%)" />
            <XAxis dataKey="mes" tick={{ fill: 'hsl(215 20% 55%)', fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fill: 'hsl(215 20% 55%)', fontSize: 12 }} />
            <Tooltip contentStyle={{ backgroundColor: 'hsl(222 44% 9%)', border: '1px solid hsl(222 30% 18%)', borderRadius: '8px', color: 'hsl(210 40% 96%)' }}
              formatter={(v: number) => formatCurrency(v)} />
            <Legend />
            <Line type="monotone" dataKey="receita" name="Receita" stroke="hsl(162 72% 46%)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="cmv" name="CMV" stroke="hsl(38 92% 55%)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="maoDeObra" name="Mão de Obra" stroke="hsl(280 65% 60%)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="despesa" name="Despesa Total" stroke="hsl(210 90% 60%)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
}
