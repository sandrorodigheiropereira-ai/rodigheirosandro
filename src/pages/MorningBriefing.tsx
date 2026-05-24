import { useMemo, useState } from 'react';
import { useSheetData, getRegionaisFromData } from '@/hooks/useSheetData';
import { useRhData } from '@/hooks/useRhData';
import { calcMetrics, generateAlerts, groupBy, formatCurrency, formatPercent, rankUnidades, calcHealthScores, HealthScore } from '@/lib/calculations';
import { filterOutAdm } from '@/lib/constants';
import { AlertCircle, AlertTriangle, TrendingUp, TrendingDown, ShieldCheck, Sun, Zap, Users, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

interface RegionalItem {
  regional: string;
  receita: number;
  margem: number;
  cmvPercent: number;
  avgScore: number;
  unidades: any[];
}

function RegionalRankingRow({ reg, ri, lastMonthRecords, formatCurrency, formatPercent }: {
  reg: RegionalItem; ri: number; lastMonthRecords: any[]; formatCurrency: (v: number) => string; formatPercent: (v: number) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const scoreColor = reg.avgScore >= 80 ? 'text-success' : reg.avgScore >= 50 ? 'text-warning' : 'text-danger';
  const scoreBg = reg.avgScore >= 80 ? 'bg-success' : reg.avgScore >= 50 ? 'bg-warning' : 'bg-danger';
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 p-4 hover:bg-secondary/50 transition-colors text-left"
      >
        <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">{ri + 1}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm font-semibold">{reg.regional}</span>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-muted-foreground">{formatCurrency(reg.receita)}</span>
              <span className={`text-xs font-medium ${reg.margem < 0 ? 'text-danger' : reg.margem < 5 ? 'text-warning' : 'text-success'}`}>
                {formatPercent(reg.margem)}
              </span>
              <span className={`text-sm font-bold ${scoreColor}`}>{reg.avgScore}</span>
            </div>
          </div>
          <div className="w-full h-1.5 rounded-full bg-secondary">
            <div className={`h-1.5 rounded-full ${scoreBg}`} style={{ width: `${reg.avgScore}%` }} />
          </div>
        </div>
        <span className="text-muted-foreground text-xs shrink-0">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="border-t border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-secondary/50">
                <th className="text-left p-2 pl-4 font-medium text-muted-foreground">#</th>
                <th className="text-left p-2 font-medium text-muted-foreground">Unidade</th>
                <th className="text-right p-2 font-medium text-muted-foreground">Score</th>
                <th className="text-right p-2 font-medium text-muted-foreground">Receita</th>
                <th className="text-right p-2 font-medium text-muted-foreground">Margem</th>
                <th className="text-right p-2 pr-4 font-medium text-muted-foreground">CMV</th>
              </tr>
            </thead>
            <tbody>
              {reg.unidades.map((u, ui) => {
                const uc = u.grade === 'green' ? 'text-success' : u.grade === 'yellow' ? 'text-warning' : 'text-danger';
                return (
                  <tr key={u.unidade} className="border-t border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="p-2 pl-4 text-muted-foreground font-medium">{ui + 1}</td>
                    <td className="p-2 font-medium">{u.unidade}</td>
                    <td className={`p-2 text-right font-bold ${uc}`}>{u.score}</td>
                    <td className="p-2 text-right text-muted-foreground">{formatCurrency(lastMonthRecords.filter((r: any) => r.unidade === u.unidade).reduce((s: number, r: any) => s + r.receitaBruta, 0))}</td>
                    <td className={`p-2 text-right font-medium ${u.metrics.margem < 0 ? 'text-danger' : u.metrics.margem < 5 ? 'text-warning' : 'text-success'}`}>
                      {formatPercent(u.metrics.margem)}
                    </td>
                    <td className={`p-2 pr-4 text-right font-medium ${u.metrics.cmvPercent > 50 ? 'text-danger' : u.metrics.cmvPercent > 40 ? 'text-warning' : 'text-success'}`}>
                      {formatPercent(u.metrics.cmvPercent)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RegionalRankingList({ rankingRegional, lastMonthRecords, formatCurrency, formatPercent }: {
  rankingRegional: RegionalItem[]; lastMonthRecords: any[]; formatCurrency: (v: number) => string; formatPercent: (v: number) => string;
}) {
  return (
    <div className="space-y-3">
      {rankingRegional.map((reg, ri) => (
        <RegionalRankingRow key={reg.regional} reg={reg} ri={ri} lastMonthRecords={lastMonthRecords} formatCurrency={formatCurrency} formatPercent={formatPercent} />
      ))}
    </div>
  );
}

export default function MorningBriefing() {
  const { data: sheetData, isLoading } = useSheetData();
  const { data: rhData } = useRhData();
  const allRecords = useMemo(() => filterOutAdm(sheetData?.data || []), [sheetData]);
  const regionais = useMemo(() => getRegionaisFromData(allRecords), [allRecords]);

  const months = useMemo(() =>
    [...new Set(allRecords.map(r => r.data))].filter(Boolean).sort(),
    [allRecords]
  );
  const lastMonth = months[months.length - 1];
  const prevMonth = months.length >= 2 ? months[months.length - 2] : null;

  const lastMonthRecords = useMemo(() =>
    allRecords.filter(r => r.data === lastMonth),
    [allRecords, lastMonth]
  );
  const prevMonthRecords = useMemo(() =>
    prevMonth ? allRecords.filter(r => r.data === prevMonth) : [],
    [allRecords, prevMonth]
  );

  const metrics = useMemo(() => calcMetrics(lastMonthRecords), [lastMonthRecords]);
  const prevMetrics = useMemo(() =>
    prevMonthRecords.length > 0 ? calcMetrics(prevMonthRecords) : null,
    [prevMonthRecords]
  );

  const alerts = useMemo(() => generateAlerts(lastMonthRecords), [lastMonthRecords]);
  const dangerAlerts = alerts.filter(a => a.type === 'danger');
  const warningAlerts = alerts.filter(a => a.type === 'warning');

  // Top 3 piores unidades (por margem)
  const rankingMargem = useMemo(() =>
    rankUnidades(lastMonthRecords, 'margem').reverse().slice(0, 3),
    [lastMonthRecords]
  );

  const healthScores = useMemo(() => calcHealthScores(lastMonthRecords), [lastMonthRecords]);

  const rankingRegional = useMemo(() => {
    return regionais.map(reg => {
      const recs = lastMonthRecords.filter(r => r.regional === reg);
      const m = calcMetrics(recs);
      const rl = recs.reduce((s, r) => s + r.receitaLiquida, 0);
      const mdo = recs.reduce((s, r) => s + r.maoDeObra, 0);
      const mdoPct = rl > 0 ? (mdo / rl) * 100 : 0;
      const unidadesReg = healthScores.filter(u => u.regional === reg);
      const avgScore = unidadesReg.length > 0
        ? Math.round(unidadesReg.reduce((s, u) => s + u.score, 0) / unidadesReg.length)
        : 0;
      return {
        regional: reg,
        receita: m.receitaBruta,
        margem: m.margem,
        cmvPercent: m.cmvPercent,
        mdoPct,
        avgScore,
        unidades: unidadesReg.sort((a, b) => b.score - a.score),
      };
    }).sort((a, b) => b.avgScore - a.avgScore);
  }, [regionais, lastMonthRecords, healthScores]);

  // Top 3 melhores unidades (por margem)
  const topMargem = useMemo(() =>
    rankUnidades(lastMonthRecords, 'margem').slice(0, 3),
    [lastMonthRecords]
  );

  // Saúde por regional
  const regionalSaude = useMemo(() => {
    return regionais.map(reg => {
      const recs = lastMonthRecords.filter(r => r.regional === reg);
      const m = calcMetrics(recs);
      const prevRecs = prevMonthRecords.filter(r => r.regional === reg);
      const prevM = prevRecs.length > 0 ? calcMetrics(prevRecs) : null;
      const alertCount = alerts.filter(a => a.regional === reg && a.type === 'danger').length;
      const delta = prevM ? m.receitaBruta - prevM.receitaBruta : 0;
      return { regional: reg, margem: m.margem, receita: m.receitaBruta, delta, alertCount };
    }).sort((a, b) => b.receita - a.receita);
  }, [regionais, lastMonthRecords, prevMonthRecords, alerts]);

  // RH metrics para o último mês
  const rhLastMonth = useMemo(() => {
    const recs = (rhData?.data || []).filter(r => r.data === lastMonth);
    const totalMdo = recs.reduce((s, r) => s + r.maoDeObra, 0);
    const totalHe = recs.reduce((s, r) => s + r.horaExtra, 0);
    const totalFunc = recs.reduce((s, r) => s + r.numFuncionarios, 0);
    const avgPct = recs.length > 0 ? recs.reduce((s, r) => s + r.percentualMdo, 0) / recs.length : 0;
    const avgMeta = recs.filter(r => r.metaPercentual > 0);
    const metaAvg = avgMeta.length > 0 ? avgMeta.reduce((s, r) => s + r.metaPercentual, 0) / avgMeta.length : 0;
    const acimaMeta = recs.filter(r => r.metaPercentual > 0 && r.percentualMdo > r.metaPercentual).length;
    const topHe = [...recs].sort((a, b) => b.horaExtra - a.horaExtra).slice(0, 3);
    return { totalMdo, totalHe, totalFunc, avgPct, metaAvg, acimaMeta, topHe, total: recs.length };
  }, [rhData, lastMonth]);

  const pct = (curr: number, prev?: number) =>
    prev && prev > 0 ? ((curr - prev) / prev) * 100 : undefined;

  const receitaDelta = pct(metrics.receitaBruta, prevMetrics?.receitaBruta);
  const margemDelta = prevMetrics ? metrics.margem - prevMetrics.margem : undefined;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const semaforo = dangerAlerts.length === 0 && warningAlerts.length === 0
    ? 'verde'
    : dangerAlerts.length > 0
    ? 'vermelho'
    : 'amarelo';

  const semaforoConfig = {
    verde: { label: 'Operação saudável', color: 'text-success', bg: 'bg-success/10 border-success/30', icon: ShieldCheck },
    amarelo: { label: `${warningAlerts.length} ponto${warningAlerts.length > 1 ? 's' : ''} de atenção`, color: 'text-warning', bg: 'bg-warning/10 border-warning/30', icon: AlertTriangle },
    vermelho: { label: `${dangerAlerts.length} alerta${dangerAlerts.length > 1 ? 's' : ''} crítico${dangerAlerts.length > 1 ? 's' : ''}`, color: 'text-danger', bg: 'bg-danger/10 border-danger/30', icon: AlertCircle },
  }[semaforo];

  const SemaforoIcon = semaforoConfig.icon;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-end justify-between gap-2"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sun className="w-5 h-5 text-warning" />
            <span className="text-sm text-muted-foreground capitalize">{getFormattedDate()}</span>
          </div>
          <h1 className="text-2xl font-display font-bold">{getGreeting()}, Sandro.</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Aqui está o resumo de <span className="font-medium text-foreground">{lastMonth ?? '—'}</span>
          </p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border ${semaforoConfig.bg}`}>
          <SemaforoIcon className={`w-4 h-4 ${semaforoConfig.color}`} />
          <span className={`text-sm font-semibold ${semaforoConfig.color}`}>{semaforoConfig.label}</span>
        </div>
      </motion.div>

      {/* KPIs principais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: 'Receita total',
            value: formatCurrency(metrics.receitaBruta),
            delta: receitaDelta,
            suffix: receitaDelta !== undefined ? `${receitaDelta > 0 ? '+' : ''}${receitaDelta.toFixed(1)}% vs ${prevMonth}` : undefined,
            positive: receitaDelta !== undefined ? receitaDelta > 0 : null,
          },
          {
            label: 'Margem geral',
            value: formatPercent(metrics.margem),
            delta: margemDelta,
            suffix: margemDelta !== undefined ? `${margemDelta > 0 ? '+' : ''}${margemDelta.toFixed(1)}pp vs ${prevMonth}` : undefined,
            positive: margemDelta !== undefined ? margemDelta > 0 : null,
          },
          {
            label: 'CMV médio',
            value: formatPercent(metrics.cmvPercent),
            delta: prevMetrics ? metrics.cmvPercent - prevMetrics.cmvPercent : undefined,
            suffix: prevMetrics ? `${(metrics.cmvPercent - prevMetrics.cmvPercent) > 0 ? '+' : ''}${(metrics.cmvPercent - prevMetrics.cmvPercent).toFixed(1)}pp vs ${prevMonth}` : undefined,
            positive: prevMetrics ? metrics.cmvPercent < prevMetrics.cmvPercent : null, // CMV: queda é boa
          },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="glass-card rounded-xl p-5"
          >
            <p className="text-xs font-medium text-muted-foreground mb-2">{kpi.label}</p>
            <p className="text-2xl font-display font-bold">{kpi.value}</p>
            {kpi.suffix && (
              <div className={`flex items-center gap-1 mt-2 text-[11px] font-medium ${kpi.positive === true ? 'text-success' : kpi.positive === false ? 'text-danger' : 'text-muted-foreground'}`}>
                {kpi.positive === true ? <TrendingUp className="w-3 h-3" /> : kpi.positive === false ? <TrendingDown className="w-3 h-3" /> : null}
                <span>{kpi.suffix}</span>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Alertas críticos do dia */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-xl p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Requer atenção agora
            </h3>
            {dangerAlerts.length > 0 && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-danger/10 text-danger">
                {dangerAlerts.length} crítico{dangerAlerts.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {dangerAlerts.length === 0 && warningAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8">
              <ShieldCheck className="w-7 h-7 text-success opacity-60" />
              <p className="text-sm text-muted-foreground">Nenhum alerta crítico hoje.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {[...dangerAlerts.slice(0, 3), ...warningAlerts.slice(0, 2)].map((alert, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    alert.type === 'danger' ? 'border-danger/30 bg-danger/5' : 'border-warning/30 bg-warning/5'
                  }`}
                >
                  {alert.type === 'danger'
                    ? <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-danger" />
                    : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-warning" />
                  }
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{alert.unidade}</p>
                    <p className="text-xs text-muted-foreground">{alert.message}</p>
                    <p className="text-[10px] text-muted-foreground/60">{alert.regional}</p>
                  </div>
                </div>
              ))}
              {(dangerAlerts.length + warningAlerts.length) > 5 && (
                <p className="text-xs text-center text-muted-foreground pt-1">
                  + {(dangerAlerts.length + warningAlerts.length) - 5} outros — veja a Central de Alertas
                </p>
              )}
            </div>
          )}
        </motion.div>

        {/* Saúde por regional */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="glass-card rounded-xl p-5 space-y-3"
        >
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Saúde por regional
          </h3>
          <div className="space-y-2.5">
            {regionalSaude.map((r, i) => {
              const semaforo = r.alertCount > 0 ? 'danger' : r.margem < 5 ? 'warning' : 'ok';
              return (
                <div key={r.regional} className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    semaforo === 'danger' ? 'bg-danger' : semaforo === 'warning' ? 'bg-warning' : 'bg-success'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{r.regional}</span>
                      <span className="text-xs text-muted-foreground">{formatCurrency(r.receita)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[10px] text-muted-foreground">
                        Margem: <span className={r.margem < 0 ? 'text-danger' : r.margem < 5 ? 'text-warning' : 'text-success'}>
                          {formatPercent(r.margem)}
                        </span>
                      </span>
                      {r.alertCount > 0 && (
                        <span className="text-[10px] text-danger font-medium">
                          {r.alertCount} crítico{r.alertCount > 1 ? 's' : ''}
                        </span>
                      )}
                      {r.delta !== 0 && (
                        <span className={`text-[10px] font-medium ${r.delta > 0 ? 'text-success' : 'text-danger'}`}>
                          {r.delta > 0 ? '+' : ''}{formatCurrency(r.delta)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

      </div>

      {/* Score de Saúde */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.28 }}
        className="glass-card rounded-xl p-5 space-y-4"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Score de Saúde por Unidade
          </h3>
          <div className="flex items-center gap-2 text-[10px] font-semibold">
            <span className="px-2 py-0.5 rounded-full bg-success/10 text-success">≥80 Saudável</span>
            <span className="px-2 py-0.5 rounded-full bg-warning/10 text-warning">50-79 Atenção</span>
            <span className="px-2 py-0.5 rounded-full bg-danger/10 text-danger">&lt;50 Crítico</span>
          </div>
        </div>

        <div className="space-y-2">
          {healthScores.slice(0, 10).map((u, i) => (
            <div key={u.unidade} className="flex items-center gap-3">
              <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      u.grade === 'green' ? 'bg-success' : u.grade === 'yellow' ? 'bg-warning' : 'bg-danger'
                    }`} />
                    <span className="text-xs font-medium truncate">{u.unidade}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{u.regional}</span>
                  </div>
                  <span className={`text-sm font-bold shrink-0 ${
                    u.grade === 'green' ? 'text-success' : u.grade === 'yellow' ? 'text-warning' : 'text-danger'
                  }`}>{u.score}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-secondary">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      u.grade === 'green' ? 'bg-success' : u.grade === 'yellow' ? 'bg-warning' : 'bg-danger'
                    }`}
                    style={{ width: `${u.score}%` }}
                  />
                </div>
                <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
                  <span>Margem {u.metrics.margem.toFixed(1)}%</span>
                  <span>CMV {u.metrics.cmvPercent.toFixed(1)}%</span>
                  <span>MdO {u.metrics.maoDeObraPercent.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          ))}
          {healthScores.length > 10 && (
            <p className="text-xs text-center text-muted-foreground pt-1">
              + {healthScores.length - 10} outras unidades
            </p>
          )}
        </div>
      </motion.div>

      {/* Ranking Comparativo por Regional */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.32 }}
        className="glass-card rounded-xl p-5 space-y-4"
      >
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Ranking Comparativo por Regional
        </h3>

        <RegionalRankingList rankingRegional={rankingRegional} lastMonthRecords={lastMonthRecords} formatCurrency={formatCurrency} formatPercent={formatPercent} />
      </motion.div>

            {/* Resumo de Pessoas */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.34 }}
        className="glass-card rounded-xl p-5 space-y-4"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4" />
            Pessoas — {lastMonth}
          </h3>
          {rhLastMonth.acimaMeta > 0 && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-danger/10 text-danger">
              {rhLastMonth.acimaMeta} unidade{rhLastMonth.acimaMeta > 1 ? 's' : ''} acima da meta MdO
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Custo MdO', value: formatCurrency(rhLastMonth.totalMdo), color: 'text-foreground' },
            { label: '% MdO Médio', value: `${rhLastMonth.avgPct.toFixed(1)}%`, color: rhLastMonth.metaAvg > 0 && rhLastMonth.avgPct > rhLastMonth.metaAvg ? 'text-danger' : 'text-success' },
            { label: 'Funcionários', value: rhLastMonth.totalFunc > 0 ? rhLastMonth.totalFunc.toFixed(0) : '—', color: 'text-foreground' },
            { label: 'Hora Extra', value: rhLastMonth.totalHe > 0 ? formatCurrency(rhLastMonth.totalHe) : '—', color: rhLastMonth.totalHe > 0 ? 'text-warning' : 'text-muted-foreground' },
          ].map(kpi => (
            <div key={kpi.label} className="bg-secondary/40 rounded-lg p-3 text-center">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{kpi.label}</p>
              <p className={`text-base font-display font-bold ${kpi.color}`}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {rhLastMonth.topHe.length > 0 && rhLastMonth.topHe[0].horaExtra > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3 h-3" /> Top hora extra
            </p>
            {rhLastMonth.topHe.map((u, i) => (
              <div key={u.unidade} className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-muted-foreground w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium truncate">{u.unidade}</span>
                    <span className="text-xs font-semibold text-warning shrink-0">{formatCurrency(u.horaExtra)}</span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-secondary">
                    <div className="h-1 rounded-full bg-warning" style={{ width: `${(u.horaExtra / rhLastMonth.topHe[0].horaExtra) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="glass-card rounded-xl p-5 space-y-3"
        >
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-success" />
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Top 3 — melhor margem
            </h3>
          </div>
          <div className="space-y-2">
            {topMargem.map((u, i) => (
              <div key={u.unidade} className="flex items-center gap-3">
                <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{u.unidade}</span>
                    <span className="text-sm font-semibold text-success">{formatPercent(u.value)}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-secondary mt-1">
                    <div
                      className="h-1.5 rounded-full bg-success"
                      style={{ width: `${Math.min(100, Math.max(0, u.value))}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="glass-card rounded-xl p-5 space-y-3"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Bottom 3 — pior margem
            </h3>
          </div>
          <div className="space-y-2">
            {rankingMargem.map((u, i) => (
              <div key={u.unidade} className="flex items-center gap-3">
                <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{u.unidade}</span>
                    <span className={`text-sm font-semibold ${u.value < 0 ? 'text-danger' : 'text-warning'}`}>
                      {formatPercent(u.value)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-secondary mt-1">
                    <div
                      className={`h-1.5 rounded-full ${u.value < 0 ? 'bg-danger' : 'bg-warning'}`}
                      style={{ width: `${Math.min(100, Math.max(0, Math.abs(u.value)))}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

      </div>

    </div>
  );
}
