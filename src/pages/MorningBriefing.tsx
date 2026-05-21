import { useMemo } from 'react';
import { useSheetData, getRegionaisFromData } from '@/hooks/useSheetData';
import { calcMetrics, generateAlerts, formatCurrency, formatPercent, rankUnidades } from '@/lib/calculations';
import { filterOutAdm } from '@/lib/constants';
import { AlertCircle, AlertTriangle, TrendingUp, TrendingDown, ShieldCheck, Sun, Trophy, ArrowDown } from 'lucide-react';
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

export default function MorningBriefing() {
  const { data: sheetData, isLoading } = useSheetData();
  const allRecords = useMemo(() => filterOutAdm(sheetData?.data || []), [sheetData]);
  const regionais = useMemo(() => getRegionaisFromData(allRecords), [allRecords]);

  const months = useMemo(
    () => [...new Set(allRecords.map(r => r.data))].filter(Boolean).sort(),
    [allRecords]
  );
  const lastMonth = months[months.length - 1];
  const prevMonth = months.length >= 2 ? months[months.length - 2] : null;

  const lastMonthRecords = useMemo(
    () => allRecords.filter(r => r.data === lastMonth),
    [allRecords, lastMonth]
  );
  const prevMonthRecords = useMemo(
    () => (prevMonth ? allRecords.filter(r => r.data === prevMonth) : []),
    [allRecords, prevMonth]
  );

  const metrics = useMemo(() => calcMetrics(lastMonthRecords), [lastMonthRecords]);
  const prevMetrics = useMemo(
    () => (prevMonthRecords.length > 0 ? calcMetrics(prevMonthRecords) : null),
    [prevMonthRecords]
  );

  const alerts = useMemo(() => generateAlerts(lastMonthRecords), [lastMonthRecords]);
  const dangerAlerts = alerts.filter(a => a.type === 'danger');
  const warningAlerts = alerts.filter(a => a.type === 'warning');

  const rankingMargem = useMemo(
    () => rankUnidades(lastMonthRecords, 'margem').reverse().slice(0, 3),
    [lastMonthRecords]
  );
  const topMargem = useMemo(
    () => rankUnidades(lastMonthRecords, 'margem').slice(0, 3),
    [lastMonthRecords]
  );

  const regionalSaude = useMemo(() => {
    return regionais
      .map(reg => {
        const recs = lastMonthRecords.filter(r => r.regional === reg);
        const m = calcMetrics(recs);
        const prevRecs = prevMonthRecords.filter(r => r.regional === reg);
        const prevM = prevRecs.length > 0 ? calcMetrics(prevRecs) : null;
        const alertCount = alerts.filter(a => a.regional === reg && a.type === 'danger').length;
        const delta = prevM ? m.receitaBruta - prevM.receitaBruta : 0;
        return { regional: reg, margem: m.margem, receita: m.receitaBruta, delta, alertCount };
      })
      .sort((a, b) => b.receita - a.receita);
  }, [regionais, lastMonthRecords, prevMonthRecords, alerts]);

  const pct = (curr: number, prev?: number) =>
    prev && prev > 0 ? ((curr - prev) / prev) * 100 : undefined;

  const receitaDelta = pct(metrics.receitaBruta, prevMetrics?.receitaBruta);
  const margemDelta = prevMetrics ? metrics.margem - prevMetrics.margem : undefined;

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const semaforoKey =
    dangerAlerts.length === 0 && warningAlerts.length === 0
      ? 'verde'
      : dangerAlerts.length > 0
      ? 'vermelho'
      : 'amarelo';

  const semaforoConfig = {
    verde: {
      label: 'Operação saudável',
      color: 'text-success',
      bg: 'bg-success/10 border-success/30',
      icon: ShieldCheck,
    },
    amarelo: {
      label: `${warningAlerts.length} ponto${warningAlerts.length > 1 ? 's' : ''} de atenção`,
      color: 'text-warning',
      bg: 'bg-warning/10 border-warning/30',
      icon: AlertTriangle,
    },
    vermelho: {
      label: `${dangerAlerts.length} alerta${dangerAlerts.length > 1 ? 's' : ''} crítico${
        dangerAlerts.length > 1 ? 's' : ''
      }`,
      color: 'text-danger',
      bg: 'bg-danger/10 border-danger/30',
      icon: AlertCircle,
    },
  }[semaforoKey];

  const SemaforoIcon = semaforoConfig.icon;

  const kpis = [
    {
      label: 'Receita total',
      value: formatCurrency(metrics.receitaBruta),
      suffix:
        receitaDelta !== undefined
          ? `${receitaDelta > 0 ? '+' : ''}${receitaDelta.toFixed(1)}% vs ${prevMonth}`
          : undefined,
      positive: receitaDelta !== undefined ? receitaDelta > 0 : null,
    },
    {
      label: 'Margem geral',
      value: formatPercent(metrics.margem),
      suffix:
        margemDelta !== undefined
          ? `${margemDelta > 0 ? '+' : ''}${margemDelta.toFixed(1)}pp vs ${prevMonth}`
          : undefined,
      positive: margemDelta !== undefined ? margemDelta > 0 : null,
    },
    {
      label: 'CMV médio',
      value: formatPercent(metrics.cmvPercent),
      suffix: prevMetrics
        ? `${(metrics.cmvPercent - prevMetrics.cmvPercent) > 0 ? '+' : ''}${(
            metrics.cmvPercent - prevMetrics.cmvPercent
          ).toFixed(1)}pp vs ${prevMonth}`
        : undefined,
      positive: prevMetrics ? metrics.cmvPercent < prevMetrics.cmvPercent : null,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 p-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
            <Sun className="w-3.5 h-3.5" />
            {getFormattedDate()}
          </div>
          <h1 className="text-3xl font-bold">{getGreeting()}, Sandro.</h1>
          <p className="text-sm text-muted-foreground">
            Aqui está o resumo de {lastMonth ?? '—'}
          </p>
        </div>

        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${semaforoConfig.bg} ${semaforoConfig.color}`}
        >
          <SemaforoIcon className="w-4 h-4" />
          <span className="text-sm font-semibold">{semaforoConfig.label}</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="glass-card rounded-xl p-5 space-y-2"
          >
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
            <p className="text-2xl font-bold">{kpi.value}</p>
            {kpi.suffix && (
              <div
                className={`flex items-center gap-1 text-xs font-medium ${
                  kpi.positive === true
                    ? 'text-success'
                    : kpi.positive === false
                    ? 'text-danger'
                    : 'text-muted-foreground'
                }`}
              >
                {kpi.positive === true ? (
                  <TrendingUp className="w-3 h-3" />
                ) : kpi.positive === false ? (
                  <TrendingDown className="w-3 h-3" />
                ) : null}
                <span>{kpi.suffix}</span>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Alertas */}
        <div className="glass-card rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Requer atenção agora
            </h3>
            {dangerAlerts.length > 0 && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-danger/10 text-danger">
                {dangerAlerts.length} crítico{dangerAlerts.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {dangerAlerts.length === 0 && warningAlerts.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-success">
              <ShieldCheck className="w-4 h-4" />
              <p>Nenhum alerta crítico hoje.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {[...dangerAlerts.slice(0, 3), ...warningAlerts.slice(0, 2)].map((alert, i) => {
                const Icon = alert.type === 'danger' ? AlertCircle : AlertTriangle;
                const color = alert.type === 'danger' ? 'text-danger' : 'text-warning';
                const bg = alert.type === 'danger' ? 'bg-danger/5 border-danger/20' : 'bg-warning/5 border-warning/20';
                return (
                  <div
                    key={`${alert.unidade}-${i}`}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${bg}`}
                  >
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${color}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{alert.unidade}</p>
                      <p className="text-xs text-muted-foreground">{alert.message}</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">{alert.regional}</p>
                    </div>
                  </div>
                );
              })}
              {dangerAlerts.length + warningAlerts.length > 5 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  + {dangerAlerts.length + warningAlerts.length - 5} outros — veja a Central de Alertas
                </p>
              )}
            </div>
          )}
        </div>

        {/* Saúde por regional */}
        <div className="glass-card rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Saúde por regional
          </h3>
          <div className="space-y-2">
            {regionalSaude.map((r) => {
              const status = r.alertCount > 0 ? 'danger' : r.margem < 5 ? 'warning' : 'ok';
              const dotColor =
                status === 'danger' ? 'bg-danger' : status === 'warning' ? 'bg-warning' : 'bg-success';
              const margemColor =
                status === 'danger' ? 'text-danger' : status === 'warning' ? 'text-warning' : 'text-success';
              return (
                <div
                  key={r.regional}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border/40"
                >
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{r.regional}</span>
                      <span className="text-sm font-semibold">{formatCurrency(r.receita)}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        Margem:{' '}
                        <span className={`font-medium ${margemColor}`}>{formatPercent(r.margem)}</span>
                      </span>
                      {r.alertCount > 0 && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-danger/10 text-danger">
                          {r.alertCount} crítico{r.alertCount > 1 ? 's' : ''}
                        </span>
                      )}
                      {r.delta !== 0 && (
                        <span
                          className={`text-[11px] font-medium ${
                            r.delta > 0 ? 'text-success' : 'text-danger'
                          }`}
                        >
                          {r.delta > 0 ? '+' : ''}
                          {formatCurrency(r.delta)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-success" />
            <h3 className="text-sm font-semibold text-success uppercase tracking-wider">
              Top 3 — melhor margem
            </h3>
          </div>
          <div className="space-y-2">
            {topMargem.map((u, i) => (
              <div
                key={u.unidade}
                className="flex items-center gap-3 p-3 rounded-lg bg-success/5 border border-success/10"
              >
                <span className="text-sm font-bold text-success w-5">{i + 1}º</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{u.unidade}</span>
                    <span className="text-sm font-semibold">{formatPercent(u.value)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{u.regional}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ArrowDown className="w-4 h-4 text-danger" />
            <h3 className="text-sm font-semibold text-danger uppercase tracking-wider">
              Bottom 3 — pior margem
            </h3>
          </div>
          <div className="space-y-2">
            {rankingMargem.map((u, i) => (
              <div
                key={u.unidade}
                className="flex items-center gap-3 p-3 rounded-lg bg-danger/5 border border-danger/10"
              >
                <span className="text-sm font-bold text-danger w-5">{i + 1}º</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{u.unidade}</span>
                    <span className="text-sm font-semibold text-danger">{formatPercent(u.value)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{u.regional}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
