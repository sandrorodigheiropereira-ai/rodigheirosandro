import { useState, useMemo } from 'react';
import { AlertCircle, AlertTriangle, Info, TrendingDown, ShieldCheck } from 'lucide-react';
import { useSheetData, getRegionaisFromData } from '@/hooks/useSheetData';
import { generateAlerts, groupBy, calcMetrics } from '@/lib/calculations';
import { filterOutAdm } from '@/lib/constants';
import { Alert } from '@/types/financial';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';

const TIPO_LABEL: Record<Alert['type'], string> = {
  danger: 'Crítico',
  warning: 'Atenção',
  info: 'Info',
};

const TIPO_BADGE_CLASS: Record<Alert['type'], string> = {
  danger: 'bg-danger/10 text-danger',
  warning: 'bg-warning/10 text-warning',
  info: 'bg-info/10 text-info',
};

const TIPO_BORDER_CLASS: Record<Alert['type'], string> = {
  danger: 'border-danger/30 bg-danger/5',
  warning: 'border-warning/30 bg-warning/5',
  info: 'border-info/30 bg-info/5',
};

const TIPO_DOT_CLASS: Record<Alert['type'], string> = {
  danger: 'bg-danger',
  warning: 'bg-warning',
  info: 'bg-info',
};

const TIPO_ICON: Record<Alert['type'], React.ElementType> = {
  danger: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const TIPO_ORDER: Record<Alert['type'], number> = { danger: 0, warning: 1, info: 2 };

type FiltroTipo = 'todos' | Alert['type'];

function AlertRow({ alert, index }: { alert: Alert; index: number }) {
  const Icon = TIPO_ICON[alert.type];
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`flex items-start gap-3 p-3 rounded-lg border ${TIPO_BORDER_CLASS[alert.type]}`}
    >
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 text-${alert.type === 'danger' ? 'danger' : alert.type === 'warning' ? 'warning' : 'info'}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p className="text-sm font-medium truncate">{alert.unidade}</p>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${TIPO_BADGE_CLASS[alert.type]}`}>
            {TIPO_LABEL[alert.type]}
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-snug">{alert.message}</p>
        {alert.regional && (
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">{alert.regional}</p>
        )}
      </div>
    </motion.div>
  );
}

export default function AlertasDashboard() {
  const { data: sheetData, isLoading, error } = useSheetData();
  const allRecords = useMemo(() => filterOutAdm(sheetData?.data || []), [sheetData]);
  const regionais = useMemo(() => getRegionaisFromData(allRecords), [allRecords]);
  const meses = useMemo(() => [...new Set(allRecords.map(r => r.data))].filter(Boolean).sort(), [allRecords]);

  const [regional, setRegional] = useState('all');
  const [periodo, setPeriodo] = useState('all');
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');

  const filtered = useMemo(() => {
    let data = allRecords;
    if (regional !== 'all') data = data.filter(r => r.regional === regional);
    if (periodo !== 'all') data = data.filter(r => r.data === periodo);
    return data;
  }, [allRecords, regional, periodo]);

  const allAlerts = useMemo(() => generateAlerts(filtered), [filtered]);

  const alertsFiltrados = useMemo(() =>
    filtroTipo === 'todos' ? allAlerts : allAlerts.filter(a => a.type === filtroTipo),
    [allAlerts, filtroTipo]
  );

  const dangerCount = useMemo(() => allAlerts.filter(a => a.type === 'danger').length, [allAlerts]);
  const warningCount = useMemo(() => allAlerts.filter(a => a.type === 'warning').length, [allAlerts]);
  const infoCount = useMemo(() => allAlerts.filter(a => a.type === 'info').length, [allAlerts]);

  const byUnidade = useMemo(() => groupBy(filtered, 'unidade'), [filtered]);
  const unidadesOk = useMemo(() => {
    const unidadesComAlerta = new Set(allAlerts.map(a => a.unidade));
    return Object.keys(byUnidade).filter(u => !unidadesComAlerta.has(u)).length;
  }, [allAlerts, byUnidade]);

  const rankingRisco = useMemo(() => {
    const contagem: Record<string, { count: number; maxTipo: Alert['type']; regional: string }> = {};
    for (const alert of allAlerts) {
      if (!contagem[alert.unidade]) {
        contagem[alert.unidade] = { count: 0, maxTipo: alert.type, regional: alert.regional };
      }
      contagem[alert.unidade].count += 1;
      if (TIPO_ORDER[alert.type] < TIPO_ORDER[contagem[alert.unidade].maxTipo]) {
        contagem[alert.unidade].maxTipo = alert.type;
      }
    }
    return Object.entries(contagem)
      .map(([unidade, v]) => ({ unidade, ...v }))
      .sort((a, b) => TIPO_ORDER[a.maxTipo] - TIPO_ORDER[b.maxTipo] || b.count - a.count)
      .slice(0, 8);
  }, [allAlerts]);

  const maxRisco = rankingRisco[0]?.count ?? 1;

  const saudeRegional = useMemo(() => {
    const byRegional: Record<string, { danger: number; warning: number; info: number }> = {};
    for (const alert of allAlerts) {
      if (!byRegional[alert.regional]) byRegional[alert.regional] = { danger: 0, warning: 0, info: 0 };
      byRegional[alert.regional][alert.type] += 1;
    }
    return Object.entries(byRegional)
      .map(([reg, counts]) => ({ regional: reg, ...counts, total: counts.danger + counts.warning + counts.info }))
      .sort((a, b) => b.danger - a.danger || b.total - a.total);
  }, [allAlerts]);

  const contadorPorTipo = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of allAlerts) {
      const cat = a.message.split(':')[0];
      map[cat] = (map[cat] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [allAlerts]);

  // Histórico dos últimos 3 meses
  const historico = useMemo(() => {
    const ultimos3 = meses.slice(-3);
    if (ultimos3.length === 0) return { porUnidade: [], porTipo: [] };

    // Por unidade: quantos alertas críticos acumulou em cada mês
    const unidadesMap: Record<string, { unidade: string; regional: string; meses: Record<string, number>; total: number }> = {};
    for (const mes of ultimos3) {
      const recsMes = allRecords.filter(r =>
        r.data === mes &&
        (regional === 'all' || r.regional === regional)
      );
      const alertsMes = generateAlerts(recsMes).filter(a => a.type === 'danger');
      for (const alert of alertsMes) {
        if (!unidadesMap[alert.unidade]) {
          unidadesMap[alert.unidade] = { unidade: alert.unidade, regional: alert.regional, meses: {}, total: 0 };
        }
        unidadesMap[alert.unidade].meses[mes] = (unidadesMap[alert.unidade].meses[mes] || 0) + 1;
        unidadesMap[alert.unidade].total += 1;
      }
    }
    const porUnidade = Object.values(unidadesMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Por tipo: quais alertas se repetiram mais
    const tipoMap: Record<string, { categoria: string; tipo: Alert['type']; meses: Record<string, number>; total: number }> = {};
    for (const mes of ultimos3) {
      const recsMes = allRecords.filter(r =>
        r.data === mes &&
        (regional === 'all' || r.regional === regional)
      );
      const alertsMes = generateAlerts(recsMes);
      for (const alert of alertsMes) {
        const cat = alert.message.split(':')[0];
        if (!tipoMap[cat]) tipoMap[cat] = { categoria: cat, tipo: alert.type, meses: {}, total: 0 };
        tipoMap[cat].meses[mes] = (tipoMap[cat].meses[mes] || 0) + 1;
        tipoMap[cat].total += 1;
      }
    }
    const porTipo = Object.values(tipoMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    return { porUnidade, porTipo, meses: ultimos3 };
  }, [allRecords, meses, regional]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
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

  const regionalCardColor = (danger: number, warning: number) => {
    if (danger > 0) return 'border-danger/30 bg-danger/5';
    if (warning > 0) return 'border-warning/30 bg-warning/5';
    return 'border-success/30 bg-success/5';
  };

  const regionalTextColor = (danger: number, warning: number) => {
    if (danger > 0) return 'text-danger';
    if (warning > 0) return 'text-warning';
    return 'text-success';
  };

  return (
    <div className="space-y-6">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Central de alertas</h1>
          <p className="text-sm text-muted-foreground">Visão consolidada de todas as regionais</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[160px] bg-secondary border-border">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {meses.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={regional} onValueChange={setRegional}>
            <SelectTrigger className="w-[170px] bg-secondary border-border">
              <SelectValue placeholder="Regional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as regionais</SelectItem>
              {regionais.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total de alertas', value: allAlerts.length, color: 'text-foreground' },
          { label: 'Críticos', value: dangerCount, color: 'text-danger' },
          { label: 'Atenção', value: warningCount, color: 'text-warning' },
          { label: 'Unidades OK', value: unidadesOk, color: 'text-success' },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="glass-card rounded-xl p-5"
          >
            <p className="text-xs font-medium text-muted-foreground mb-1">{kpi.label}</p>
            <p className={`text-3xl font-display font-bold ${kpi.color}`}>{kpi.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 glass-card rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Alertas ativos
              <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-secondary text-muted-foreground normal-case tracking-normal">
                {alertsFiltrados.length}
              </span>
            </h3>
            <div className="flex gap-1.5 flex-wrap">
              {(['todos', 'danger', 'warning', 'info'] as const).map(tipo => (
                <button
                  key={tipo}
                  onClick={() => setFiltroTipo(tipo)}
                  className={`text-[10px] font-semibold px-2 py-1 rounded transition-colors ${
                    filtroTipo === tipo
                      ? tipo === 'todos'
                        ? 'bg-foreground text-background'
                        : `${TIPO_BADGE_CLASS[tipo as Alert['type']]} ring-1 ring-inset ring-current`
                      : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tipo === 'todos' ? 'Todos' : TIPO_LABEL[tipo as Alert['type']]}
                </button>
              ))}
            </div>
          </div>

          {alertsFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12">
              <ShieldCheck className="w-8 h-8 text-success opacity-60" />
              <p className="text-sm text-muted-foreground">Nenhum alerta nesta categoria.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {alertsFiltrados.map((alert, i) => (
                <AlertRow key={`${alert.unidade}-${i}`} alert={alert} index={i} />
              ))}
            </div>
          )}
        </motion.div>

        <div className="space-y-5">

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="glass-card rounded-xl p-5 space-y-3"
          >
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Ranking de risco
            </h3>
            {rankingRisco.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma unidade com alertas.</p>
            ) : (
              <div className="space-y-3">
                {rankingRisco.map((item, i) => (
                  <div key={item.unidade}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium truncate">{item.unidade}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${TIPO_BADGE_CLASS[item.maxTipo]}`}>
                        {item.count} alerta{item.count > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-secondary">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          item.maxTipo === 'danger' ? 'bg-danger' : item.maxTipo === 'warning' ? 'bg-warning' : 'bg-info'
                        }`}
                        style={{ width: `${Math.round((item.count / maxRisco) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="glass-card rounded-xl p-5 space-y-3"
          >
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Alertas por tipo
            </h3>
            {contadorPorTipo.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem dados.</p>
            ) : (
              <div className="space-y-2">
                {contadorPorTipo.map(([cat, count]) => {
                  const tipo = allAlerts.find(a => a.message.startsWith(cat))?.type ?? 'info';
                  return (
                    <div key={cat} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TIPO_DOT_CLASS[tipo]}`} />
                        <span className="text-xs text-muted-foreground truncate">{cat}</span>
                      </div>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${TIPO_BADGE_CLASS[tipo]}`}>
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="glass-card rounded-xl p-5 space-y-4"
      >
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Saúde por regional
        </h3>
        {saudeRegional.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8">
            <ShieldCheck className="w-7 h-7 text-success opacity-60" />
            <p className="text-sm text-muted-foreground">Todas as regionais estão sem alertas.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {saudeRegional.map((r, i) => (
              <motion.div
                key={r.regional}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
                className={`rounded-lg border p-4 ${regionalCardColor(r.danger, r.warning)}`}
              >
                <p className={`text-xs font-semibold uppercase tracking-wider ${regionalTextColor(r.danger, r.warning)}`}>
                  {r.regional}
                </p>
                <p className={`text-2xl font-display font-bold mt-2 ${regionalTextColor(r.danger, r.warning)}`}>
                  {r.total}
                </p>
                <div className="mt-2 space-y-0.5">
                  {r.danger > 0 && (
                    <p className="text-[10px] text-danger">{r.danger} crítico{r.danger > 1 ? 's' : ''}</p>
                  )}
                  {r.warning > 0 && (
                    <p className="text-[10px] text-warning">{r.warning} atenção</p>
                  )}
                  {r.info > 0 && (
                    <p className="text-[10px] text-info">{r.info} info</p>
                  )}
                </div>
              </motion.div>
            ))}

            {regionais
              .filter(reg => !saudeRegional.find(s => s.regional === reg))
              .map((reg, i) => (
                <motion.div
                  key={reg}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * (saudeRegional.length + i) }}
                  className="rounded-lg border border-success/30 bg-success/5 p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-success">{reg}</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <ShieldCheck className="w-5 h-5 text-success" />
                    <p className="text-sm font-medium text-success">Sem alertas</p>
                  </div>
                </motion.div>
              ))}
          </div>
        )}
      </motion.div>

      {/* Histórico de Alertas — últimos 3 meses */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="space-y-5"
      >
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Histórico — últimos 3 meses
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Reincidência por unidade */}
          <div className="glass-card rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Unidades reincidentes (alertas críticos)
            </h3>
            {historico.porUnidade?.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-8">
                <ShieldCheck className="w-6 h-6 text-success opacity-60" />
                <p className="text-sm text-muted-foreground">Nenhuma reincidência crítica.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-2 pb-3 font-semibold text-muted-foreground">Unidade</th>
                      {(historico.meses || []).map(m => (
                        <th key={m} className="text-center p-2 pb-3 font-semibold text-muted-foreground w-16">{m}</th>
                      ))}
                      <th className="text-center p-2 pb-3 font-semibold text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(historico.porUnidade || []).map((u, i) => (
                      <tr key={u.unidade} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="p-2 py-2.5">
                          <div>
                            <p className="font-medium">{u.unidade}</p>
                            <p className="text-[10px] text-muted-foreground/60">{u.regional}</p>
                          </div>
                        </td>
                        {(historico.meses || []).map(m => {
                          const count = u.meses[m] || 0;
                          return (
                            <td key={m} className="p-2 py-2.5 text-center">
                              {count > 0 ? (
                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${
                                  count >= 3 ? 'bg-danger text-white' : count >= 2 ? 'bg-warning text-white' : 'bg-danger/20 text-danger'
                                }`}>{count}</span>
                              ) : (
                                <span className="text-success opacity-40">✓</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="p-2 py-2.5 text-center">
                          <span className={`text-sm font-bold ${u.total >= 6 ? 'text-danger' : u.total >= 3 ? 'text-warning' : 'text-muted-foreground'}`}>
                            {u.total}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Alertas que mais se repetiram */}
          <div className="glass-card rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Alertas mais recorrentes
            </h3>
            {historico.porTipo?.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-8">
                <ShieldCheck className="w-6 h-6 text-success opacity-60" />
                <p className="text-sm text-muted-foreground">Nenhum alerta recorrente.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(historico.porTipo || []).map((t, i) => {
                  const maxCount = historico.porTipo?.[0]?.total ?? 1;
                  const pct = Math.round((t.total / maxCount) * 100);
                  return (
                    <div key={t.categoria}>
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TIPO_DOT_CLASS[t.tipo]}`} />
                          <span className="text-xs text-muted-foreground truncate">{t.categoria}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {(historico.meses || []).map(m => (
                            <span key={m} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                              t.meses[m] ? TIPO_BADGE_CLASS[t.tipo] : 'bg-secondary text-muted-foreground'
                            }`}>
                              {t.meses[m] || 0}
                            </span>
                          ))}
                          <span className={`text-xs font-bold w-8 text-right ${TIPO_BADGE_CLASS[t.tipo].split(' ')[1]}`}>
                            {t.total}
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-1 rounded-full bg-secondary">
                        <div
                          className={`h-1 rounded-full ${t.tipo === 'danger' ? 'bg-danger' : t.tipo === 'warning' ? 'bg-warning' : 'bg-info'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  {(historico.meses || []).map(m => (
                    <span key={m} className="text-[10px] text-muted-foreground">{m}</span>
                  ))}
                  <span className="text-[10px] text-muted-foreground w-8 text-right">Total</span>
                </div>
              </div>
            )}
          </div>

        </div>
      </motion.div>

    </div>
  );
}