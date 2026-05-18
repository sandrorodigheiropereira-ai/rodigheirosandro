import { useState, useMemo } from 'react';
import { AlertCircle, AlertTriangle, Info, ShieldCheck } from 'lucide-react';
import { useSheetData, getRegionaisFromData } from '@/hooks/useSheetData';
import { generateAlerts, groupBy } from '@/lib/calculations';
import { filterOutAdm } from '@/lib/constants';
import { Alert } from '@/types/financial';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

const TIPO_ICON: Record<Alert['type'], typeof AlertCircle> = {
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.02 }}
      className={`flex gap-3 p-3 border rounded-lg ${TIPO_BORDER_CLASS[alert.type]}`}
    >
      <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
        alert.type === 'danger' ? 'text-danger' : alert.type === 'warning' ? 'text-warning' : 'text-info'
      }`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-sm font-semibold text-foreground truncate">{alert.unidade}</p>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${TIPO_BADGE_CLASS[alert.type]}`}>
            {TIPO_LABEL[alert.type]}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{alert.message}</p>
        {alert.regional && (
          <p className="text-[10px] text-muted-foreground mt-1">{alert.regional}</p>
        )}
      </div>
    </motion.div>
  );
}

export default function AlertasDashboard() {
  const { data: sheetData, isLoading, error } = useSheetData();
  const allRecords = useMemo(() => filterOutAdm(sheetData?.data || []), [sheetData]);
  const regionais = useMemo(() => getRegionaisFromData(allRecords), [allRecords]);
  const meses = useMemo(
    () => [...new Set(allRecords.map(r => r.data))].filter(Boolean).sort(),
    [allRecords]
  );

  const [regional, setRegional] = useState<string>('all');
  const [periodo, setPeriodo] = useState<string>('all');
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');

  const filtered = useMemo(() => {
    let data = allRecords;
    if (regional !== 'all') data = data.filter(r => r.regional === regional);
    if (periodo !== 'all') data = data.filter(r => r.data === periodo);
    return data;
  }, [allRecords, regional, periodo]);

  const allAlerts = useMemo(() => generateAlerts(filtered), [filtered]);

  const alertsFiltrados = useMemo(
    () => (filtroTipo === 'todos' ? allAlerts : allAlerts.filter(a => a.type === filtroTipo)),
    [allAlerts, filtroTipo]
  );

  const dangerCount = useMemo(() => allAlerts.filter(a => a.type === 'danger').length, [allAlerts]);
  const warningCount = useMemo(() => allAlerts.filter(a => a.type === 'warning').length, [allAlerts]);

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
      .map(([reg, counts]) => ({
        regional: reg,
        ...counts,
        total: counts.danger + counts.warning + counts.info,
      }))
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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 border border-danger/30 bg-danger/5 rounded-lg">
        <p className="text-sm text-danger">Erro ao carregar dados: {(error as Error).message}</p>
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
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Central de alertas</h1>
          <p className="text-sm text-muted-foreground">Visão consolidada de todas as regionais</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {meses.map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={regional} onValueChange={setRegional}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Regional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as regionais</SelectItem>
              {regionais.map(r => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total de alertas', value: allAlerts.length, color: 'text-foreground' },
          { label: 'Críticos', value: dangerCount, color: 'text-danger' },
          { label: 'Atenção', value: warningCount, color: 'text-warning' },
          { label: 'Unidades OK', value: unidadesOk, color: 'text-success' },
        ].map(kpi => (
          <div key={kpi.label} className="p-4 border rounded-lg bg-card">
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 p-4 border rounded-lg bg-card">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">Alertas ativos</h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-secondary text-muted-foreground">
                {alertsFiltrados.length}
              </span>
            </div>
            <div className="flex gap-1">
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
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShieldCheck className="h-10 w-10 text-success mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum alerta nesta categoria.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto">
              {alertsFiltrados.map((alert, i) => (
                <AlertRow key={`${alert.unidade}-${i}`} alert={alert} index={i} />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="p-4 border rounded-lg bg-card">
            <h2 className="text-sm font-semibold text-foreground mb-4">Ranking de risco</h2>
            {rankingRisco.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma unidade com alertas.</p>
            ) : (
              <div className="space-y-2">
                {rankingRisco.map(item => (
                  <div key={item.unidade} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground font-medium truncate">{item.unidade}</span>
                      <span className={`font-semibold ${
                        item.maxTipo === 'danger' ? 'text-danger' : item.maxTipo === 'warning' ? 'text-warning' : 'text-info'
                      }`}>
                        {item.count} alerta{item.count > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full ${TIPO_DOT_CLASS[item.maxTipo]}`}
                        style={{ width: `${(item.count / maxRisco) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 border rounded-lg bg-card">
            <h2 className="text-sm font-semibold text-foreground mb-4">Alertas por tipo</h2>
            {contadorPorTipo.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem dados.</p>
            ) : (
              <div className="space-y-2">
                {contadorPorTipo.map(([cat, count]) => {
                  const tipo = allAlerts.find(a => a.message.startsWith(cat))?.type ?? 'info';
                  return (
                    <div key={cat} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`h-2 w-2 rounded-full flex-shrink-0 ${TIPO_DOT_CLASS[tipo]}`} />
                        <span className="text-foreground truncate">{cat}</span>
                      </div>
                      <span className="font-semibold text-muted-foreground">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 border rounded-lg bg-card">
        <h2 className="text-sm font-semibold text-foreground mb-4">Saúde por regional</h2>
        {saudeRegional.length === 0 && regionais.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <ShieldCheck className="h-8 w-8 text-success mb-2" />
            <p className="text-sm text-muted-foreground">Todas as regionais estão sem alertas.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {saudeRegional.map(r => (
              <div key={r.regional} className={`p-3 border rounded-lg ${regionalCardColor(r.danger, r.warning)}`}>
                <p className="text-xs font-semibold text-foreground truncate">{r.regional}</p>
                <p className={`text-2xl font-bold mt-1 ${regionalTextColor(r.danger, r.warning)}`}>{r.total}</p>
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
              </div>
            ))}

            {regionais
              .filter(reg => !saudeRegional.find(s => s.regional === reg))
              .map(reg => (
                <div key={reg} className="p-3 border border-success/30 bg-success/5 rounded-lg">
                  <p className="text-xs font-semibold text-foreground truncate">{reg}</p>
                  <div className="mt-2 flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3 text-success" />
                    <p className="text-[10px] text-success">Sem alertas</p>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
