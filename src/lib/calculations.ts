import { FinancialRecord, CalculatedMetrics, Alert } from '@/types/financial';

export function calcMetrics(records: FinancialRecord[], prevRecords?: FinancialRecord[]): CalculatedMetrics {
  const receitaBruta = records.reduce((s, r) => s + r.receitaBruta, 0);
  const receitaLiquida = records.reduce((s, r) => s + r.receitaLiquida, 0);
  const cmvTotal = records.reduce((s, r) => s + r.cmv, 0);
  const maoDeObraTotal = records.reduce((s, r) => s + r.maoDeObra, 0);
  const despesaTotal = records.reduce((s, r) => s + r.despesaTotal, 0);
  const margem = receitaBruta > 0 ? ((receitaBruta - despesaTotal) / receitaBruta) * 100 : 0;
  const meta = records.length > 0 ? records.reduce((s, r) => s + r.meta, 0) / records.length : 0;

  const prevCmv = prevRecords?.reduce((s, r) => s + r.cmv, 0) || 0;
  const crescimentoCmv = prevCmv > 0 ? ((cmvTotal - prevCmv) / prevCmv) * 100 : 0;

  return {
    receitaBruta,
    receitaLiquida,
    despesaTotal,
    margem,
    meta,
    cmvPercent: receitaLiquida > 0 ? (cmvTotal / receitaLiquida) * 100 : 0,
    maoDeObraPercent: receitaLiquida > 0 ? (maoDeObraTotal / receitaLiquida) * 100 : 0,
    crescimentoCmv,
  };
}

export function generateAlerts(records: FinancialRecord[]): Alert[] {
  const alerts: Alert[] = [];
  const byUnidade = groupBy(records, 'unidade');
  const months = [...new Set(records.map(r => r.data))].sort();
  const lastMonth = months[months.length - 1];
  const prevMonth = months.length >= 2 ? months[months.length - 2] : null;

  for (const [unidade, recs] of Object.entries(byUnidade)) {
    const metrics = calcMetrics(recs);
    const regional = recs[0].regional;

    // --- CMV: limites em três faixas ---
    if (metrics.cmvPercent > 50) {
      alerts.push({
        type: 'danger',
        message: `CMV crítico: ${metrics.cmvPercent.toFixed(1)}% (limite: 50%)`,
        unidade,
        regional,
        value: metrics.cmvPercent,
      });
    } else if (metrics.cmvPercent > 40) {
      alerts.push({
        type: 'warning',
        message: `CMV elevado: ${metrics.cmvPercent.toFixed(1)}% (ideal ≤ 40%)`,
        unidade,
        regional,
        value: metrics.cmvPercent,
      });
    }

    // --- Mão de obra: dois níveis ---
    if (metrics.maoDeObraPercent > 35) {
      alerts.push({
        type: 'danger',
        message: `Mão de obra crítica: ${metrics.maoDeObraPercent.toFixed(1)}% (limite: 35%)`,
        unidade,
        regional,
        value: metrics.maoDeObraPercent,
      });
    } else if (metrics.maoDeObraPercent > 30) {
      alerts.push({
        type: 'warning',
        message: `Mão de obra elevada: ${metrics.maoDeObraPercent.toFixed(1)}% (ideal ≤ 30%)`,
        unidade,
        regional,
        value: metrics.maoDeObraPercent,
      });
    }

    // --- Margem negativa ---
    if (metrics.margem < 0) {
      alerts.push({
        type: 'danger',
        message: `Margem negativa: ${metrics.margem.toFixed(1)}%`,
        unidade,
        regional,
        value: metrics.margem,
      });
    }

    // --- Meta não atingida (margem abaixo da meta) ---
    const metaVal = recs.length > 0 ? recs.reduce((s, r) => s + r.meta, 0) / recs.length : 0;
    if (metaVal > 0 && metrics.margem < metaVal) {
      const gap = metaVal - metrics.margem;
      if (gap > 5) {
        alerts.push({
          type: 'warning',
          message: `Meta não atingida: margem ${metrics.margem.toFixed(1)}% vs meta ${metaVal.toFixed(1)}% (gap: ${gap.toFixed(1)}pp)`,
          unidade,
          regional,
          value: gap,
        });
      }
    }

    // --- Queda de receita mês a mês ---
    if (prevMonth && lastMonth) {
      const lastRev = recs.filter(r => r.data === lastMonth).reduce((s, r) => s + r.receitaBruta, 0);
      const prevRev = recs.filter(r => r.data === prevMonth).reduce((s, r) => s + r.receitaBruta, 0);
      if (prevRev > 0) {
        const drop = ((prevRev - lastRev) / prevRev) * 100;
        if (drop > 15) {
          alerts.push({
            type: 'danger',
            message: `Queda de receita: ${drop.toFixed(1)}% (${prevMonth} → ${lastMonth})`,
            unidade,
            regional,
            value: drop,
          });
        } else if (drop > 8) {
          alerts.push({
            type: 'warning',
            message: `Receita em queda: ${drop.toFixed(1)}% (${prevMonth} → ${lastMonth})`,
            unidade,
            regional,
            value: drop,
          });
        }
      }
    }

    // --- Receita zero ou ausente no último mês ---
    if (lastMonth) {
      const lastRev = recs.filter(r => r.data === lastMonth).reduce((s, r) => s + r.receitaBruta, 0);
      if (lastRev === 0 && recs.length > 0) {
        alerts.push({
          type: 'info',
          message: `Sem receita registrada em ${lastMonth}`,
          unidade,
          regional,
          value: 0,
        });
      }
    }
  }

  // Ordenar: danger primeiro, depois warning, depois info; dentro do mesmo tipo, pelo valor descendente
  const order: Record<string, number> = { danger: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => order[a.type] - order[b.type] || b.value - a.value);

  return alerts;
}

