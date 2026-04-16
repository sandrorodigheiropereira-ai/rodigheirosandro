import { useState, useMemo } from 'react';
import { DollarSign, TrendingUp, Percent, Users, ShoppingCart } from 'lucide-react';
import { KpiCard } from '@/components/KpiCard';
import { calcMetrics, groupBy, formatCurrency } from '@/lib/calculations';
import { useSheetData } from '@/hooks/useSheetData';
import { filterOnlyAdm, ADM_UNITS } from '@/lib/constants';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdministrativoDashboard() {
  const [selectedUnit, setSelectedUnit] = useState('all');
  const { data: sheetData, isLoading, error } = useSheetData();

  const admRecords = useMemo(() => filterOnlyAdm(sheetData?.data || []), [sheetData]);

  const filtered = useMemo(() => {
    if (selectedUnit === 'all') return admRecords;
    return admRecords.filter(r => r.unidade === selectedUnit);
  }, [admRecords, selectedUnit]);

  const availableUnits = useMemo(() => [...new Set(admRecords.map(r => r.unidade))].sort(), [admRecords]);

  const metrics = calcMetrics(filtered);
  const margemAdm = metrics.receitaBruta > 0 ? (metrics.despesaTotal / metrics.receitaBruta) * 100 : 0;

  const monthlyData = useMemo(() => {
    const byMonth = groupBy(filtered, 'data');
    return Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, recs]) => {
      const m = calcMetrics(recs);
      return { mes: month, receita: m.receitaBruta, despesa: m.despesaTotal, margem: m.margem };
    });
  }, [filtered]);

  const unitData = useMemo(() => {
    const byUnit = groupBy(filtered, 'unidade');
    return Object.entries(byUnit).map(([name, recs]) => ({
      unidade: name,
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
        <p className="text-destructive font-semibold">Erro ao carregar dados: {(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Dashboard Administrativo</h1>
          <p className="text-sm text-muted-foreground">Visão exclusiva das unidades administrativas</p>
        </div>
        <Select value={selectedUnit} onValueChange={setSelectedUnit}>
          <SelectTrigger className="w-[180px] bg-secondary border-border">
            <SelectValue placeholder="Unidade ADM" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas ADMs</SelectItem>
            {availableUnits.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard title="Receita Total" value={metrics.receitaBruta} format="currency" icon={<DollarSign className="w-5 h-5" />} />
        <KpiCard title="Despesa Total" value={metrics.despesaTotal} format="currency" icon={<TrendingUp className="w-5 h-5" />} delay={0.1} />
        <KpiCard title="CMV" value={metrics.cmvPercent} format="percent" icon={<ShoppingCart className="w-5 h-5" />} delay={0.2} />
        <KpiCard title="Mão de Obra" value={metrics.maoDeObraPercent} format="percent" icon={<Users className="w-5 h-5" />} delay={0.3} />
        <KpiCard title="Margem (%)" value={margemAdm} format="percent" subtitle={`Meta: ${metrics.meta.toFixed(1)}%`} icon={<Percent className="w-5 h-5" />} delay={0.4} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="glass-card rounded-xl p-5">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Evolução Mensal</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 18%)" />
              <XAxis dataKey="mes" tick={{ fill: 'hsl(215 20% 55%)', fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fill: 'hsl(215 20% 55%)', fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(222 44% 9%)', border: '1px solid hsl(222 30% 18%)', borderRadius: '8px', color: 'hsl(210 40% 96%)' }}
                formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Line type="monotone" dataKey="receita" name="Receita" stroke="hsl(162 72% 46%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="despesa" name="Despesa Total" stroke="hsl(210 90% 60%)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="glass-card rounded-xl p-5">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Comparativo por Unidade ADM</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={unitData}>
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
      </div>
    </div>
  );
}
