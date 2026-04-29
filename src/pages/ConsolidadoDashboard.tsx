import { useState, useMemo } from 'react';
import { DollarSign, TrendingUp, Percent, BarChart3 } from 'lucide-react';
import { KpiCard } from '@/components/KpiCard';
import { FiltersBar } from '@/components/FiltersBar';
import { AlertsPanel } from '@/components/AlertsPanel';
import { RankingPanel } from '@/components/RankingPanel';
import { calcMetrics, generateAlerts, groupBy, formatCurrency, rankUnidades } from '@/lib/calculations';
import { useSheetData, getRegionaisFromData, getUnidadesFromData } from '@/hooks/useSheetData';
import { filterOutAdm } from '@/lib/constants';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart, LabelList } from 'recharts';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';

export default function ConsolidadoDashboard() {
  const [periodo, setPeriodo] = useState('all');
  const [regional, setRegional] = useState('all');
  const [unidade, setUnidade] = useState<string[]>([]);

  const { data: sheetData, isLoading, error } = useSheetData();
  const allRecords = useMemo(() => filterOutAdm(sheetData?.data || []), [sheetData]);

  const filtered = useMemo(() => {
    let data = allRecords;
    if (periodo !== 'all') data = data.filter(r => r.data === periodo);
    if (regional !== 'all') data = data.filter(r => r.regional === regional);
    if (unidade.length > 0) data = data.filter(r => unidade.includes(r.unidade));
    return data;
  }, [periodo, regional, unidade, allRecords]);

  const meses = useMemo(() => [...new Set(allRecords.map(r => r.data))].sort(), [allRecords]);
  const currentMonth = periodo !== 'all' ? periodo : meses[meses.length - 1];
  const currentIdx = meses.indexOf(currentMonth);
  const prevMonth = currentIdx > 0 ? meses[currentIdx - 1] : undefined;

  const currentData = filtered.filter(r => periodo === 'all' || r.data === currentMonth);
  const prevData = prevMonth ? allRecords.filter(r => r.data === prevMonth && (regional === 'all' || r.regional === regional) && (unidade.length === 0 || unidade.includes(r.unidade))) : undefined;

  const metrics = calcMetrics(currentData, prevData);
  const alerts = generateAlerts(filtered);
  const ranking = rankUnidades(filtered);
  const rankingMargem = rankUnidades(filtered, 'margem');
  const monthlyData = useMemo(() => {
    const byMonth = groupBy(filtered, 'data');
    return Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, recs]) => {
      const m = calcMetrics(recs);
      return { mes: month, receita: m.receitaBruta, despesa: m.despesaTotal, margem: m.margem };
    });
  }, [filtered]);

  const regionalData = useMemo(() => {
    const byRegional = groupBy(filtered, 'regional');
    return Object.entries(byRegional).map(([name, recs]) => ({
      regional: name,
      receita: recs.reduce((s, r) => s + r.receitaBruta, 0),
      despesa: recs.reduce((s, r) => s + r.despesaTotal, 0),
    }));
  }, [filtered]);

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
        <div className="text-center space-y-2">
          <p className="text-destructive font-semibold">Erro ao carregar dados</p>
          <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Dashboard Consolidado</h1>
          <p className="text-sm text-muted-foreground">Visão geral de todas as regionais • Dados do Google Sheets</p>
        </div>
        <FiltersBar periodo={periodo} regional={regional} unidade={unidade}
          onPeriodoChange={setPeriodo} onRegionalChange={(v) => { setRegional(v); setUnidade([]); }} onUnidadeChange={(v) => setUnidade(Array.isArray(v) ? v : v === 'all' ? [] : [v])}
          records={allRecords} multiSelectUnidade />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Receita Total" value={metrics.receitaBruta} format="currency" icon={<DollarSign className="w-5 h-5" />} delay={0} />
        <KpiCard title="Despesa Total" value={metrics.despesaTotal} format="currency" icon={<TrendingUp className="w-5 h-5" />} delay={0.1} />
        <KpiCard title="Margem (%)" value={metrics.margem} format="percent" subtitle={`Meta: ${metrics.meta.toFixed(1)}%`} icon={<Percent className="w-5 h-5" />} delay={0.2} />
        <KpiCard title="CMV" value={metrics.cmvPercent} format="percent" icon={<BarChart3 className="w-5 h-5" />} delay={0.3} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="lg:col-span-2 glass-card rounded-xl p-5">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Evolução Mensal</h3>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={monthlyData} margin={{ top: 30, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(210 90% 60%)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(210 90% 60%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorDespesa" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(8 85% 55%)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(8 85% 55%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 18%)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: 'hsl(215 20% 55%)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `${Math.round(v / 1000).toLocaleString('pt-BR')}k`} tick={{ fill: 'hsl(215 20% 55%)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(222 44% 9%)', border: '1px solid hsl(222 30% 18%)', borderRadius: '8px', color: 'hsl(210 40% 96%)' }}
                formatter={(v: number) => formatCurrency(v)} />
              <Legend iconType="circle" wrapperStyle={{ paddingTop: 8 }} />
              <Area type="monotone" dataKey="receita" name="Receita" stroke="hsl(210 90% 60%)" strokeWidth={2.5} fill="url(#colorReceita)" dot={{ r: 4, fill: 'hsl(210 90% 60%)', strokeWidth: 0 }} activeDot={{ r: 6 }}>
                <LabelList dataKey="receita" position="top" formatter={(v: number) => `${Math.round(v / 1000).toLocaleString('pt-BR')}k`} style={{ fill: 'hsl(210 90% 70%)', fontSize: 10, fontWeight: 600 }} />
              </Area>
              <Area type="monotone" dataKey="despesa" name="Despesa" stroke="hsl(8 85% 55%)" strokeWidth={2.5} fill="url(#colorDespesa)" dot={{ r: 4, fill: 'hsl(8 85% 55%)', strokeWidth: 0 }} activeDot={{ r: 6 }}>
                <LabelList dataKey="despesa" position="bottom" formatter={(v: number) => `${Math.round(v / 1000).toLocaleString('pt-BR')}k`} style={{ fill: 'hsl(8 85% 70%)', fontSize: 10, fontWeight: 600 }} />
              </Area>
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <AlertsPanel alerts={alerts} />
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="glass-card rounded-xl p-5">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Receita por Regional</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={regionalData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 18%)" />
            <XAxis dataKey="regional" tick={{ fill: 'hsl(215 20% 55%)', fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fill: 'hsl(215 20% 55%)', fontSize: 12 }} />
            <Tooltip contentStyle={{ backgroundColor: 'hsl(222 44% 9%)', border: '1px solid hsl(222 30% 18%)', borderRadius: '8px', color: 'hsl(210 40% 96%)' }}
              formatter={(v: number) => formatCurrency(v)} />
            <Legend iconType="circle" wrapperStyle={{ paddingTop: 8 }} />
            <Bar dataKey="receita" name="Receita" fill="hsl(210 90% 60%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="despesa" name="Despesa" fill="hsl(8 85% 55%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RankingPanel data={ranking} format="currency" title="Ranking Geral por Receita" />
        <RankingPanel data={rankingMargem} format="percent" title="Ranking Geral por Margem" />
      </div>
    </div>
  );
}
