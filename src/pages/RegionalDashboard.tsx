import { useState, useMemo } from 'react';
import { DollarSign, TrendingUp, Percent } from 'lucide-react';
import { KpiCard } from '@/components/KpiCard';
import { calcMetrics, groupBy, formatCurrency, rankUnidades } from '@/lib/calculations';
import { RankingPanel } from '@/components/RankingPanel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSheetData, getRegionaisFromData } from '@/hooks/useSheetData';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';

const PIE_COLORS = ['hsl(162 72% 46%)', 'hsl(210 90% 60%)', 'hsl(38 92% 55%)', 'hsl(280 65% 60%)'];

export default function RegionalDashboard() {
  const { data: sheetData, isLoading, error } = useSheetData();
  const allRecords = sheetData?.data || [];
  const regionais = useMemo(() => getRegionaisFromData(allRecords), [allRecords]);
  const [regional, setRegional] = useState('');

  // Set default regional when data loads
  useMemo(() => {
    if (regionais.length > 0 && !regional) setRegional(regionais[0]);
  }, [regionais]);

  const filtered = useMemo(() => allRecords.filter(r => r.regional === regional), [regional, allRecords]);
  const metrics = calcMetrics(filtered);
  const ranking = rankUnidades(filtered);

  const unidadeData = useMemo(() => {
    const byUnidade = groupBy(filtered, 'unidade');
    return Object.entries(byUnidade).map(([name, recs]) => ({
      unidade: name,
      receita: recs.reduce((s, r) => s + r.receitaBruta, 0),
      despesa: recs.reduce((s, r) => s + r.despesaTotal, 0),
    }));
  }, [filtered]);

  const costData = useMemo(() => {
    const cmv = filtered.reduce((s, r) => s + r.cmv, 0);
    const mao = filtered.reduce((s, r) => s + r.maoDeObra, 0);
    const desp = filtered.reduce((s, r) => s + r.despesaTotal, 0);
    const imp = filtered.reduce((s, r) => s + r.impostos, 0);
    return [
      { name: 'CMV', value: cmv },
      { name: 'Mão de Obra', value: mao },
      { name: 'Despesas', value: desp },
      { name: 'Impostos', value: imp },
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
        <Select value={regional} onValueChange={setRegional}>
          <SelectTrigger className="w-[180px] bg-secondary border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {regionais.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard title="Receita Total" value={metrics.receitaBruta} format="currency" icon={<DollarSign className="w-5 h-5" />} />
        <KpiCard title="Despesa Total" value={metrics.despesaTotal} format="currency" icon={<TrendingUp className="w-5 h-5" />} delay={0.1} />
        <KpiCard title="Margem (%)" value={metrics.margem} format="percent" subtitle={`Meta: ${metrics.meta.toFixed(1)}%`} icon={<Percent className="w-5 h-5" />} delay={0.2} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="lg:col-span-2 glass-card rounded-xl p-5">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Receita por Unidade</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={unidadeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 18%)" />
              <XAxis dataKey="unidade" tick={{ fill: 'hsl(215 20% 55%)', fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fill: 'hsl(215 20% 55%)', fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(222 44% 9%)', border: '1px solid hsl(222 30% 18%)', borderRadius: '8px', color: 'hsl(210 40% 96%)' }}
                formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="receita" name="Receita" fill="hsl(162 72% 46%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ebitda" name="EBITDA" fill="hsl(210 90% 60%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="glass-card rounded-xl p-5">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Distribuição de Custos</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={costData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value">
                {costData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: 'hsl(222 44% 9%)', border: '1px solid hsl(222 30% 18%)', borderRadius: '8px', color: 'hsl(210 40% 96%)' }}
                formatter={(v: number) => formatCurrency(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      <RankingPanel data={ranking} title="Ranking de Unidades" />
    </div>
  );
}
