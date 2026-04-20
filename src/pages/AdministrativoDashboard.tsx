import { useState, useMemo } from 'react';
import { DollarSign, TrendingUp, Percent, Users, ShoppingCart } from 'lucide-react';
import { KpiCard } from '@/components/KpiCard';
import { calcMetrics, groupBy, formatCurrency, formatPercent } from '@/lib/calculations';
import { useSheetData } from '@/hooks/useSheetData';
import { filterOnlyAdm, filterOutAdm, ADM_UNITS } from '@/lib/constants';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdministrativoDashboard() {
  const [selectedUnit, setSelectedUnit] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const { data: sheetData, isLoading, error } = useSheetData();

  const admRecordsAll = useMemo(() => filterOnlyAdm(sheetData?.data || []), [sheetData]);
  const operationalRecordsAll = useMemo(() => filterOutAdm(sheetData?.data || []), [sheetData]);

  const availableMonths = useMemo(
    () => [...new Set([...admRecordsAll, ...operationalRecordsAll].map(r => r.data))].filter(Boolean).sort(),
    [admRecordsAll, operationalRecordsAll]
  );

  const admRecords = useMemo(
    () => selectedMonth === 'all' ? admRecordsAll : admRecordsAll.filter(r => r.data === selectedMonth),
    [admRecordsAll, selectedMonth]
  );
  const operationalRecords = useMemo(
    () => selectedMonth === 'all' ? operationalRecordsAll : operationalRecordsAll.filter(r => r.data === selectedMonth),
    [operationalRecordsAll, selectedMonth]
  );

  const filtered = useMemo(() => {
    if (selectedUnit === 'all') return admRecords;
    return admRecords.filter(r => r.unidade === selectedUnit);
  }, [admRecords, selectedUnit]);

  // % Despesa ADM sobre Receita Total da Regional (operacional, sem ADM) — respeita filtro de mês
  const admVsRegional = useMemo(() => {
    const admByRegional = groupBy(admRecords, 'regional');
    const opByRegional = groupBy(operationalRecords, 'regional');
    const allRegionais = [...new Set([...Object.keys(admByRegional), ...Object.keys(opByRegional)])].sort();
    return allRegionais.map(reg => {
      const despesaAdm = (admByRegional[reg] || []).reduce((s, r) => s + r.despesaTotal, 0);
      const receitaRegional = (opByRegional[reg] || []).reduce((s, r) => s + r.receitaBruta, 0);
      const percent = receitaRegional > 0 ? (despesaAdm / receitaRegional) * 100 : 0;
      return { regional: reg, despesaAdm, receitaRegional, percent };
    });
  }, [admRecords, operationalRecords]);

  // Evolução mensal do % ADM/Receita Regional (todas regionais agregadas)
  const admVsRegionalMonthly = useMemo(() => {
    const admByMonth = groupBy(admRecordsAll, 'data');
    const opByMonth = groupBy(operationalRecordsAll, 'data');
    const allMonths = [...new Set([...Object.keys(admByMonth), ...Object.keys(opByMonth)])].sort();
    return allMonths.map(mes => {
      const despesaAdm = (admByMonth[mes] || []).reduce((s, r) => s + r.despesaTotal, 0);
      const receitaRegional = (opByMonth[mes] || []).reduce((s, r) => s + r.receitaBruta, 0);
      const percent = receitaRegional > 0 ? (despesaAdm / receitaRegional) * 100 : 0;
      return { mes, despesaAdm, receitaRegional, percent };
    });
  }, [admRecordsAll, operationalRecordsAll]);

  const availableUnits = useMemo(() => [...new Set(admRecordsAll.map(r => r.unidade))].sort(), [admRecordsAll]);

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
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px] bg-secondary border-border">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {availableMonths.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard title="Receita Total" value={metrics.receitaBruta} format="currency" icon={<DollarSign className="w-5 h-5" />} />
        <KpiCard title="Despesa Total" value={metrics.despesaTotal} format="currency" icon={<TrendingUp className="w-5 h-5" />} delay={0.1} />
        <KpiCard title="CMV" value={metrics.cmvPercent} format="percent" icon={<ShoppingCart className="w-5 h-5" />} delay={0.2} />
        <KpiCard title="Mão de Obra" value={metrics.maoDeObraPercent} format="percent" icon={<Users className="w-5 h-5" />} delay={0.3} />
        <KpiCard title="Margem (%)" value={margemAdm} format="percent" subtitle={`Meta: ${metrics.meta.toFixed(1)}%`} icon={<Percent className="w-5 h-5" />} delay={0.4} />
      </div>

      {/* % Despesa ADM sobre Receita Total da Regional */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="glass-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">% Despesa ADM / Receita Total da Regional</h3>
            <p className="text-xs text-muted-foreground mt-1">Fórmula: Despesa ADM ÷ Receita Total Operacional da Regional × 100</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {admVsRegional.map((item, i) => (
            <motion.div
              key={item.regional}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
              className="rounded-lg border border-border bg-secondary/40 p-4"
            >
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{item.regional}</p>
              <p className="text-2xl font-display font-bold mt-2">{formatPercent(item.percent)}</p>
              <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                <p>Despesa ADM: {formatCurrency(item.despesaAdm)}</p>
                <p>Receita Reg.: {formatCurrency(item.receitaRegional)}</p>
              </div>
            </motion.div>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={admVsRegional}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 18%)" />
            <XAxis dataKey="regional" tick={{ fill: 'hsl(215 20% 55%)', fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `${v.toFixed(1)}%`} tick={{ fill: 'hsl(215 20% 55%)', fontSize: 12 }} />
            <Tooltip
              contentStyle={{ backgroundColor: 'hsl(222 44% 9%)', border: '1px solid hsl(222 30% 18%)', borderRadius: '8px', color: 'hsl(210 40% 96%)' }}
              formatter={(v: number) => `${v.toFixed(2)}%`}
            />
            <Bar dataKey="percent" name="% ADM/Receita" fill="hsl(210 90% 60%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

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
