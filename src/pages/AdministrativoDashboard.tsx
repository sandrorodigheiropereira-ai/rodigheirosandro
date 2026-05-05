import { useState, useMemo } from 'react';
import { TrendingUp, Percent, AlertTriangle, AlertCircle, TrendingDown } from 'lucide-react';
import { KpiCard } from '@/components/KpiCard';
import { calcMetrics, groupBy, formatCurrency, formatPercent } from '@/lib/calculations';
import { useSheetData } from '@/hooks/useSheetData';
import { filterOnlyAdm, filterOutAdm, ADM_UNITS } from '@/lib/constants';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';

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

  // Mapeamento sigla ADM -> nome da regional operacional na planilha
  const ADM_TO_REGIONAL: Record<string, string> = {
    'ADM/ES': 'ESPIRITO SANTO',
    'ADM/TO': 'TOCANTINS',
    'ADM/GO': 'GOIAS',
    'ADM/PR': 'PARANA',
  };

  // Regional derivada da unidade ADM selecionada (ex.: ADM/ES -> ESPIRITO SANTO)
  const selectedRegional = useMemo(() => {
    if (selectedUnit === 'all') return null;
    return ADM_TO_REGIONAL[selectedUnit] || null;
  }, [selectedUnit]);

  // Evolução mensal do % ADM/Receita Regional
  // - Se uma unidade ADM estiver selecionada: filtra pela regional correspondente
  // - Caso contrário: todas as regionais agregadas
  const admVsRegionalMonthly = useMemo(() => {
    const admScope = selectedRegional
      ? admRecordsAll.filter(r => r.regional === selectedRegional)
      : admRecordsAll;
    const opScope = selectedRegional
      ? operationalRecordsAll.filter(r => r.regional === selectedRegional)
      : operationalRecordsAll;
    const admByMonth = groupBy(admScope, 'data');
    const opByMonth = groupBy(opScope, 'data');
    const allMonths = [...new Set([...Object.keys(admByMonth), ...Object.keys(opByMonth)])].sort();
    return allMonths.map(mes => {
      const despesaAdm = (admByMonth[mes] || []).reduce((s, r) => s + r.despesaTotal, 0);
      const receitaRegional = (opByMonth[mes] || []).reduce((s, r) => s + r.receitaBruta, 0);
      const percent = receitaRegional > 0 ? (despesaAdm / receitaRegional) * 100 : 0;
      return { mes, despesaAdm, receitaRegional, percent };
    });
  }, [admRecordsAll, operationalRecordsAll, selectedRegional]);

  // Alertas automáticos: limite excedido (atual) + piora do percentual mês a mês por regional
  const alerts = useMemo(() => {
    type AdmAlert = { type: 'danger' | 'warning'; regional: string; message: string; value: number };
    const out: AdmAlert[] = [];

    // 1) Limite excedido — snapshot atual (respeita filtro de mês e unidade)
    const scope = selectedRegional ? admVsRegional.filter(i => i.regional === selectedRegional) : admVsRegional;
    for (const item of scope) {
      if (item.percent > threshold) {
        out.push({
          type: 'danger',
          regional: item.regional,
          message: `% ADM/Receita acima do limite (${threshold.toFixed(1)}%): ${item.percent.toFixed(2)}%`,
          value: item.percent,
        });
      }
    }

    // 2) Piora mês a mês — comparando os 2 últimos meses disponíveis por regional
    const regionaisToCheck = selectedRegional
      ? [selectedRegional]
      : [...new Set(admRecordsAll.map(r => r.regional))];
    for (const reg of regionaisToCheck) {
      const adm = admRecordsAll.filter(r => r.regional === reg);
      const op = operationalRecordsAll.filter(r => r.regional === reg);
      const months = [...new Set([...adm.map(r => r.data), ...op.map(r => r.data)])].filter(Boolean).sort();
      if (months.length < 2) continue;
      const last = months[months.length - 1];
      const prev = months[months.length - 2];
      const pctOf = (mes: string) => {
        const desp = adm.filter(r => r.data === mes).reduce((s, r) => s + r.despesaTotal, 0);
        const rec = op.filter(r => r.data === mes).reduce((s, r) => s + r.receitaBruta, 0);
        return rec > 0 ? (desp / rec) * 100 : 0;
      };
      const pLast = pctOf(last);
      const pPrev = pctOf(prev);
      const delta = pLast - pPrev;
      if (delta > 1) {
        out.push({
          type: delta > 3 ? 'danger' : 'warning',
          regional: reg,
          message: `Piora mês a mês: ${prev} ${pPrev.toFixed(2)}% → ${last} ${pLast.toFixed(2)}% (+${delta.toFixed(2)} p.p.)`,
          value: delta,
        });
      }
    }
    return out;
  }, [admVsRegional, selectedRegional, threshold, admRecordsAll, operationalRecordsAll]);

  const availableUnits = useMemo(() => [...new Set(admRecordsAll.map(r => r.unidade))].sort(), [admRecordsAll]);

  const metrics = calcMetrics(filtered);

  // Receita Total (independente) — soma a receita bruta das unidades operacionais
  // das regionais correspondentes às ADMs presentes neste dashboard.
  // Respeita o filtro de mês e, se uma unidade ADM estiver selecionada, restringe à regional dela.
  // Este cálculo é isolado: NÃO compartilha estado com os demais dashboards.
  const receitaTotalRegionais = useMemo(() => {
    const regionaisAdm = selectedRegional
      ? [selectedRegional]
      : [...new Set(admRecords.map(r => r.regional))];
    return operationalRecords
      .filter(r => regionaisAdm.includes(r.regional))
      .reduce((s, r) => s + r.receitaBruta, 0);
  }, [operationalRecords, admRecords, selectedRegional]);

  // Margem (%) = Despesa Total ÷ Receita Total da Regional × 100
  const margemAdm = receitaTotalRegionais > 0
    ? (metrics.despesaTotal / receitaTotalRegionais) * 100
    : 0;

  // Receita Total por Unidade ADM — para cada unidade administrativa (ex: ADM/ES),
  // soma a receita bruta operacional da sua regional correspondente (ex: regional ES).
  // Cálculo independente — não compartilha estado com outros dashboards.
  const receitaPorUnidade = useMemo(() => {
    const admUnits = selectedUnit === 'all'
      ? [...new Set(admRecords.map(r => r.unidade))]
      : [selectedUnit];
    const opByRegional = groupBy(operationalRecords, 'regional');
    return admUnits
      .map(unidade => {
        const regional = ADM_TO_REGIONAL[unidade] || unidade;
        const receita = (opByRegional[regional] || []).reduce((s, r) => s + r.receitaBruta, 0);
        return { unidade, regional, receita };
      })
      .sort((a, b) => b.receita - a.receita);
  }, [operationalRecords, admRecords, selectedUnit]);

  const monthlyData = useMemo(() => {
    const byMonth = groupBy(filtered, 'data');
    // Receita da regional correspondente por mês (mesma lógica do KPI Margem)
    const regionaisAdmAll = selectedRegional
      ? [selectedRegional]
      : [...new Set(admRecordsAll.map(r => r.regional))];
    const opScope = operationalRecordsAll.filter(r => regionaisAdmAll.includes(r.regional));
    const opByMonth = groupBy(opScope, 'data');
    return Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, recs]) => {
      const m = calcMetrics(recs);
      const receitaRegMes = (opByMonth[month] || []).reduce((s, r) => s + r.receitaBruta, 0);
      const margem = receitaRegMes > 0 ? (m.despesaTotal / receitaRegMes) * 100 : 0;
      return { mes: month, receita: m.receitaBruta, despesa: m.despesaTotal, margem };
    });
  }, [filtered, admRecordsAll, operationalRecordsAll, selectedRegional]);

  const unitData = useMemo(() => {
    const byUnit = groupBy(filtered, 'unidade');
    return Object.entries(byUnit).map(([name, recs]) => ({
      unidade: name,
      maoDeObra: recs.reduce((s, r) => s + r.maoDeObra, 0),
      materiaPrima: recs.reduce((s, r) => s + r.materiaPrima, 0),
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
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="flex flex-col gap-1">
            <Label htmlFor="threshold" className="text-xs text-muted-foreground">Limite alerta (%)</Label>
            <Input
              id="threshold"
              type="number"
              min={0}
              step={0.5}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value) || 0)}
              className="w-[120px] bg-secondary border-border"
            />
          </div>
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

      {alerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl p-5 space-y-2"
        >
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            Alertas Automáticos ({alerts.length})
          </h3>
          <div className="space-y-2">
            {alerts.map((a, i) => {
              const Icon = a.type === 'danger' ? AlertCircle : TrendingDown;
              const colorBorder = a.type === 'danger' ? 'border-destructive/30 bg-destructive/5' : 'border-warning/30 bg-warning/5';
              const colorIcon = a.type === 'danger' ? 'text-destructive' : 'text-warning';
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${colorBorder}`}
                >
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${colorIcon}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Regional {a.regional}</p>
                    <p className="text-xs text-muted-foreground">{a.message}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard title="Receita Total" value={receitaTotalRegionais} format="currency" subtitle="\n" icon={<TrendingUp className="w-5 h-5" />} delay={0.05} />
        <KpiCard title="Despesa Total" value={metrics.despesaTotal} format="currency" icon={<TrendingUp className="w-5 h-5" />} delay={0.1} />
        <KpiCard title="Margem (%)" value={margemAdm} format="percent" subtitle="\n" icon={<Percent className="w-5 h-5" />} delay={0.2} />
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }} className="glass-card rounded-xl p-5">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Mão de Obra vs Matéria Prima</h3>
        {(() => {
          const pieData = [
            { name: 'Mão de Obra', value: filtered.reduce((s, r) => s + r.maoDeObra, 0) },
            { name: 'Matéria Prima', value: filtered.reduce((s, r) => s + r.materiaPrima, 0) },
          ];
          const total = pieData.reduce((s, d) => s + d.value, 0);
          const COLORS = ['hsl(210 90% 60%)', 'hsl(162 72% 46%)'];

          if (total <= 0) {
            return <p className="text-sm text-muted-foreground">Sem dados para o filtro atual.</p>;
          }
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={50}
                    paddingAngle={2}
                    isAnimationActive={false}
                  >
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} stroke="none" />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 p-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[i] }} />
                      <span className="text-sm font-medium">{d.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-display font-bold">{formatCurrency(d.value)}</p>
                      <p className="text-xs text-muted-foreground">{((d.value / total) * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">Total</span>
                  <span className="text-sm font-display font-bold">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 2ª camada: Variação % mês atual vs mês anterior */}
        {(() => {
          const scopeAll = selectedUnit === 'all' ? admRecordsAll : admRecordsAll.filter(r => r.unidade === selectedUnit);
          const monthsAvail = [...new Set(scopeAll.map(r => r.data))].filter(Boolean).sort();
          const refMonth = selectedMonth !== 'all' ? selectedMonth : monthsAvail[monthsAvail.length - 1];
          const refIdx = monthsAvail.indexOf(refMonth);
          const prevMonth = refIdx > 0 ? monthsAvail[refIdx - 1] : null;
          const sumBy = (mes: string | null, key: 'maoDeObra' | 'materiaPrima') =>
            mes ? scopeAll.filter(r => r.data === mes).reduce((s, r) => s + r[key], 0) : 0;
          const variations = [
            { name: 'Mão de Obra', color: 'hsl(210 90% 60%)', atual: sumBy(refMonth, 'maoDeObra'), anterior: sumBy(prevMonth, 'maoDeObra') },
            { name: 'Matéria Prima', color: 'hsl(162 72% 46%)', atual: sumBy(refMonth, 'materiaPrima'), anterior: sumBy(prevMonth, 'materiaPrima') },
          ].map(v => ({
            ...v,
            variacao: v.anterior > 0 ? ((v.atual - v.anterior) / v.anterior) * 100 : null,
          }));

          return (
            <div className="mt-5 pt-5 border-t border-border/60">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Variação Mês a Mês {refMonth ? `(${prevMonth ?? '—'} → ${refMonth})` : ''}
              </h4>
              {!prevMonth ? (
                <p className="text-sm text-muted-foreground">Sem mês anterior disponível para comparação.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {variations.map((v) => {
                    const isUp = v.variacao !== null && v.variacao > 0;
                    const isDown = v.variacao !== null && v.variacao < 0;
                    const trendColor = isUp ? 'text-destructive' : isDown ? 'text-success' : 'text-muted-foreground';
                    const TrendIcon = isUp ? TrendingUp : isDown ? TrendingDown : Percent;
                    return (
                      <div key={v.name} className="rounded-lg border border-border bg-secondary/40 p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: v.color }} />
                          <span className="text-sm font-medium">{v.name}</span>
                        </div>
                        <div className="flex items-end justify-between">
                          <div className="space-y-0.5">
                            <p className="text-[11px] text-muted-foreground">Anterior: {formatCurrency(v.anterior)}</p>
                            <p className="text-[11px] text-muted-foreground">Atual: {formatCurrency(v.atual)}</p>
                          </div>
                          <div className={`flex items-center gap-1 text-sm font-display font-bold ${trendColor}`}>
                            <TrendIcon className="w-4 h-4" />
                            <span>
                              {v.variacao === null ? '—' : `${v.variacao > 0 ? '+' : ''}${v.variacao.toFixed(1)}%`}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }} className="glass-card rounded-xl p-5">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Receita Total por Unidade ADM (regional correspondente)</h3>
        {receitaPorUnidade.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados para o filtro atual.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {receitaPorUnidade.map((u, i) => (
              <motion.div
                key={u.unidade}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.03 * i }}
                className="rounded-lg border border-border bg-secondary/40 p-3"
              >
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{u.regional}</p>
                <p className="text-sm font-medium mt-0.5">{u.unidade}</p>
                <p className="text-lg font-display font-bold mt-1">{formatCurrency(u.receita)}</p>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="glass-card rounded-xl p-5">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Evolução Mensal — Despesa vs Margem</h3>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 18%)" />
            <XAxis dataKey="mes" tick={{ fill: 'hsl(215 20% 55%)', fontSize: 12 }} />
            <YAxis yAxisId="left" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fill: 'hsl(215 20% 55%)', fontSize: 12 }} />
            <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v.toFixed(0)}%`} tick={{ fill: 'hsl(215 20% 55%)', fontSize: 12 }} />
            <Tooltip contentStyle={{ backgroundColor: 'hsl(222 44% 9%)', border: '1px solid hsl(222 30% 18%)', borderRadius: '8px', color: 'hsl(210 40% 96%)' }}
              formatter={(v: number, name: string) => name === 'margem' ? `${v.toFixed(1)}%` : formatCurrency(v)} />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="despesa" name="Despesa Total" stroke="hsl(210 90% 60%)" strokeWidth={2} dot={{ r: 4 }} />
            <Line yAxisId="right" type="monotone" dataKey="margem" name="Margem (%)" stroke="hsl(162 72% 46%)" strokeWidth={2} dot={{ r: 4 }} label={{ position: 'top', fill: 'hsl(162 72% 60%)', fontSize: 11, formatter: (v: number) => `${v.toFixed(1)}%` }} />
          </LineChart>
        </ResponsiveContainer>
      </motion.div>

      {/* % Despesa ADM sobre Receita Total da Regional */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="glass-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">% Despesa ADM / Receita Total da Regional</h3>
            <p className="text-xs text-muted-foreground mt-1">{"\n"}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {(selectedRegional ? admVsRegional.filter(i => i.regional === selectedRegional) : admVsRegional).map((item, i) => (
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
          <BarChart data={selectedRegional ? admVsRegional.filter(i => i.regional === selectedRegional) : admVsRegional}>
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

      {/* Evolução mensal do % ADM/Receita Regional */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.28 }} className="glass-card rounded-xl p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">% Despesa ADM / Receita Regional — Evolução Mensal</h3>
          <p className="text-xs text-muted-foreground mt-1">{"\n"}</p>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={admVsRegionalMonthly}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 18%)" />
            <XAxis dataKey="mes" tick={{ fill: 'hsl(215 20% 55%)', fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `${v.toFixed(1)}%`} tick={{ fill: 'hsl(215 20% 55%)', fontSize: 12 }} />
            <Tooltip
              contentStyle={{ backgroundColor: 'hsl(222 44% 9%)', border: '1px solid hsl(222 30% 18%)', borderRadius: '8px', color: 'hsl(210 40% 96%)' }}
              formatter={(v: number) => `${v.toFixed(2)}%`}
            />
            <Legend />
            <Line type="monotone" dataKey="percent" name="% ADM/Receita" stroke="hsl(210 90% 60%)" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="glass-card rounded-xl p-5">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Mão de Obra e Matéria Prima por Unidade ADM</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={unitData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 18%)" />
            <XAxis dataKey="unidade" tick={{ fill: 'hsl(215 20% 55%)', fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fill: 'hsl(215 20% 55%)', fontSize: 12 }} />
            <Tooltip contentStyle={{ backgroundColor: 'hsl(222 44% 9%)', border: '1px solid hsl(222 30% 18%)', borderRadius: '8px', color: 'hsl(210 40% 96%)' }}
              formatter={(v: number) => formatCurrency(v)} />
            <Legend />
            <Bar dataKey="maoDeObra" name="Mão de Obra" fill="hsl(210 90% 60%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="materiaPrima" name="Matéria Prima" fill="hsl(162 72% 46%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
}
