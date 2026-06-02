import { useState, useMemo, useEffect } from 'react';
import { DollarSign, TrendingUp, Percent, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/KpiCard';
import { calcMetrics, groupBy, formatCurrency, formatPercent, rankUnidades, calcHealthScores, generateAlerts } from '@/lib/calculations';
import { filterOutAdm } from '@/lib/constants';
import { RankingPanel } from '@/components/RankingPanel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelectUnidade } from '@/components/MultiSelectUnidade';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useSheetData, getRegionaisFromData } from '@/hooks/useSheetData';
import { useRhData } from '@/hooks/useRhData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { DonutChart } from '@/components/DonutChart';
import { supabase } from '@/integrations/supabase/client';

const PIE_COLORS = ['hsl(210 90% 60%)', 'hsl(38 92% 55%)', 'hsl(280 65% 60%)'];

type CompareMode = 'previous-month' | 'previous-window';

export default function RegionalDashboard() {
  const { data: sheetData, isLoading, error } = useSheetData();
  const { data: rhData } = useRhData();
  const allRecords = useMemo(() => filterOutAdm(sheetData?.data || []), [sheetData]);
  const allRhRecords = useMemo(() => filterOutAdm(rhData?.data || []), [rhData]);
  const regionais = useMemo(() => getRegionaisFromData(allRecords), [allRecords]);
  const [regional, setRegional] = useState('');
  const [periodo, setPeriodo] = useState<string[]>([]);
  const [compareMode, setCompareMode] = useState<CompareMode>('previous-window');
  const [rankMetric, setRankMetric] = useState<'receitaBruta' | 'ebitda' | 'margem'>('receitaBruta');

  const meses = useMemo(
    () => [...new Set(allRecords.map(r => r.data))].filter(Boolean).sort(),
    [allRecords]
  );

  useEffect(() => {
    if (regionais.length > 0 && !regional) setRegional(regionais[0]);
  }, [regionais]);

  // Logo da empresa (mesmo do CompanyLogo: storage 'branding/logo.jpg', fallback /logo.png)
  const [logoUrl, setLogoUrl] = useState<string>('/logo.png');
  useEffect(() => {
    const { data } = supabase.storage.from('branding').getPublicUrl('logo.jpg');
    fetch(data.publicUrl, { method: 'HEAD' })
      .then(r => { if (r.ok) setLogoUrl(data.publicUrl); })
      .catch(() => {});
  }, []);

  // Gerentes por regional
  const [managers, setManagers] = useState<Record<string, string>>({});
  useEffect(() => {
    supabase.from('regional_managers').select('regional,nome,ativo').then(({ data }) => {
      if (!data) return;
      const map: Record<string, string> = {};
      data.filter(m => m.ativo !== false).forEach(m => { map[m.regional] = m.nome; });
      setManagers(map);
    });
  }, []);

  const filtered = useMemo(
    () => allRecords.filter(r => r.regional === regional && (periodo.length === 0 || periodo.includes(r.data))),
    [regional, periodo, allRecords]
  );

  const selectedMonths = useMemo(() => (periodo.length > 0 ? [...periodo].sort() : meses), [periodo, meses]);
  const prevMonths = useMemo(() => {
    if (selectedMonths.length === 0) return [];
    const earliestIdx = meses.indexOf(selectedMonths[0]);
    if (earliestIdx <= 0) return [];
    const N = compareMode === 'previous-month' ? 1 : selectedMonths.length;
    return meses.slice(Math.max(0, earliestIdx - N), earliestIdx);
  }, [selectedMonths, meses, compareMode]);

  const prevData = prevMonths.length > 0
    ? allRecords.filter(r => r.regional === regional && prevMonths.includes(r.data))
    : undefined;

  const metrics = calcMetrics(filtered, prevData);
  const prevMetrics = prevData ? calcMetrics(prevData) : undefined;
  const pct = (cur: number, prev?: number) => prev !== undefined && prev > 0 ? ((cur - prev) / prev) * 100 : undefined;
  const periodLabel = prevMonths.length > 0
    ? `vs ${prevMonths.length === 1 ? 'mês anterior' : `${prevMonths.length} meses anteriores`}`
    : undefined;

  const ranking = rankUnidades(filtered, rankMetric);
  const prevRanking = prevData ? rankUnidades(prevData, rankMetric) : undefined;
  const rankFormat: 'currency' | 'percent' = rankMetric === 'margem' ? 'percent' : 'currency';
  const metricLabel = rankMetric === 'receitaBruta' ? 'Receita' : rankMetric === 'ebitda' ? 'EBITDA' : 'Margem';
  const periodCurrentLabel = selectedMonths.length === 0
    ? 'Todos os meses'
    : selectedMonths.length === 1
      ? selectedMonths[0]
      : `${selectedMonths[0]} – ${selectedMonths[selectedMonths.length - 1]} (${selectedMonths.length} meses)`;
  const rankingSubtitle = periodLabel
    ? `${periodCurrentLabel} ${periodLabel}`
    : periodCurrentLabel;

  const monthlyData = useMemo(() => {
    const byMonth = groupBy(filtered, 'data');
    return Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, recs]) => {
      const m = calcMetrics(recs);
      return { mes: month, receita: m.receitaBruta, despesa: m.despesaTotal, margem: m.margem, cmv: m.cmvPercent };
    });
  }, [filtered]);

  const sparklines = useMemo(() => ({
    receita: monthlyData.map(d => d.receita),
    despesa: monthlyData.map(d => d.despesa),
    margem: monthlyData.map(d => d.margem),
    cmv: monthlyData.map(d => d.cmv),
  }), [monthlyData]);

  const healthScores = useMemo(() => calcHealthScores(filtered), [filtered]);

  const unidadeData = useMemo(() => {
    const byUnidade = groupBy(filtered, 'unidade');
    return Object.entries(byUnidade).map(([name, recs]) => ({
      unidade: name,
      receita: recs.reduce((s, r) => s + r.receitaBruta, 0),
      despesa: recs.reduce((s, r) => s + r.despesaTotal, 0),
    }));
  }, [filtered]);

  const costData = useMemo(() => {
    const mao = filtered.reduce((s, r) => s + r.maoDeObra, 0);
    const imp = filtered.reduce((s, r) => s + r.impostos, 0);
    const mp = filtered.reduce((s, r) => s + (r.materiaPrima || 0), 0);
    const prevMao = prevData?.reduce((s, r) => s + r.maoDeObra, 0);
    const prevImp = prevData?.reduce((s, r) => s + r.impostos, 0);
    const prevMp = prevData?.reduce((s, r) => s + (r.materiaPrima || 0), 0);
    return [
      { name: 'Mão de Obra', value: mao, prevValue: prevMao, color: PIE_COLORS[0] },
      { name: 'Impostos', value: imp, prevValue: prevImp, color: PIE_COLORS[1] },
      { name: 'Matéria Prima', value: mp, prevValue: prevMp, color: PIE_COLORS[2] },
    ];
  }, [filtered, prevData]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28" />)}
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
          <h1 className="text-2xl font-display font-bold">Dashboard Regional</h1>
          <p className="text-sm text-muted-foreground">Análise por regional</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const win = window.open('', '_blank', 'width=1200,height=800');
              if (!win) return;

              // ----- Dados filtrados para a regional + mês selecionado -----
              const allRegionalRecs = allRecords.filter(r => r.regional === regional);
              const allMonths = [...new Set(allRegionalRecs.map(r => r.data))].filter(Boolean).sort();
              // Usa o mês mais recente entre os selecionados; se nenhum, usa o último disponível
              const selectedSorted = periodo.length > 0 ? [...periodo].sort() : [];
              const currentMonth = selectedSorted[selectedSorted.length - 1] || allMonths[allMonths.length - 1] || '';
              const currentIdx = allMonths.indexOf(currentMonth);
              const last6Months = currentIdx >= 0 ? allMonths.slice(Math.max(0, currentIdx - 5), currentIdx + 1) : allMonths.slice(-6);
              const monthRecs = allRegionalRecs.filter(r => r.data === currentMonth);
              const monthMetrics = calcMetrics(monthRecs);
              const prevMonth = currentIdx > 0 ? allMonths[currentIdx - 1] : undefined;
              const prevMonthRecs = prevMonth ? allRegionalRecs.filter(r => r.data === prevMonth) : [];
              const prevMonthMetrics = prevMonth ? calcMetrics(prevMonthRecs) : undefined;
              const monthAlerts = generateAlerts(monthRecs);
              const dangerAlerts = monthAlerts.filter(a => a.type === 'danger');
              const warningAlerts = monthAlerts.filter(a => a.type === 'warning');
              const monthHealth = calcHealthScores(monthRecs);

              // Evolução últimos 6 meses
              const evolution = last6Months.map(m => {
                const recs = allRegionalRecs.filter(r => r.data === m);
                const mt = calcMetrics(recs);
                return { mes: m, receita: mt.receitaBruta, margem: mt.margem };
              });
              const maxRev = Math.max(...evolution.map(e => e.receita), 1);

              // Metas por unidade (margem atual vs meta)
              const metasRows = monthHealth.map(u => {
                const uRecs = monthRecs.filter(r => r.unidade === u.unidade);
                const meta = uRecs.length > 0 ? uRecs.reduce((s, r) => s + r.meta, 0) / uRecs.length : 0;
                const atual = u.metrics.margem;
                const atingimento = meta > 0 ? (atual / meta) * 100 : 0;
                const status = atingimento >= 100 ? { label: 'Atingida', color: '#10b981' }
                  : atingimento >= 80 ? { label: 'Próxima', color: '#f59e0b' }
                  : { label: 'Abaixo', color: '#ef4444' };
                return { unidade: u.unidade, meta, atual, atingimento, status };
              });

              // RH / Pessoas
              const rhMonth = allRhRecords.filter(r => r.regional === regional && r.data === currentMonth);
              const rhByUnit = Object.entries(groupBy(rhMonth, 'unidade')).map(([u, recs]) => {
                const mdo = recs.reduce((s, r) => s + r.maoDeObra, 0);
                const he = recs.reduce((s, r) => s + r.horaExtra, 0);
                const pct = recs.reduce((s, r) => s + r.percentualMdo, 0) / recs.length;
                const meta = recs.reduce((s, r) => s + r.metaPercentual, 0) / recs.length;
                const func = recs.reduce((s, r) => s + r.numFuncionarios, 0);
                return { unidade: u, mdo, he, pct, meta, func };
              });

              const kpi = (label: string, value: string, delta: string | undefined, color: string) => `
                <div class="kpi" style="border-top:3px solid ${color}">
                  <div class="l">${label}</div>
                  <div class="v">${value}</div>
                  ${delta ? `<div class="d">${delta}</div>` : ''}
                </div>`;

              const deltaStr = (cur: number, prev?: number, isPct = false) => {
                if (prev === undefined || prev === 0) return undefined;
                const diff = isPct ? cur - prev : ((cur - prev) / prev) * 100;
                const arrow = diff >= 0 ? '▲' : '▼';
                const col = diff >= 0 ? '#10b981' : '#ef4444';
                return `<span style="color:${col}">${arrow} ${Math.abs(diff).toFixed(1)}${isPct ? 'pp' : '%'}</span>`;
              };

              const alertList = (arr: typeof monthAlerts, type: 'danger' | 'warning') => {
                if (arr.length === 0) return `<div class="empty">Nenhum alerta ${type === 'danger' ? 'crítico' : 'de atenção'}.</div>`;
                const bg = type === 'danger' ? '#fee2e2' : '#fef3c7';
                const bd = type === 'danger' ? '#ef4444' : '#f59e0b';
                const fg = type === 'danger' ? '#991b1b' : '#92400e';
                return arr.map(a => `
                  <div class="alert" style="background:${bg};border-left:4px solid ${bd};color:${fg}">
                    <span class="badge" style="background:${bd}">${a.unidade}</span>
                    <span>${a.message}</span>
                  </div>`).join('');
              };

              const healthRows = monthHealth.map((u, i) => {
                const c = u.grade === 'green' ? '#10b981' : u.grade === 'yellow' ? '#f59e0b' : '#ef4444';
                return `
                  <tr>
                    <td>${i + 1}</td>
                    <td><strong>${u.unidade}</strong></td>
                    <td style="text-align:center;width:200px">
                      <div style="display:flex;align-items:center;gap:8px">
                        <div style="flex:1;height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden">
                          <div style="width:${u.score}%;height:100%;background:${c}"></div>
                        </div>
                        <strong style="color:${c};min-width:30px">${u.score}</strong>
                      </div>
                    </td>
                    <td style="text-align:right">${formatPercent(u.metrics.margem)}</td>
                    <td style="text-align:right">${formatPercent(u.metrics.cmvPercent)}</td>
                    <td style="text-align:right">${formatPercent(u.metrics.maoDeObraPercent)}</td>
                  </tr>`;
              }).join('');

              const evolutionBars = evolution.map(e => {
                const h = (e.receita / maxRev) * 100;
                const col = e.margem < 0 ? '#ef4444' : e.margem < 5 ? '#f59e0b' : '#10b981';
                return `
                  <div class="bar-col">
                    <div class="bar-val">${(e.receita / 1000).toFixed(0)}k</div>
                    <div class="bar-wrap">
                      <div class="bar" style="height:${h}%;background:${col}"></div>
                    </div>
                    <div class="bar-lbl">${e.mes}</div>
                    <div class="bar-mg" style="color:${col}">${e.margem.toFixed(1)}%</div>
                  </div>`;
              }).join('');

              const metasRowsHtml = metasRows.map(m => `
                <tr>
                  <td><strong>${m.unidade}</strong></td>
                  <td style="text-align:right">${m.meta.toFixed(1)}%</td>
                  <td style="text-align:right">${m.atual.toFixed(1)}%</td>
                  <td style="text-align:right;font-weight:600">${m.atingimento.toFixed(0)}%</td>
                  <td style="text-align:center">
                    <span class="badge" style="background:${m.status.color}">${m.status.label}</span>
                  </td>
                </tr>`).join('');

              const rhRowsHtml = rhByUnit.length === 0
                ? `<tr><td colspan="6" style="text-align:center;color:#666;padding:20px">Sem dados de RH para ${currentMonth}.</td></tr>`
                : rhByUnit.map(r => {
                  const c = r.pct > r.meta ? '#ef4444' : r.pct > r.meta * 0.9 ? '#f59e0b' : '#10b981';
                  return `
                    <tr>
                      <td><strong>${r.unidade}</strong></td>
                      <td style="text-align:right">${r.func}</td>
                      <td style="text-align:right">${formatCurrency(r.mdo)}</td>
                      <td style="text-align:right">${formatCurrency(r.he)}</td>
                      <td style="text-align:right;color:${c};font-weight:600">${r.pct.toFixed(1)}%</td>
                      <td style="text-align:right">${r.meta.toFixed(1)}%</td>
                    </tr>`;
                }).join('');

              const html = `<!doctype html><html><head><meta charset="utf-8">
                <title>Regional ${regional} - ${currentMonth}</title>
                <style>
                  *{box-sizing:border-box}
                  body{font-family:-apple-system,'Segoe UI',Arial,sans-serif;margin:0;color:#1f2937;background:#fff}
                  .cover{background:linear-gradient(135deg,#1D9E75 0%,#178a65 100%);color:#fff;padding:60px 40px;page-break-after:always}
                  .cover .logo{width:80px;height:80px;border-radius:14px;background:#fff;padding:8px;display:flex;align-items:center;justify-content:center;margin-bottom:24px;box-shadow:0 4px 14px rgba(0,0,0,.15)}
                  .cover .logo img{max-width:100%;max-height:100%;object-fit:contain}
                  .cover h1{margin:0;font-size:42px;font-weight:800;letter-spacing:-1px}
                  .cover h2{margin:8px 0 0;font-size:22px;font-weight:400;color:#d1fae5}
                  .cover .meta{margin-top:40px;font-size:14px;color:#ecfdf5}
                  .cover .manager{margin-top:18px;font-size:14px;color:#ecfdf5}
                  .cover .manager strong{color:#fff;font-size:16px}
                  .cover .tag{display:inline-block;background:rgba(255,255,255,.18);color:#fff;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;backdrop-filter:blur(4px)}
                  .page{padding:32px 40px}
                  h2.section{font-size:20px;margin:0 0 16px;color:#0f172a;border-bottom:2px solid #e5e7eb;padding-bottom:8px}
                  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px}
                  .kpi{background:#f9fafb;border-radius:8px;padding:14px}
                  .kpi .l{font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;font-weight:600}
                  .kpi .v{font-size:22px;font-weight:700;margin-top:6px;color:#0f172a}
                  .kpi .d{font-size:11px;margin-top:4px;font-weight:600}
                  .alert{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:6px;margin-bottom:6px;font-size:12px}
                  .badge{display:inline-block;color:#fff;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
                  .empty{padding:12px;color:#6b7280;font-size:12px;background:#f9fafb;border-radius:6px;text-align:center}
                  table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
                  th,td{border-bottom:1px solid #e5e7eb;padding:8px;text-align:left}
                  th{background:#f3f4f6;text-transform:uppercase;font-size:10px;letter-spacing:.5px;color:#6b7280}
                  .chart{display:flex;align-items:flex-end;gap:14px;height:220px;padding:16px;background:#f9fafb;border-radius:8px;margin-bottom:24px}
                  .bar-col{flex:1;display:flex;flex-direction:column;align-items:center;height:100%}
                  .bar-val{font-size:10px;color:#6b7280;margin-bottom:4px;font-weight:600}
                  .bar-wrap{flex:1;width:100%;display:flex;align-items:flex-end;justify-content:center}
                  .bar{width:80%;min-height:4px;border-radius:4px 4px 0 0}
                  .bar-lbl{font-size:10px;color:#374151;margin-top:6px;font-weight:600}
                  .bar-mg{font-size:10px;font-weight:700;margin-top:2px}
                  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px}
                  @media print{
                    .cover{page-break-after:always}
                    .page-break{page-break-before:always}
                    button{display:none}
                  }
                </style></head><body>
                <div class="cover">
                  <div class="logo"><img src="${logoUrl}" alt="Logo" onerror="this.style.display='none'"/></div>
                  <span class="tag">Relatório Regional</span>
                  <h1 style="margin-top:18px">${regional}</h1>
                  <h2>Mês de referência: ${currentMonth}</h2>
                  <div class="manager">
                    Gerente responsável: <strong>${managers[regional] || '—'}</strong>
                  </div>
                  <div class="meta">
                    Receita: <strong style="color:#fff">${formatCurrency(monthMetrics.receitaBruta)}</strong> ·
                    Margem: <strong style="color:#fff">${formatPercent(monthMetrics.margem)}</strong> ·
                    Unidades: <strong style="color:#fff">${monthHealth.length}</strong>
                  </div>
                  <div class="meta" style="margin-top:30px;font-size:11px;color:#d1fae5;opacity:.8">
                    Gerado em ${new Date().toLocaleString('pt-BR')}
                  </div>
                </div>

                <div class="page">
                  <h2 class="section">Indicadores do mês</h2>
                  <div class="kpis">
                    ${kpi('Receita Bruta', formatCurrency(monthMetrics.receitaBruta), deltaStr(monthMetrics.receitaBruta, prevMonthMetrics?.receitaBruta), '#3b82f6')}
                    ${kpi('Despesa Total', formatCurrency(monthMetrics.despesaTotal), deltaStr(monthMetrics.despesaTotal, prevMonthMetrics?.despesaTotal), '#8b5cf6')}
                    ${kpi('Margem', formatPercent(monthMetrics.margem), deltaStr(monthMetrics.margem, prevMonthMetrics?.margem, true), monthMetrics.margem < 0 ? '#ef4444' : monthMetrics.margem < 5 ? '#f59e0b' : '#10b981')}
                    ${kpi('CMV', formatPercent(monthMetrics.cmvPercent), deltaStr(monthMetrics.cmvPercent, prevMonthMetrics?.cmvPercent, true), monthMetrics.cmvPercent > 50 ? '#ef4444' : '#10b981')}
                  </div>

                  <h2 class="section">Alertas críticos</h2>
                  ${alertList(dangerAlerts, 'danger')}

                  <h2 class="section" style="margin-top:24px">Alertas de atenção</h2>
                  ${alertList(warningAlerts, 'warning')}
                </div>

                <div class="page page-break">
                  <h2 class="section">Evolução — últimos ${evolution.length} meses</h2>
                  <div class="chart">${evolutionBars}</div>

                  <h2 class="section">Score de saúde por unidade</h2>
                  <table>
                    <thead><tr>
                      <th>#</th><th>Unidade</th><th style="text-align:center">Score</th>
                      <th style="text-align:right">Margem</th><th style="text-align:right">CMV</th><th style="text-align:right">MdO</th>
                    </tr></thead>
                    <tbody>${healthRows}</tbody>
                  </table>
                </div>

                <div class="page page-break">
                  <h2 class="section">Metas por unidade — ${currentMonth}</h2>
                  <table>
                    <thead><tr>
                      <th>Unidade</th>
                      <th style="text-align:right">Meta</th>
                      <th style="text-align:right">Atual</th>
                      <th style="text-align:right">% Atingimento</th>
                      <th style="text-align:center">Status</th>
                    </tr></thead>
                    <tbody>${metasRowsHtml}</tbody>
                  </table>

                  <h2 class="section" style="margin-top:28px">Pessoas — MdO e Hora Extra</h2>
                  <table>
                    <thead><tr>
                      <th>Unidade</th>
                      <th style="text-align:right">Funcionários</th>
                      <th style="text-align:right">MdO Total</th>
                      <th style="text-align:right">Hora Extra</th>
                      <th style="text-align:right">% MdO</th>
                      <th style="text-align:right">Meta</th>
                    </tr></thead>
                    <tbody>${rhRowsHtml}</tbody>
                  </table>
                </div>

                <script>window.onload=()=>setTimeout(()=>window.print(),400)</script>
                </body></html>`;
              win.document.write(html);
              win.document.close();
            }}
          >
            <FileDown className="w-4 h-4 mr-1" /> Exportar PDF
          </Button>
          <MultiSelectUnidade
            options={meses}
            selected={periodo}
            onChange={setPeriodo}
            allLabel="Todos os meses"
            pluralLabel="meses"
            width="w-[180px]"
          />
          <Select value={regional} onValueChange={setRegional}>
            <SelectTrigger className="w-[180px] bg-secondary border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {regionais.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

      </div>

      {selectedMonths.length > 1 && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-muted-foreground">Comparar com:</span>
          <ToggleGroup
            type="single"
            value={compareMode}
            onValueChange={(v) => v && setCompareMode(v as CompareMode)}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="previous-month" className="text-xs">Mês anterior</ToggleGroupItem>
            <ToggleGroupItem value="previous-window" className="text-xs">Janela anterior ({selectedMonths.length} meses)</ToggleGroupItem>
          </ToggleGroup>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard title="Receita Total" value={metrics.receitaBruta} format="currency" change={pct(metrics.receitaBruta, prevMetrics?.receitaBruta)} subtitle={periodLabel} icon={<DollarSign className="w-5 h-5" />} sparkline={sparklines.receita} />
        <KpiCard title="Despesa Total" value={metrics.despesaTotal} format="currency" change={pct(metrics.despesaTotal, prevMetrics?.despesaTotal)} subtitle={periodLabel} icon={<TrendingUp className="w-5 h-5" />} delay={0.1} sparkline={sparklines.despesa} invertTrend />
        <KpiCard title="Margem (%)" value={metrics.margem} format="percent" change={prevMetrics ? metrics.margem - prevMetrics.margem : undefined} subtitle={`Meta: ${metrics.meta.toFixed(1)}%`} icon={<Percent className="w-5 h-5" />} delay={0.2} />
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="glass-card rounded-xl p-5">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Receita por Unidade</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={unidadeData}>
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

      <DonutChart
        title="Distribuição de Custos"
        items={costData}
        totalLabel="Total"
        comparisonLabel={periodLabel}
        height={200}
      />

      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-muted-foreground">Métrica do ranking:</span>
          <ToggleGroup
            type="single"
            value={rankMetric}
            onValueChange={(v) => v && setRankMetric(v as 'receitaBruta' | 'ebitda' | 'margem')}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="receitaBruta" className="text-xs">Receita</ToggleGroupItem>
            <ToggleGroupItem value="ebitda" className="text-xs">EBITDA</ToggleGroupItem>
            <ToggleGroupItem value="margem" className="text-xs">Margem</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <RankingPanel data={ranking} previousData={prevRanking} format={rankFormat} title="Ranking de Unidades" metricLabel={metricLabel} subtitle={rankingSubtitle} />
      </div>

      {/* Ranking por Score de Saúde */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="glass-card rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Ranking por Score de Saúde
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-2 pb-3 font-semibold text-muted-foreground uppercase tracking-wider">#</th>
                <th className="text-left p-2 pb-3 font-semibold text-muted-foreground uppercase tracking-wider">Unidade</th>
                <th className="text-center p-2 pb-3 font-semibold text-muted-foreground uppercase tracking-wider">Score</th>
                <th className="text-right p-2 pb-3 font-semibold text-muted-foreground uppercase tracking-wider">Receita</th>
                <th className="text-right p-2 pb-3 font-semibold text-muted-foreground uppercase tracking-wider">Margem</th>
                <th className="text-right p-2 pb-3 font-semibold text-muted-foreground uppercase tracking-wider">CMV</th>
                <th className="text-right p-2 pb-3 font-semibold text-muted-foreground uppercase tracking-wider">MdO</th>
              </tr>
            </thead>
            <tbody>
              {healthScores.map((u, i) => {
                const scoreColor = u.grade === 'green' ? 'text-success' : u.grade === 'yellow' ? 'text-warning' : 'text-danger';
                const scoreBg = u.grade === 'green' ? 'bg-success' : u.grade === 'yellow' ? 'bg-warning' : 'bg-danger';
                return (
                  <tr key={u.unidade} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="p-2 py-3 text-muted-foreground font-medium">{i + 1}</td>
                    <td className="p-2 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${scoreBg}`} />
                        <span className="font-medium">{u.unidade}</span>
                      </div>
                    </td>
                    <td className="p-2 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`text-sm font-bold ${scoreColor}`}>{u.score}</span>
                        <div className="w-16 h-1 rounded-full bg-secondary">
                          <div className={`h-1 rounded-full ${scoreBg}`} style={{ width: `${u.score}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="p-2 py-3 text-right text-muted-foreground">
                      {formatCurrency(filtered.filter(r => r.unidade === u.unidade).reduce((s, r) => s + r.receitaBruta, 0))}
                    </td>
                    <td className={`p-2 py-3 text-right font-medium ${u.metrics.margem < 0 ? 'text-danger' : u.metrics.margem < 5 ? 'text-warning' : 'text-success'}`}>
                      {formatPercent(u.metrics.margem)}
                    </td>
                    <td className={`p-2 py-3 text-right font-medium ${u.metrics.cmvPercent > 50 ? 'text-danger' : u.metrics.cmvPercent > 40 ? 'text-warning' : 'text-success'}`}>
                      {formatPercent(u.metrics.cmvPercent)}
                    </td>
                    <td className={`p-2 py-3 text-right font-medium ${u.metrics.maoDeObraPercent > 35 ? 'text-danger' : u.metrics.maoDeObraPercent > 30 ? 'text-warning' : 'text-success'}`}>
                      {formatPercent(u.metrics.maoDeObraPercent)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
