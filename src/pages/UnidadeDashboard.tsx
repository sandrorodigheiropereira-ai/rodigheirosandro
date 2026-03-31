import { useState, useMemo } from 'react';
import { DollarSign, ShoppingCart, Users, TrendingUp } from 'lucide-react';
import { KpiCard } from '@/components/KpiCard';
import { calcMetrics, groupBy, formatCurrency } from '@/lib/calculations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSheetData, getRegionaisFromData, getUnidadesFromData } from '@/hooks/useSheetData';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';

export default function UnidadeDashboard() {
  const { data: sheetData, isLoading, error } = useSheetData();
  const allRecords = sheetData?.data || [];
  const regionais = useMemo(() => getRegionaisFromData(allRecords), [allRecords]);
  const [regional, setRegional] = useState('');
  const [unidade, setUnidade] = useState('');

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

  const filtered = useMemo(() => allRecords.filter(r => r.unidade === unidade), [unidade, allRecords]);
  const metrics = calcMetrics(filtered);

  const monthlyData = useMemo(() => {
    const byMonth = groupBy(filtered, 'data');
    return Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, recs]) => {
      const m = calcMetrics(recs);
      return { mes: month, receita: m.receitaBruta, cmv: recs.reduce((s, r) => s + r.cmv, 0), maoDeObra: recs.reduce((s, r) => s + r.maoDeObra, 0), despesa: m.despesaTotal };
    });
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Receita" value={metrics.receitaBruta} format="currency" icon={<DollarSign className="w-5 h-5" />} />
        <KpiCard title="CMV" value={metrics.cmvPercent} format="percent" icon={<ShoppingCart className="w-5 h-5" />} delay={0.1} />
        <KpiCard title="Mão de Obra" value={metrics.maoDeObraPercent} format="percent" icon={<Users className="w-5 h-5" />} delay={0.2} />
        <KpiCard title="Despesa Total" value={metrics.despesaTotal} format="currency" icon={<TrendingUp className="w-5 h-5" />} delay={0.3} />
      </div>

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