export function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = String(item[key]);
    (acc[k] = acc[k] || []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export type RankMetric = 'receitaBruta' | 'margem' | 'ebitda';

export function rankUnidades(records: FinancialRecord[], metric: RankMetric = 'receitaBruta') {
  const byUnidade = groupBy(records, 'unidade');
  const ranked = Object.entries(byUnidade).map(([unidade, recs]) => {
    let value = 0;
    if (metric === 'receitaBruta') {
      value = recs.reduce((s, r) => s + r.receitaBruta, 0);
    } else if (metric === 'margem') {
      value = recs.reduce((s, r) => s + r.margem, 0) / recs.length;
    } else {
      // EBITDA proxy: Receita Bruta - Despesa Total
      value = recs.reduce((s, r) => s + (r.receitaBruta - r.despesaTotal), 0);
    }
    return { unidade, regional: recs[0].regional, value };
  });
  ranked.sort((a, b) => b.value - a.value);
  return ranked;
}

export interface HealthScore {
  unidade: string;
  regional: string;
  score: number;
  grade: 'green' | 'yellow' | 'red';
  breakdown: {
    margem: number;
    cmv: number;
    maoDeObra: number;
    meta: number;
  };
  metrics: {
    margem: number;
    cmvPercent: number;
    maoDeObraPercent: number;
    metaAtingida: number;
  };
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, v));
}

function scoreMargem(margem: number, meta: number): number {
  // margem >= meta → 100, margem = 0 → 50, margem negativa → escala até 0
  if (meta > 0 && margem >= meta) return 100;
  if (margem >= 0) {
    const base = 50;
    const bonus = meta > 0 ? (margem / meta) * 50 : margem * 2;
    return clamp(base + bonus);
  }
  // negativa: -10% ou pior → 0
  return clamp(100 + margem * 5, 0, 50);
}

function scoreCmv(cmv: number): number {
  // ≤35% → 100, 40% → 70, 50% → 30, ≥55% → 0
  if (cmv <= 35) return 100;
  if (cmv <= 40) return clamp(100 - ((cmv - 35) / 5) * 30);
  if (cmv <= 50) return clamp(70 - ((cmv - 40) / 10) * 40);
  if (cmv <= 55) return clamp(30 - ((cmv - 50) / 5) * 30);
  return 0;
}

function scoreMaoDeObra(mdo: number): number {
  // ≤25% → 100, 30% → 70, 35% → 30, ≥40% → 0
  if (mdo <= 25) return 100;
  if (mdo <= 30) return clamp(100 - ((mdo - 25) / 5) * 30);
  if (mdo <= 35) return clamp(70 - ((mdo - 30) / 5) * 40);
  if (mdo <= 40) return clamp(30 - ((mdo - 35) / 5) * 30);
  return 0;
}

function scoreMeta(margem: number, meta: number): number {
  if (meta <= 0) return 70; // sem meta definida → neutro
  const pct = (margem / meta) * 100;
  if (pct >= 100) return 100;
  if (pct >= 80) return clamp(60 + ((pct - 80) / 20) * 40);
  if (pct >= 50) return clamp(20 + ((pct - 50) / 30) * 40);
  return clamp((pct / 50) * 20);
}

export function calcHealthScores(records: FinancialRecord[]): HealthScore[] {
  const byUnidade = groupBy(records, 'unidade');
  return Object.entries(byUnidade).map(([unidade, recs]) => {
    const m = calcMetrics(recs);
    const rl = recs.reduce((s, r) => s + r.receitaLiquida, 0);
    const mdo = recs.reduce((s, r) => s + r.maoDeObra, 0);
    const mdoPct = rl > 0 ? (mdo / rl) * 100 : 0;

    const sM = scoreMargem(m.margem, m.meta);
    const sCmv = scoreCmv(m.cmvPercent);
    const sMdo = scoreMaoDeObra(mdoPct);
    const sMeta = scoreMeta(m.margem, m.meta);

    const score = Math.round(sM * 0.35 + sCmv * 0.25 + sMdo * 0.20 + sMeta * 0.20);
    const grade: HealthScore['grade'] = score >= 80 ? 'green' : score >= 50 ? 'yellow' : 'red';

    return {
      unidade,
      regional: recs[0]?.regional ?? '',
      score,
      grade,
      breakdown: { margem: Math.round(sM), cmv: Math.round(sCmv), maoDeObra: Math.round(sMdo), meta: Math.round(sMeta) },
      metrics: { margem: m.margem, cmvPercent: m.cmvPercent, maoDeObraPercent: mdoPct, metaAtingida: m.meta > 0 ? (m.margem / m.meta) * 100 : 0 },
    };
  }).sort((a, b) => b.score - a.score);
}