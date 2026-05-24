import { useState, useMemo } from 'react';
import { Users, TrendingUp, Clock, AlertTriangle, ShieldCheck, Percent } from 'lucide-react';
import { useRhData } from '@/hooks/useRhData';
import { RhRecord } from '@/types/financial';
import { formatCurrency, formatPercent, groupBy } from '@/lib/calculations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar, LabelList } from 'recharts';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from '@/components/KpiCard';

function groupByKey<T>(arr: T[], key: keyof T): Record<string, T[]> {
  const map: Record<string, T[]> = {};
  for (const item of arr) {
    const k = String(item[key] ?? '');
    if (!map[k]) map[k] = [];
    map[k].push(item);
  }
  return map;
}

export default function RhDashboard() {
  const { data: rhData, isLoading, error } = useRhData();
  const [regional, setRegional] = useState('all');
  const [periodo, setPeriodo] = useState('all');

  const allRecords = useMemo(() => rhData?.data || [], [rhData]);
  const regionais = useMemo(() => rhData?.regionais || [], [rhData]);
  const meses = useMemo(() => [...new Set(allRecords.map(r => r.data))].filter(Boolean).sort(), [allRecords]);

  const filtered = useMemo(() => {
    let data = allRecords;
    if (regional !== 'all') data = data.filter(r => r.regional === regional);
    if (periodo !== 'all') data = data.filter(r => r.data === periodo);
    return data;
  }, [allRecords, regional, periodo]);

  // KPIs
  const totalMdo = filtered.reduce((s, r) => s + r.maoDeObra, 0);
  const totalEncargos = filtered.reduce((s, r) => s + r.encargosSociais, 0);
  const totalFuncionarios = filtered.reduce((s, r) => s + r.numFuncionarios, 0);
  const totalHoraExtra = filtered.reduce((s, r) => s + r.horaExtra, 0);
  const avgPctMdo = filtered.length > 0
    ? filtered.reduce((s, r) => s + r.percentualMdo, 0) / filtered.length
    : 0;
  const avgMeta = filtered.filter(r => r.metaPercentual > 0).reduce((s, r) => s + r.metaPercentual, 0) /
    Math.max(1, filtered.filter(r => r.metaPercentual > 0).length);

  // Sparklines mensais
  const sparklines = useMemo(() => {
    const scope = regional !== 'all' ? allRecords.filter(r => r.regional === regional) : allRecords;
    const byMonth = groupByKey(scope, 'data');
    const months = meses;
    return {
      mdo: months.map(m => (byMonth[m] || []).reduce((s, r) => s + r.maoDeObra, 0)),
      pct: months.map(m => {
        const recs = byMonth[m] || [];
        return recs.length > 0 ? recs.reduce((s, r) => s + r.percentualMdo, 0) / recs.length : 0;
      }),
      func: months.map(m => (byMonth[m] || []).reduce((s, r) => s + r.numFuncionarios, 0)),
      he: months.map(m => (byMonth[m] || []).reduce((s, r) => s + r.horaExtra, 0)),
    };
  }, [allRecords, meses, regional]);

  // Evolução mensal
  const monthlyData = useMemo(() => {
    const scope = regional !== 'all' ? allRecords.filter(r => r.regional === regional) : allRecords;
    const byMonth = groupByKey(scope, 'data');
    return meses.map(mes => {
      const recs = byMonth[mes] || [];
      const pct = recs.length > 0 ? recs.reduce((s, r) => s + r.percentualMdo, 0) / recs.length : 0;
      const meta = recs.filter(r => r.metaPercentual > 0);
      const metaAvg = meta.length > 0 ? meta.reduce((s, r) => s + r.metaPercentual, 0) / meta.length : 0;
      const func = recs.reduce((s, r) => s + r.numFuncionarios, 0);
      const he = recs.reduce((s, r) => s + r.horaExtra, 0);
      return { mes, pct, meta: metaAvg, func, he };
    });
  }, [allRecords, meses, regional]);

  // Ranking por unidade
  const rankingUnidades = useMemo(() => {
    const byUnidade = groupByKey(filtered, 'unidade');
    return Object.entries(byUnidade).map(([unidade, recs]) => {
      const mdo = recs.reduce((s, r) => s + r.maoDeObra, 0);
      const encargos = recs.reduce((s, r) => s + r.encargosSociais, 0);
      const func = recs.reduce((s, r) => s + r.numFuncionarios, 0);
      const he = recs.reduce((s, r) => s + r.horaExtra, 0);
      const pct = recs.reduce((s, r) => s + r.percentualMdo, 0) / recs.length;
      const meta = recs.filter(r => r.metaPercentual > 0);
      const metaAvg = meta.length > 0 ? meta.reduce((s, r) => s + r.metaPercentual, 0) / meta.length : 0;
      const custoPorFunc = func > 0 ? (mdo + encargos) / func : 0;
      const regional = recs[0]?.regional ?? '';
      const grade = metaAvg > 0
        ? pct > metaAvg * 1.1 ? 'danger' : pct > metaAvg ? 'warning' : 'ok'
        : pct > 35 ? 'danger' : pct > 30 ? 'warning' : 'ok';
      return { unidade, regional, mdo, encargos, func, he, pct, metaAvg, custoPorFunc, grade };
    }).sort((a, b) => b.pct - a.pct);
  }, [filtered]);

  // Top hora extra
  const topHoraExtra = useMemo(() =>
    [...rankingUnidades].sort((a, b) => b.he - a.he).slice(0, 8),
    [rankingUnidades]
  );

  const maxHe = topHoraExtra[0]?.he ?? 1;

  const gradeColor = (grade: string) =>
    grade === 'danger' ? 'text-danger' : grade === 'warning' ? 'text-warning' : 'text-success';
  const gradeBg = (grade: string) =>
    grade === 'danger' ? 'bg-danger/5 border-danger/20' : grade === 'warning' ? 'bg-warning/5 border-warning/20' : 'bg-success/5 border-success/20';
  const gradeBar = (grade: string) =>
    grade === 'danger' ? 'bg-danger' : grade === 'warning' ? 'bg-warning' : 'bg-success';

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive font-semibold">Erro ao carregar dados de RH: {(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Dashboard de Pessoas</h1>
          <p className="text-sm text-muted-foreground">Mão de Obra, Encargos e Headcount por unidade</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[160px] bg-secondary border-border"><SelectValue placeholder="Período" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {meses.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={regional} onValueChange={setRegional}>
            <SelectTrigger className="w-[170px] bg-secondary border-border"><SelectValue placeholder="Regional" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as regionais</SelectItem>
              {regionais.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Custo Total MdO" value={totalMdo} format="currency" icon={<TrendingUp className="w-5 h-5" />} delay={0} sparkline={sparklines.mdo} invertTrend />
        <KpiCard title="% MdO Médio" value={avgPctMdo} format="percent" subtitle={`Meta: ${avgMeta.toFixed(1)}%`} icon={<Percent className="w-5 h-5" />} delay={0.08} sparkline={sparklines.pct} invertTrend />
        <KpiCard title="Total Funcionários" value={totalFuncionarios} format="number" icon={<Users className="w-5 h-5" />} delay={0.16} sparkline={sparklines.func} />
        <KpiCard title="Custo Hora Extra" value={totalHoraExtra} format="currency" icon={<Clock className="w-5 h-5" />} delay={0.24} sparkline={sparklines.he} invertTrend />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Evolução % MdO vs Meta */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="glass-card rounded-xl p-5">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Evolução % MdO vs Meta
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={monthlyData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 18%)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: 'hsl(215 20% 55%)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `${v.toFixed(0)}%`} tick={{ fill: 'hsl(215 20% 55%)', fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(222 44% 9%)', border: '1px solid hsl(222 30% 18%)', borderRadius: '8px', color: 'hsl(210 40% 96%)', fontSize: 12 }}
                formatter={(v: number) => `${v.toFixed(1)}%`}
              />
              <Line type="monotone" dataKey="pct" name="% MdO" stroke="#378ADD" strokeWidth={2.5}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  const color = payload.meta > 0 && payload.pct > payload.meta ? '#E24B4A' : payload.pct > 30 ? '#EF9F27' : '#1D9E75';
                  return <circle key={cx} cx={cx} cy={cy} r={4} fill={color} stroke="none" />;
                }}
                activeDot={{ r: 6 }}
              />
              <Line type="monotone" dataKey="meta" name="Meta" stroke="#EF9F27" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Hora extra por unidade */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="glass-card rounded-xl p-5">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Top Hora Extra por Unidade
          </h3>
          <div className="space-y-2.5">
            {topHoraExtra.map((u, i) => (
              <div key={u.unidade}>
                <div className="flex items-center justify-between mb-1 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold text-muted-foreground w-4">{i + 1}</span>
                    <span className="text-xs font-medium truncate">{u.unidade}</span>
                    <span className="text-[10px] text-muted-foreground/60 shrink-0">{u.regional}</span>
                  </div>
                  <span className="text-xs font-semibold text-warning shrink-0">{formatCurrency(u.he)}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-secondary">
                  <div className="h-1.5 rounded-full bg-warning" style={{ width: `${(u.he / maxHe) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

      </div>

      {/* Ranking por unidade */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="glass-card rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Ranking por % MdO — todas as unidades
          </h3>
          <div className="flex items-center gap-2 text-[10px] font-semibold">
            <span className="px-2 py-0.5 rounded-full bg-success/10 text-success">✓ Dentro da meta</span>
            <span className="px-2 py-0.5 rounded-full bg-warning/10 text-warning">⚠ Acima da meta</span>
            <span className="px-2 py-0.5 rounded-full bg-danger/10 text-danger">✗ Crítico</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-2 pb-3 font-semibold text-muted-foreground uppercase tracking-wider">#</th>
                <th className="text-left p-2 pb-3 font-semibold text-muted-foreground uppercase tracking-wider">Unidade</th>
                <th className="text-left p-2 pb-3 font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Regional</th>
                <th className="text-right p-2 pb-3 font-semibold text-muted-foreground uppercase tracking-wider">% MdO</th>
                <th className="text-right p-2 pb-3 font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Meta</th>
                <th className="text-right p-2 pb-3 font-semibold text-muted-foreground uppercase tracking-wider">Custo MdO</th>
                <th className="text-right p-2 pb-3 font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Encargos</th>
                <th className="text-right p-2 pb-3 font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Funcionários</th>
                <th className="text-right p-2 pb-3 font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Custo/Func</th>
                <th className="text-right p-2 pb-3 font-semibold text-muted-foreground uppercase tracking-wider">Hora Extra</th>
              </tr>
            </thead>
            <tbody>
              {rankingUnidades.map((u, i) => (
                <tr key={u.unidade} className={`border-b border-border/50 hover:bg-secondary/30 transition-colors`}>
                  <td className="p-2 py-3 text-muted-foreground font-medium">{i + 1}</td>
                  <td className="p-2 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${gradeBar(u.grade)}`} />
                      <span className="font-medium">{u.unidade}</span>
                    </div>
                    <div className="w-24 h-1 rounded-full bg-secondary mt-1.5">
                      <div className={`h-1 rounded-full ${gradeBar(u.grade)}`} style={{ width: `${Math.min(100, u.pct)}%` }} />
                    </div>
                  </td>
                  <td className="p-2 py-3 text-muted-foreground hidden sm:table-cell">{u.regional}</td>
                  <td className={`p-2 py-3 text-right font-bold ${gradeColor(u.grade)}`}>{formatPercent(u.pct)}</td>
                  <td className="p-2 py-3 text-right text-muted-foreground hidden md:table-cell">
                    {u.metaAvg > 0 ? formatPercent(u.metaAvg) : '—'}
                  </td>
                  <td className="p-2 py-3 text-right text-muted-foreground">{formatCurrency(u.mdo)}</td>
                  <td className="p-2 py-3 text-right text-muted-foreground hidden lg:table-cell">{formatCurrency(u.encargos)}</td>
                  <td className="p-2 py-3 text-right text-muted-foreground hidden lg:table-cell">
                    {u.func > 0 ? u.func.toFixed(0) : '—'}
                  </td>
                  <td className="p-2 py-3 text-right text-muted-foreground hidden md:table-cell">
                    {u.custoPorFunc > 0 ? formatCurrency(u.custoPorFunc) : '—'}
                  </td>
                  <td className={`p-2 py-3 text-right font-medium ${u.he > 0 ? 'text-warning' : 'text-muted-foreground'}`}>
                    {u.he > 0 ? formatCurrency(u.he) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-secondary/30">
                <td colSpan={3} className="p-2 font-semibold text-muted-foreground">Total</td>
                <td className="p-2 text-right font-bold">{formatPercent(avgPctMdo)}</td>
                <td className="p-2 text-right text-muted-foreground hidden md:table-cell">{avgMeta > 0 ? formatPercent(avgMeta) : '—'}</td>
                <td className="p-2 text-right font-semibold">{formatCurrency(totalMdo)}</td>
                <td className="p-2 text-right font-semibold hidden lg:table-cell">{formatCurrency(totalEncargos)}</td>
                <td className="p-2 text-right font-semibold hidden lg:table-cell">{totalFuncionarios.toFixed(0)}</td>
                <td className="p-2 text-right hidden md:table-cell">—</td>
                <td className="p-2 text-right font-semibold text-warning">{totalHoraExtra > 0 ? formatCurrency(totalHoraExtra) : '—'}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </motion.div>

    </div>
  );
}
