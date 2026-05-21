import { useState, useMemo, useEffect } from 'react';
import { DollarSign, TrendingUp, Percent } from 'lucide-react';
import { KpiCard } from '@/components/KpiCard';
import { calcMetrics, groupBy, formatCurrency, rankUnidades } from '@/lib/calculations';
import { filterOutAdm } from '@/lib/constants';
import { RankingPanel } from '@/components/RankingPanel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelectUnidade } from '@/components/MultiSelectUnidade';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useSheetData, getRegionaisFromData } from '@/hooks/useSheetData';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';

const PIE_COLORS = ['hsl(210 90% 60%)', 'hsl(38 92% 55%)', 'hsl(280 65% 60%)'];

type CompareMode = 'previous-month' | 'previous-window';

export default function RegionalDashboard() {
  const { data: sheetData, isLoading, error } = useSheetData();
  const allRecords = useMemo(() => filterOutAdm(sheetData?.data || []), [sheetData]);
  const regionais = useMemo(() => getRegionaisFromData(allRecords), [allRecords]);
  const [regional, setRegional] = useState('');
  const [periodo, setPeriodo] = useState<string[]>([]);
  const [compareMode, setCompareMode] = useState<CompareMode>('previous-window');
  const [rankMetric, setRankMetric] = useState<'receitaBruta' | 'ebitda' | 'margem'>('receitaBruta');

  const meses = useMemo(
    () => [...new Set(allRecords.map(r => r.data))].filter(Boolean).sort(),
    [allRecords]
  );

  useEffect(() => {
    if (regionais.length > 0 && !regional) setRegional(regionais[0]);
  }, [regionais]);

  const filtered = useMemo(
    () => allRecords.filter(r => r.regional === regional && (periodo.length === 0 || periodo.includes(r.data))),
    [regional, periodo, allRecords]
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
    ? allRecords.filter(r => r.regional === regional && prevMonths.includes(r.data))
    : undefined;

  const metrics = calcMetrics(filtered, prevData);
  const prevMetrics = prevData ? calcMetrics(prevData) : undefined;
  const pct = (cur: number, prev?: number) => prev !== undefined && prev > 0 ? ((cur - prev) / prev) * 100 : undefined;
  const periodLabel = prevMonths.length > 0
    ? `vs ${prevMonths.length === 1 ? 'mês anterior' : `${prevMonths.length} meses anteriores`}`
    : undefined;

  const ranking = rankUnidades(filtered, rankMetric);
  const prevRanking = prevData ? rankUnidades(prevData, rankMetric) : undefined;
  const rankFormat: 'currency' | 'percent' = rankMetric === 'margem' ? 'percent' : 'currency';
  const metricLabel = rankMetric === 'receitaBruta' ? 'Receita' : rankMetric === 'ebitda' ? 'EBITDA' : 'Margem';
  const periodCurrentLabel = selectedMonths.length === 0
    ? 'Todos os meses'
    : selectedMonths.length === 1
      ? selectedMonths[0]
      : `${selectedMonths[0]} – ${selectedMonths[selectedMonths.length - 1]} (${selectedMonths.length} meses)`;
  const rankingSubtitle = periodLabel
    ? `${periodCurrentLabel} ${periodLabel}`
    : periodCurrentLabel;

  const unidadeData = useMemo(() => {
    const byUnidade = groupBy(filtered, 'unidade');
    return Object.entries(byUnidade).map(([name, recs]) => ({
      unidade: name,
      receita: recs.reduce((s, r) => s + r.receitaBruta, 0),
      despesa: recs.reduce((s, r) => s + r.despesaTotal, 0),
    }));
  }, [filtered]);

  const monthlyData = useMemo(() => {
    const byMonth = groupBy(filtered, 'data');
    return Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, recs]) => {
      const m = calcMetrics(recs);
      return { mes: month, receita: m.receitaBruta, despesa: m.despesaTotal, margem: m.margem, cmv: m.cmvPercent };
    });
  }, [filtered]);

  const sparklines = useMemo(() => ({
    receita: monthlyData.map(d => d.receita),
    despesa: monthlyData.map(d => d.despesa),
    margem: monthlyData.map(d => d.margem),
  }), [monthlyData]);

  const costData = useMemo(() => {
    const mao = filtered.reduce((s, r) => s + r.maoDeObra, 0);
    const imp = filtered.reduce((s, r) => s + r.impostos, 0);
    const mp = filtered.reduce((s, r) => s + (r.materiaPrima || 0), 0);
    return [
      { name: 'Mão de Obra', value: mao },
      { name: 'Impostos', value: imp },
      { name: 'Matéria Prima', value: mp },
    ];
  }, [filtered]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28" />)}
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
          <h1 className="text-2xl font-display font-bold">Dashboard Regional</h1>
          <p className="text-sm text-muted-foreground">Análise por regional</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <MultiSelectUnidade
            options={meses}
            selected={periodo}
            onChange={setPeriodo}
            allLabel="Todos os meses"
            pluralLabel="meses"
            width="w-[180px]"
          />
          <Select value={regional} onValueChange={setRegional}>
            <SelectTrigger className="w-[180px] bg-secondary border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {regionais.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard title="Receita Total" value={metrics.receitaBruta} format="currency" change={pct(metrics.receitaBruta, prevMetrics?.receitaBruta)} subtitle={periodLabel} icon={<DollarSign className="w-5 h-5" />} sparkline={sparklines.receita} />
        <KpiCard title="Despesa Total" value={metrics.despesaTotal} format="currency" change={pct(metrics.despesaTotal, prevMetrics?.despesaTotal)} subtitle={periodLabel} icon={<TrendingUp className="w-5 h-5" />} delay={0.1} sparkline={sparklines.despesa} invertTrend />
        <KpiCard title="Margem (%)" value={metrics.margem} format="percent" change={prevMetrics ? metrics.margem - prevMetrics.margem : undefined} subtitle={`Meta: ${metrics.meta.toFixed(1)}%`} icon={<Percent className="w-5 h-5" />} delay={0.2} sparkline={sparklines.margem} />
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="glass-card rounded-xl p-5">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Receita por Unidade</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={unidadeData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 18%)" />
            <XAxis dataKey="unidade" tick={{ fill: 'hsl(215 20% 55%)', fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fill: 'hsl(215 20% 55%)', fontSize: 12 }} />
            <Tooltip contentStyle={{ backgroundColor: 'hsl(222 44% 9%)', border: '1px solid hsl(222 30% 18%)', borderRadius: '8px', color: 'hsl(210 40% 96%)' }}
              formatter={(v: number) => formatCurrency(v)} />
            <Bar dataKey="receita" name="Receita" fill="hsl(162 72% 46%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="despesa" name="Despesa Total" fill="hsl(210 90% 60%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="glass-card rounded-xl p-4">
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Distribuição de Custos</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center max-w-md mx-auto">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={costData}
                cx="50%"
                cy="50%"
                innerRadius={42}
                outerRadius={75}
                paddingAngle={2}
                dataKey="value"
                isAnimationActive={false}
              >
                {costData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} stroke="none" />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2">
            {(() => {
              const total = costData.reduce((s, c) => s + c.value, 0);
              return costData.map((c, i) => {
                const pctVal = total > 0 ? (c.value / total) * 100 : 0;
                return (
                  <div key={c.name} className="rounded-lg border border-border bg-secondary/40 p-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: PIE_COLORS[i] }} />
                        <span className="text-[10px] font-medium">{c.name}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{pctVal.toFixed(1)}%</span>
                    </div>
                    <p className="text-[10px] font-display font-bold truncate">{formatCurrency(c.value)}</p>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </motion.div>

      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-muted-foreground">Métrica do ranking:</span>
          <ToggleGroup
            type="single"
            value={rankMetric}
            onValueChange={(v) => v && setRankMetric(v as 'receitaBruta' | 'ebitda' | 'margem')}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="receitaBruta" className="text-xs">Receita</ToggleGroupItem>
            <ToggleGroupItem value="ebitda" className="text-xs">EBITDA</ToggleGroupItem>
            <ToggleGroupItem value="margem" className="text-xs">Margem</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <RankingPanel data={ranking} previousData={prevRanking} format={rankFormat} title="Ranking de Unidades" metricLabel={metricLabel} subtitle={rankingSubtitle} />
      </div>
    </div>
  );
}
