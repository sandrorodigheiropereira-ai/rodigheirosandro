import { useState, useMemo } from 'react';
import { TrendingUp, Percent, AlertTriangle, AlertCircle, TrendingDown, ShieldCheck, Building2 } from 'lucide-react';
import { KpiCard } from '@/components/KpiCard';
import { DonutChart } from '@/components/DonutChart';
import { calcMetrics, groupBy, formatCurrency, formatPercent } from '@/lib/calculations';
import { useSheetData } from '@/hooks/useSheetData';
import { filterOnlyAdm, filterOutAdm } from '@/lib/constants';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';

const ADM_TO_REGIONAL: Record<string, string> = {
  'ADM/ES': 'ESPIRITO SANTO',
  'ADM/TO': 'TOCANTINS',
  'ADM/GO': 'GOIAS',
  'ADM/PR': 'PARANA',
};

export default function AdministrativoDashboard() {
  const [selectedUnit, setSelectedUnit] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [threshold, setThreshold] = useState(15);
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

  const selectedRegional = useMemo(() => {
    if (selectedUnit === 'all') return null;
    return ADM_TO_REGIONAL[selectedUnit] || null;
  }, [selectedUnit]);

  const availableUnits = useMemo(() => [...new Set(admRecordsAll.map(r => r.unidade))].sort(), [admRecordsAll]);

  const metrics = calcMetrics(filtered);

  const receitaTotalRegionais = useMemo(() => {
    const regionaisAdm = selectedRegional
      ? [selectedRegional]
      : [...new Set(admRecords.map(r => r.regional))];
    return operationalRecords
      .filter(r => regionaisAdm.includes(r.regional))
      .reduce((s, r) => s + r.receitaBruta, 0);
  }, [operationalRecords, admRecords, selectedRegional]);

  const margemAdm = receitaTotalRegionais > 0
    ? (metrics.despesaTotal / receitaTotalRegionais) * 100
    : 0;

  // Semáforo por regional
  const admVsRegional = useMemo(() => {
    const admByRegional = groupBy(admRecords, 'regional');
    const opByRegional = groupBy(operationalRecords, 'regional');
    const allRegionais = [...new Set([...Object.keys(admByRegional), ...Object.keys(opByRegional)])].sort();
    return allRegionais.map(reg => {
      const despesaAdm = (admByRegional[reg] || []).reduce((s, r) => s + r.despesaTotal, 0);
      const receitaRegional = (opByRegional[reg] || []).reduce((s, r) => s + r.receitaBruta, 0);
      const percent = receitaRegional > 0 ? (despesaAdm / receitaRegional) * 100 : 0;
      const grade = percent > threshold ? 'danger' : percent > threshold * 0.8 ? 'warning' : 'ok';
      // Variação mês a mês
      const months = availableMonths;
      const last = months[months.length - 1];
      const prev = months.length > 1 ? months[months.length - 2] : null;
      const pctOf = (mes: string) => {
        const desp = admRecordsAll.filter(r => r.regional === reg && r.data === mes).reduce((s, r) => s + r.despesaTotal, 0);
        const rec = operationalRecordsAll.filter(r => r.regional === reg && r.data === mes).reduce((s, r) => s + r.receitaBruta, 0);
        return rec > 0 ? (desp / rec) * 100 : 0;
      };
      const deltaVsMes = prev ? pctOf(last) - pctOf(prev) : null;
      return { regional: reg, despesaAdm, receitaRegional, percent, grade, deltaVsMes };
    }).filter(r => selectedRegional ? r.regional === selectedRegional : true);
  }, [admRecords, operationalRecords, threshold, availableMonths, admRecordsAll, operationalRecordsAll, selectedRegional]);

  // Sparklines para KPIs
  const sparklines = useMemo(() => {
    const admScope = selectedRegional
      ? admRecordsAll.filter(r => r.regional === selectedRegional)
      : admRecordsAll;
    const opScope = selectedRegional
      ? operationalRecordsAll.filter(r => r.regional === selectedRegional)
      : operationalRecordsAll;
    const byMonth = groupBy(admScope, 'data');
    const opByMonth = groupBy(opScope, 'data');
    const months = availableMonths;
    const despesa = months.map(m => (byMonth[m] || []).reduce((s, r) => s + r.despesaTotal, 0));
    const receita = months.map(m => (opByMonth[m] || []).reduce((s, r) => s + r.receitaBruta, 0));
    const pct = months.map((m, i) => receita[i] > 0 ? (despesa[i] / receita[i]) * 100 : 0);
    return { despesa, receita, pct };
  }, [admRecordsAll, operationalRecordsAll, availableMonths, selectedRegional]);

  // Evolução mensal do % ADM/Receita Regional
  const admVsRegionalMonthly = useMemo(() => {
    const admScope = selectedRegional
      ? admRecordsAll.filter(r => r.regional === selectedRegional)
      : admRecordsAll;
    const opScope = selectedRegional
      ? operationalRecordsAll.filter(r => r.regional === selectedRegional)
      : operationalRecordsAll;
    const admByMonth = groupBy(admScope, 'data');
    const opByMonth = groupBy(opScope, 'data');
    return availableMonths.map(mes => {
      const despesaAdm = (admByMonth[mes] || []).reduce((s, r) => s + r.despesaTotal, 0);
      const receitaRegional = (opByMonth[mes] || []).reduce((s, r) => s + r.receitaBruta, 0);
      const percent = receitaRegional > 0 ? (despesaAdm / receitaRegional) * 100 : 0;
      return { mes, despesaAdm, receitaRegional, percent };
    });
  }, [admRecordsAll, operationalRecordsAll, availableMonths, selectedRegional]);

  // Tabela comparativa por unidade ADM
  const tabelaComparativa = useMemo(() => {
    const admUnits = selectedUnit === 'all'
      ? [...new Set(admRecords.map(r => r.unidade))]
      : [selectedUnit];
    const opByRegional = groupBy(operationalRecords, 'regional');
    return admUnits.map(unidade => {
      const regional = ADM_TO_REGIONAL[unidade] || unidade;
      const recs = admRecords.filter(r => r.unidade === unidade);
      const despesa = recs.reduce((s, r) => s + r.despesaTotal, 0);
      const receita = (opByRegional[regional] || []).reduce((s, r) => s + r.receitaBruta, 0);
      const pct = receita > 0 ? (despesa / receita) * 100 : 0;
      const mdo = recs.reduce((s, r) => s + r.maoDeObra, 0);
      const mp = recs.reduce((s, r) => s + r.materiaPrima, 0);
      const grade = pct > threshold ? 'danger' : pct > threshold * 0.8 ? 'warning' : 'ok';
      return { unidade, regional, despesa, receita, pct, mdo, mp, grade };
    }).sort((a, b) => b.pct - a.pct);
  }, [admRecords, operationalRecords, selectedUnit, threshold]);

  // Alertas
  const alerts = useMemo(() => {
    type AdmAlert = { type: 'danger' | 'warning'; regional: string; message: string };
    const out: AdmAlert[] = [];
    const scope = selectedRegional ? admVsRegional.filter(i => i.regional === selectedRegional) : admVsRegional;
    for (const item of scope) {
      if (item.percent > threshold) {
        out.push({ type: 'danger', regional: item.regional, message: `% ADM/Receita acima do limite (${threshold.toFixed(1)}%): ${item.percent.toFixed(2)}%` });
      }
      if (item.deltaVsMes !== null && item.deltaVsMes > 1) {
        out.push({ type: item.deltaVsMes > 3 ? 'danger' : 'warning', regional: item.regional, message: `Piora mês a mês: +${item.deltaVsMes.toFixed(2)} p.p.` });
      }
    }
    return out;
  }, [admVsRegional, threshold, selectedRegional]);

  // Donut items
  const donutItems = useMemo(() => {
    const months = availableMonths;
    const refMonth = selectedMonth !== 'all' ? selectedMonth : months[months.length - 1];
    const refIdx = months.indexOf(refMonth);
    const prevMonth = refIdx > 0 ? months[refIdx - 1] : null;
    const sum = (mes: string | null, key: 'maoDeObra' | 'materiaPrima' | 'impostos') =>
      mes ? filtered.filter(r => r.data === mes).reduce((s, r) => s + r[key], 0) : undefined;
    return [
      { name: 'Mão de Obra', value: filtered.reduce((s, r) => s + r.maoDeObra, 0), prevValue: sum(prevMonth, 'maoDeObra'), color: '#378ADD' },
      { name: 'Matéria Prima', value: filtered.reduce((s, r) => s + r.materiaPrima, 0), prevValue: sum(prevMonth, 'materiaPrima'), color: '#1D9E75' },
      { name: 'Impostos', value: filtered.reduce((s, r) => s + r.impostos, 0), prevValue: sum(prevMonth, 'impostos'), color: '#EF9F27' },
    ];
  }, [filtered, availableMonths, selectedMonth]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (error) {
    return <div className="flex items-center justify-center h-64"><p className="text-destructive font-semibold">Erro ao carregar dados.</p></div>;
  }

  const gradeColor = (grade: string) =>
    grade === 'danger' ? 'border-danger/30 bg-danger/5 text-danger' :
    grade === 'warning' ? 'border-warning/30 bg-warning/5 text-warning' :
    'border-success/30 bg-success/5 text-success';

  const gradeBarColor = (grade: string) =>
    grade === 'danger' ? 'bg-danger' : grade === 'warning' ? 'bg-warning' : 'bg-success';

  return (
    <div className="space-y-6">

      {/* Header + Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Dashboard Administrativo</h1>
          <p className="text-sm text-muted-foreground">Custo ADM vs Receita das Regionais</p>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1">
            <Label htmlFor="threshold" className="text-xs text-muted-foreground">Limite alerta (%)</Label>
            <Input id="threshold" type="number" min={0} step={0.5} value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value) || 0)}
              className="w-[110px] bg-secondary border-border" />
          </div>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[160px] bg-secondary border-border"><SelectValue placeholder="Mês" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {availableMonths.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedUnit} onValueChange={setSelectedUnit}>
            <SelectTrigger className="w-[160px] bg-secondary border-border"><SelectValue placeholder="Unidade ADM" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas ADMs</SelectItem>
              {availableUnits.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Alertas */}
      {alerts.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5 space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            Alertas Automáticos ({alerts.length})
          </h3>
          <div className="space-y-2">
            {alerts.map((a, i) => {
              const Icon = a.type === 'danger' ? AlertCircle : TrendingDown;
              return (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${a.type === 'danger' ? 'border-danger/30 bg-danger/5' : 'border-warning/30 bg-warning/5'}`}>
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${a.type === 'danger' ? 'text-danger' : 'text-warning'}`} />
                  <div>
                    <p className="text-sm font-medium">Regional {a.regional}</p>
                    <p className="text-xs text-muted-foreground">{a.message}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="% ADM / Receita" value={margemAdm} format="percent" subtitle={`Limite: ${threshold}%`} icon={<Percent className="w-5 h-5" />} delay={0} sparkline={sparklines.pct} invertTrend />
        <KpiCard title="Despesa ADM Total" value={metrics.despesaTotal} format="currency" icon={<TrendingUp className="w-5 h-5" />} delay={0.08} sparkline={sparklines.despesa} invertTrend />
        <KpiCard title="Receita das Regionais" value={receitaTotalRegionais} format="currency" icon={<TrendingUp className="w-5 h-5" />} delay={0.12} sparkline={sparklines.receita} />
        <KpiCard title="Unidades ADM" value={availableUnits.length} format="number" icon={<Building2 className="w-5 h-5" />} delay={0.16} />
      </div>

      {/* Semáforo por regional */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="glass-card rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Saúde ADM por Regional</h3>
          <div className="flex items-center gap-2 text-[10px] font-semibold">
            <span className="px-2 py-0.5 rounded-full bg-success/10 text-success">OK ≤ {(threshold * 0.8).toFixed(0)}%</span>
            <span className="px-2 py-0.5 rounded-full bg-warning/10 text-warning">Atenção ≤ {threshold}%</span>
            <span className="px-2 py-0.5 rounded-full bg-danger/10 text-danger">Crítico &gt; {threshold}%</span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {admVsRegional.map((item, i) => (
            <motion.div key={item.regional} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}
              className={`rounded-xl border p-4 ${gradeColor(item.grade)}`}>
              <p className="text-xs font-semibold uppercase tracking-wider opacity-80">{item.regional}</p>
              <p className="text-3xl font-display font-bold mt-2">{formatPercent(item.percent)}</p>
              <div className="mt-3 space-y-1">
                <div className="w-full h-1.5 rounded-full bg-black/10">
                  <div className={`h-1.5 rounded-full ${gradeBarColor(item.grade)}`}
                    style={{ width: `${Math.min(100, (item.percent / (threshold * 1.5)) * 100)}%` }} />
                </div>
                <div className="flex justify-between text-[10px] opacity-70">
                  <span>Despesa: {formatCurrency(item.despesaAdm)}</span>
                  {item.deltaVsMes !== null && (
                    <span>{item.deltaVsMes > 0 ? '+' : ''}{item.deltaVsMes.toFixed(1)}pp</span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Grid: Evolução + Rosca */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Evolução % ADM/Receita */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="glass-card rounded-xl p-5">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Evolução % ADM / Receita Regional
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={admVsRegionalMonthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 18%)" />
              <XAxis dataKey="mes" tick={{ fill: 'hsl(215 20% 55%)', fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `${v.toFixed(1)}%`} tick={{ fill: 'hsl(215 20% 55%)', fontSize: 11 }} width={40} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(222 44% 9%)', border: '1px solid hsl(222 30% 18%)', borderRadius: '8px', color: 'hsl(210 40% 96%)', fontSize: 12 }}
                formatter={(v: number) => `${v.toFixed(2)}%`}
              />
              <ReferenceLine y={threshold} stroke="#E24B4A" strokeDasharray="5 3" label={{ value: `Limite ${threshold}%`, fill: '#E24B4A', fontSize: 10, position: 'right' }} />
              <Line type="monotone" dataKey="percent" name="% ADM/Receita" stroke="#378ADD" strokeWidth={2}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  const color = payload.percent > threshold ? '#E24B4A' : payload.percent > threshold * 0.8 ? '#EF9F27' : '#1D9E75';
                  return <circle key={cx} cx={cx} cy={cy} r={4} fill={color} stroke="none" />;
                }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Composição de custos ADM */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.28 }}>
          <DonutChart title="Composição de Custos ADM" items={donutItems} />
        </motion.div>

      </div>

      {/* Tabela comparativa */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.32 }} className="glass-card rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Comparativo por Unidade ADM
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 pb-3 font-semibold text-muted-foreground uppercase tracking-wider">Unidade</th>
                <th className="text-left p-3 pb-3 font-semibold text-muted-foreground uppercase tracking-wider">Regional</th>
                <th className="text-right p-3 pb-3 font-semibold text-muted-foreground uppercase tracking-wider">Despesa ADM</th>
                <th className="text-right p-3 pb-3 font-semibold text-muted-foreground uppercase tracking-wider">Receita Regional</th>
                <th className="text-center p-3 pb-3 font-semibold text-muted-foreground uppercase tracking-wider">% ADM/Rec.</th>
                <th className="text-right p-3 pb-3 font-semibold text-muted-foreground uppercase tracking-wider">Mão de Obra</th>
                <th className="text-right p-3 pb-3 font-semibold text-muted-foreground uppercase tracking-wider">Mat. Prima</th>
              </tr>
            </thead>
            <tbody>
              {tabelaComparativa.map((row, i) => (
                <tr key={row.unidade} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="p-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${gradeBarColor(row.grade)}`} />
                      <span className="font-medium">{row.unidade}</span>
                    </div>
                  </td>
                  <td className="p-3 py-3 text-muted-foreground">{row.regional}</td>
                  <td className="p-3 py-3 text-right text-muted-foreground">{formatCurrency(row.despesa)}</td>
                  <td className="p-3 py-3 text-right text-muted-foreground">{formatCurrency(row.receita)}</td>
                  <td className="p-3 py-3 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`text-sm font-bold ${row.grade === 'danger' ? 'text-danger' : row.grade === 'warning' ? 'text-warning' : 'text-success'}`}>
                        {formatPercent(row.pct)}
                      </span>
                      <div className="w-16 h-1 rounded-full bg-secondary">
                        <div className={`h-1 rounded-full ${gradeBarColor(row.grade)}`}
                          style={{ width: `${Math.min(100, (row.pct / (threshold * 1.5)) * 100)}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="p-3 py-3 text-right text-muted-foreground">{formatCurrency(row.mdo)}</td>
                  <td className="p-3 py-3 text-right text-muted-foreground">{formatCurrency(row.mp)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-secondary/30">
                <td colSpan={2} className="p-3 font-semibold text-muted-foreground">Total</td>
                <td className="p-3 text-right font-semibold">{formatCurrency(tabelaComparativa.reduce((s, r) => s + r.despesa, 0))}</td>
                <td className="p-3 text-right font-semibold">{formatCurrency(tabelaComparativa.reduce((s, r) => s + r.receita, 0))}</td>
                <td className="p-3 text-center font-bold text-primary">{formatPercent(margemAdm)}</td>
                <td className="p-3 text-right font-semibold">{formatCurrency(tabelaComparativa.reduce((s, r) => s + r.mdo, 0))}</td>
                <td className="p-3 text-right font-semibold">{formatCurrency(tabelaComparativa.reduce((s, r) => s + r.mp, 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </motion.div>

    </div>
  );
}
