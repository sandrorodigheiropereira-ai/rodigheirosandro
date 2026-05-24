import { useState, useMemo } from "react";
import {
  DollarSign,
  TrendingUp,
  Percent,
  BarChart3,
  FileDown,
  AlertCircle,
  AlertTriangle,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { KpiCard } from "@/components/KpiCard";
import { FiltersBar } from "@/components/FiltersBar";
import { calcMetrics, generateAlerts, groupBy, formatCurrency, formatPercent, rankUnidades } from "@/lib/calculations";
import { useSheetData, getRegionaisFromData, getUnidadesFromData } from "@/hooks/useSheetData";
import { useRhData } from "@/hooks/useRhData";
import { filterOutAdm } from "@/lib/constants";
import { exportPdf } from "@/lib/exportPdf";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LabelList,
} from "recharts";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

type CompareMode = "previous-month" | "previous-window";

export default function ConsolidadoDashboard() {
  const [periodo, setPeriodo] = useState<string[]>([]);
  const [regional, setRegional] = useState("all");
  const [unidade, setUnidade] = useState<string[]>([]);
  const [compareMode, setCompareMode] = useState<CompareMode>("previous-window");
  const navigate = useNavigate();

  const { data: sheetData, isLoading, error } = useSheetData();
  const { data: rhData } = useRhData();
  const rhRecords = useMemo(() => rhData?.data || [], [rhData]);
  const allRecords = useMemo(() => filterOutAdm(sheetData?.data || []), [sheetData]);

  const filtered = useMemo(() => {
    let data = allRecords;
    if (periodo.length > 0) data = data.filter((r) => periodo.includes(r.data));
    if (regional !== "all") data = data.filter((r) => r.regional === regional);
    if (unidade.length > 0) data = data.filter((r) => unidade.includes(r.unidade));
    return data;
  }, [periodo, regional, unidade, allRecords]);

  const meses = useMemo(() => [...new Set(allRecords.map((r) => r.data))].sort(), [allRecords]);

  const selectedMonths = useMemo(() => (periodo.length > 0 ? [...periodo].sort() : meses), [periodo, meses]);

  const prevMonths = useMemo(() => {
    if (selectedMonths.length === 0) return [];
    const earliestIdx = meses.indexOf(selectedMonths[0]);
    if (earliestIdx <= 0) return [];
    const N = compareMode === "previous-month" ? 1 : selectedMonths.length;
    return meses.slice(Math.max(0, earliestIdx - N), earliestIdx);
  }, [selectedMonths, meses, compareMode]);

  const prevData =
    prevMonths.length > 0
      ? allRecords.filter(
          (r) =>
            prevMonths.includes(r.data) &&
            (regional === "all" || r.regional === regional) &&
            (unidade.length === 0 || unidade.includes(r.unidade)),
        )
      : undefined;

  const metrics = calcMetrics(filtered, prevData);
  const prevMetrics = prevData ? calcMetrics(prevData) : undefined;
  const alerts = generateAlerts(filtered);
  const dangerAlerts = alerts.filter((a) => a.type === "danger");
  const warningAlerts = alerts.filter((a) => a.type === "warning");

  const rankingMargem = rankUnidades(filtered, "margem");
  const prevRankingMargem = prevData ? rankUnidades(prevData, "margem") : undefined;

  const pct = (cur: number, prev?: number) =>
    prev !== undefined && prev > 0 ? ((cur - prev) / prev) * 100 : undefined;

  const periodLabel =
    prevMonths.length > 0
      ? `vs ${prevMonths.length === 1 ? "mês anterior" : `${prevMonths.length} meses anteriores`}`
      : undefined;

  const monthlyData = useMemo(() => {
    const byMonth = groupBy(filtered, "data");
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, recs]) => {
        const m = calcMetrics(recs);
        return { mes: month, receita: m.receitaBruta, despesa: m.despesaTotal, margem: m.margem, cmv: m.cmvPercent };
      });
  }, [filtered]);

  const sparklines = useMemo(
    () => ({
      receita: monthlyData.map((d) => d.receita),
      despesa: monthlyData.map((d) => d.despesa),
      margem: monthlyData.map((d) => d.margem),
      cmv: monthlyData.map((d) => d.cmv),
    }),
    [monthlyData],
  );

  const regionalData = useMemo(() => {
    const byRegional = groupBy(filtered, "regional");
    return Object.entries(byRegional)
      .map(([name, recs]) => ({
        regional: name,
        receita: recs.reduce((s, r) => s + r.receitaBruta, 0),
        despesa: recs.reduce((s, r) => s + r.despesaTotal, 0),
        margem: calcMetrics(recs).margem,
      }))
      .sort((a, b) => b.receita - a.receita);
  }, [filtered]);

  const top3Margem = rankingMargem.slice(0, 3);
  const bottom3Margem = rankingMargem.slice(-3).reverse();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Dashboard Consolidado</h1>
          <p className="text-sm text-muted-foreground">Visão geral de todas as regionais • Dados do Google Sheets</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <FiltersBar
            periodo={periodo}
            regional={regional}
            unidade={unidade}
            onPeriodoChange={(v) => setPeriodo(Array.isArray(v) ? v : v === "all" ? [] : [v])}
            onRegionalChange={(v) => {
              setRegional(v);
              setUnidade([]);
            }}
            onUnidadeChange={(v) => setUnidade(Array.isArray(v) ? v : v === "all" ? [] : [v])}
            records={allRecords}
            multiSelectUnidade
            multiSelectPeriodo
          />
          <Button
            onClick={() => exportPdf(allRecords, rhRecords)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          >
            <FileDown className="w-4 h-4" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Modo de comparação */}
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
            <ToggleGroupItem value="previous-month" className="text-xs">
              Mês anterior
            </ToggleGroupItem>
            <ToggleGroupItem value="previous-window" className="text-xs">
              Janela anterior ({selectedMonths.length} meses)
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Receita Total"
          value={metrics.receitaBruta}
          format="currency"
          change={pct(metrics.receitaBruta, prevMetrics?.receitaBruta)}
          subtitle={periodLabel}
          icon={<DollarSign className="w-5 h-5" />}
          delay={0}
          sparkline={sparklines.receita}
        />
        <KpiCard
          title="Despesa Total"
          value={metrics.despesaTotal}
          format="currency"
          change={pct(metrics.despesaTotal, prevMetrics?.despesaTotal)}
          subtitle={periodLabel}
          icon={<TrendingUp className="w-5 h-5" />}
          delay={0.08}
          sparkline={sparklines.despesa}
          invertTrend
        />
        <KpiCard
          title="Margem (%)"
          value={metrics.margem}
          format="percent"
          change={prevMetrics ? metrics.margem - prevMetrics.margem : undefined}
          subtitle={`Meta: ${metrics.meta.toFixed(1)}%`}
          icon={<Percent className="w-5 h-5" />}
          delay={0.16}
          sparkline={sparklines.margem}
        />
        <KpiCard
          title="CMV"
          value={metrics.cmvPercent}
          format="percent"
          change={prevMetrics ? metrics.cmvPercent - prevMetrics.cmvPercent : undefined}
          subtitle={periodLabel}
          icon={<BarChart3 className="w-5 h-5" />}
          delay={0.24}
          sparkline={sparklines.cmv}
          invertTrend
        />
      </div>

      {/* Contador de alertas */}
      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        onClick={() => navigate("/alertas")}
        className="w-full glass-card rounded-xl p-4 flex items-center justify-between hover:border-primary/30 transition-colors group"
      >
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-danger" />
            <div className="text-left">
              <p className="text-2xl font-display font-bold text-danger">{dangerAlerts.length}</p>
              <p className="text-[10px] font-semibold text-danger uppercase tracking-wider">Críticos</p>
            </div>
          </div>
          <div className="w-px h-10 bg-border" />
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <div className="text-left">
              <p className="text-2xl font-display font-bold text-warning">{warningAlerts.length}</p>
              <p className="text-[10px] font-semibold text-warning uppercase tracking-wider">Atenção</p>
            </div>
          </div>
          <div className="w-px h-10 bg-border" />
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-success" />
            <div className="text-left">
              <p className="text-2xl font-display font-bold text-success">
                {[...new Set(filtered.map((r) => r.unidade))].length -
                  [...new Set(alerts.map((a) => a.unidade))].length}
              </p>
              <p className="text-[10px] font-semibold text-success uppercase tracking-wider">Saudáveis</p>
            </div>
          </div>
          <div className="w-px h-10 bg-border hidden sm:block" />
          <p className="text-sm text-muted-foreground hidden sm:block">
            {dangerAlerts.length > 0
              ? `${dangerAlerts[0].unidade} — ${dangerAlerts[0].message}`
              : "Nenhum alerta crítico no período"}
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground transition-colors shrink-0">
          Ver todos
          <ChevronRight className="w-4 h-4" />
        </div>
      </motion.button>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Evolução mensal */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="lg:col-span-3 glass-card rounded-xl p-5"
        >
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Evolução Mensal</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthlyData} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1D9E75" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#1D9E75" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradDespesa" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E24B4A" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#E24B4A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 18%)" vertical={false} />
              <XAxis
                dataKey="mes"
                tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(222 44% 9%)",
                  border: "1px solid hsl(222 30% 18%)",
                  borderRadius: "8px",
                  color: "hsl(210 40% 96%)",
                  fontSize: 12,
                }}
                formatter={(v: number) => formatCurrency(v)}
              />
              <Legend iconType="circle" wrapperStyle={{ paddingTop: 8, fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="receita"
                name="Receita"
                stroke="#1D9E75"
                strokeWidth={2.5}
                fill="url(#gradReceita)"
                dot={{ r: 3, fill: "#1D9E75", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              >
                <LabelList
                  dataKey="receita"
                  position="top"
                  formatter={(v: number) => `${Math.round(v / 1000)}k`}
                  style={{ fill: "#1D9E75", fontSize: 9, fontWeight: 600 }}
                />
              </Area>
              <Area
                type="monotone"
                dataKey="despesa"
                name="Despesa"
                stroke="#E24B4A"
                strokeWidth={2.5}
                fill="url(#gradDespesa)"
                dot={{ r: 3, fill: "#E24B4A", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              >
                <LabelList
                  dataKey="despesa"
                  position="bottom"
                  formatter={(v: number) => `${Math.round(v / 1000)}k`}
                  style={{ fill: "#E24B4A", fontSize: 9, fontWeight: 600 }}
                />
              </Area>
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Barras por regional */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 glass-card rounded-xl p-5"
        >
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Por Regional</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={regionalData} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 18%)" horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                tick={{ fill: "hsl(215 20% 55%)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="regional"
                tick={{ fill: "hsl(215 20% 55%)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={70}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(222 44% 9%)",
                  border: "1px solid hsl(222 30% 18%)",
                  borderRadius: "8px",
                  color: "hsl(210 40% 96%)",
                  fontSize: 12,
                }}
                formatter={(v: number) => formatCurrency(v)}
              />
              <Bar dataKey="receita" name="Receita" fill="#1D9E75" radius={[0, 4, 4, 0]}>
                <LabelList
                  dataKey="receita"
                  position="right"
                  formatter={(v: number) => `${Math.round(v / 1000)}k`}
                  style={{ fill: "#1D9E75", fontSize: 9, fontWeight: 600 }}
                />
              </Bar>
              <Bar dataKey="despesa" name="Despesa" fill="#E24B4A" radius={[0, 4, 4, 0]}>
                <LabelList
                  dataKey="despesa"
                  position="right"
                  formatter={(v: number) => `${Math.round(v / 1000)}k`}
                  style={{ fill: "#E24B4A", fontSize: 9, fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Ranking Top 3 e Bottom 3 por Margem */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* Top 3 */}
        <div className="glass-card rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-base">🏆</span>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Top 3 — Melhor Margem
            </h3>
          </div>
          <div className="space-y-2">
            {top3Margem.map((u, i) => {
              const prev = prevRankingMargem?.find((p) => p.unidade === u.unidade);
              const delta = prev ? u.value - prev.value : null;
              return (
                <div
                  key={u.unidade}
                  className="flex items-center gap-3 p-3 rounded-lg bg-success/5 border border-success/20"
                >
                  <span className="text-lg font-bold text-success w-6 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold truncate">{u.unidade}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        {delta !== null && (
                          <span className={`text-[10px] font-semibold ${delta >= 0 ? "text-success" : "text-danger"}`}>
                            {delta >= 0 ? "+" : ""}
                            {delta.toFixed(1)}pp
                          </span>
                        )}
                        <span className="text-sm font-bold text-success">{formatPercent(u.value)}</span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-secondary mt-1.5">
                      <div
                        className="h-1.5 rounded-full bg-success"
                        style={{ width: `${Math.min(100, Math.max(0, u.value))}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{u.regional}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom 3 */}
        <div className="glass-card rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Bottom 3 — Pior Margem
            </h3>
          </div>
          <div className="space-y-2">
            {bottom3Margem.map((u, i) => {
              const prev = prevRankingMargem?.find((p) => p.unidade === u.unidade);
              const delta = prev ? u.value - prev.value : null;
              const isNeg = u.value < 0;
              return (
                <div
                  key={u.unidade}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${isNeg ? "bg-danger/5 border-danger/20" : "bg-warning/5 border-warning/20"}`}
                >
                  <span className={`text-lg font-bold w-6 shrink-0 ${isNeg ? "text-danger" : "text-warning"}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold truncate">{u.unidade}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        {delta !== null && (
                          <span className={`text-[10px] font-semibold ${delta >= 0 ? "text-success" : "text-danger"}`}>
                            {delta >= 0 ? "+" : ""}
                            {delta.toFixed(1)}pp
                          </span>
                        )}
                        <span className={`text-sm font-bold ${isNeg ? "text-danger" : "text-warning"}`}>
                          {formatPercent(u.value)}
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-secondary mt-1.5">
                      <div
                        className={`h-1.5 rounded-full ${isNeg ? "bg-danger" : "bg-warning"}`}
                        style={{ width: `${Math.min(100, Math.max(0, Math.abs(u.value)))}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{u.regional}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
