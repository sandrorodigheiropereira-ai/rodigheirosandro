import { useState, useMemo } from 'react';
import { DollarSign, ShoppingCart, Users, TrendingUp, TrendingDown, Percent } from 'lucide-react';
import { KpiCard } from '@/components/KpiCard';
import { calcMetrics, groupBy, formatCurrency } from '@/lib/calculations';
import { filterOutAdm } from '@/lib/constants';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSheetData, getRegionaisFromData, getUnidadesFromData } from '@/hooks/useSheetData';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';

export default function UnidadeDashboard() {
  const { data: sheetData, isLoading, error } = useSheetData();
  const allRecords = useMemo(() => filterOutAdm(sheetData?.data || []), [sheetData]);
  const regionais = useMemo(() => getRegionaisFromData(allRecords), [allRecords]);
  const [regional, setRegional] = useState('');
  const [unidade, setUnidade] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('all');

  const availableMonths = useMemo(
    () => [...new Set(allRecords.map(r => r.data))].filter(Boolean).sort(),
    [allRecords]
  );

  const unidades = useMemo(() => getUnidadesFromData(allRecords, regional), [allRecords, regional]);

  // Set defaults when data loads
  useMemo(() => {
    if (regionais.length > 0 && !regional) {
      setRegional(regionais[0]);
    }
  }, [regionais]);

  useMemo(() => {
    if (unidades.length > 0 && (!unidade || !unidades.includes(unidade))) {
      setUnidade(unidades[0]);
    }
  }, [unidades]);

  const unidadeRecords = useMemo(() => allRecords.filter(r => r.unidade === unidade), [unidade, allRecords]);
  const filtered = useMemo(
    () => unidadeRecords.filter(r => selectedMonth === 'all' || r.data === selectedMonth),
    [unidadeRecords, selectedMonth]
  );
  const metrics = calcMetrics(filtered);

  // Evolução mensal usa todos os meses (não filtra pelo seletor de mês)
  const monthlyData = useMemo(() => {
    const byMonth = groupBy(unidadeRecords, 'data');
    return Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, recs]) => {
      const m = calcMetrics(recs);
      return { mes: month, receita: m.receitaBruta, cmv: recs.reduce((s, r) => s + r.cmv, 0), maoDeObra: recs.reduce((s, r) => s + r.maoDeObra, 0), despesa: m.despesaTotal };
    });
  }, [unidadeRecords]);

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
        <div className="flex gap-3">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard title="Receita" value={metrics.receitaBruta} format="currency" icon={<DollarSign className="w-5 h-5" />} />
        <KpiCard title="CMV" value={metrics.cmvPercent} format="percent" icon={<ShoppingCart className="w-5 h-5" />} delay={0.1} />
        <KpiCard title="Mão de Obra" value={metrics.maoDeObraPercent} format="percent" icon={<Users className="w-5 h-5" />} delay={0.2} />
        <KpiCard title="Despesa Total" value={metrics.despesaTotal} format="currency" icon={<TrendingUp className="w-5 h-5" />} delay={0.3} />
        <KpiCard title="Margem (%)" value={metrics.margem} format="percent" subtitle={`Meta: ${metrics.meta.toFixed(1)}%`} icon={<Percent className="w-5 h-5" />} delay={0.4} />
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
