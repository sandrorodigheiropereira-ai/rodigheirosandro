import { FinancialRecord, CalculatedMetrics, Alert } from '@/types/financial';

export function calcMetrics(records: FinancialRecord[], prevRecords?: FinancialRecord[]): CalculatedMetrics {
  const receitaBruta = records.reduce((s, r) => s + r.receitaBruta, 0);
  const receitaLiquida = records.reduce((s, r) => s + r.receitaLiquida, 0);
  const cmvTotal = records.reduce((s, r) => s + r.cmv, 0);
  const maoDeObraTotal = records.reduce((s, r) => s + r.maoDeObra, 0);
  const despesaTotal = records.reduce((s, r) => s + r.despesaTotal, 0);
  const margem = receitaLiquida > 0 ? ((receitaLiquida - despesaTotal) / receitaLiquida) * 100 : 0;
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

  for (const [unidade, recs] of Object.entries(byUnidade)) {
    const metrics = calcMetrics(recs);
    const regional = recs[0].regional;

    if (metrics.cmvPercent > 40) {
      alerts.push({ type: 'danger', message: `CMV acima de 40%: ${metrics.cmvPercent.toFixed(1)}%`, unidade, regional, value: metrics.cmvPercent });
    }
    if (metrics.maoDeObraPercent > 30) {
      alerts.push({ type: 'warning', message: `Mão de Obra acima de 30%: ${metrics.maoDeObraPercent.toFixed(1)}%`, unidade, regional, value: metrics.maoDeObraPercent });
    }
  }

  // Check revenue drop between last 2 months
  const months = [...new Set(records.map(r => r.data))].sort();
  if (months.length >= 2) {
    const last = months[months.length - 1];
    const prev = months[months.length - 2];
    for (const [unidade, recs] of Object.entries(byUnidade)) {
      const lastRecs = recs.filter(r => r.data === last);
      const prevRecs = recs.filter(r => r.data === prev);
      const lastRev = lastRecs.reduce((s, r) => s + r.receitaBruta, 0);
      const prevRev = prevRecs.reduce((s, r) => s + r.receitaBruta, 0);
      if (prevRev > 0) {
        const drop = ((prevRev - lastRev) / prevRev) * 100;
        if (drop > 10) {
          alerts.push({ type: 'danger', message: `Queda de receita: ${drop.toFixed(1)}%`, unidade, regional: recs[0].regional, value: drop });
        }
      }
    }
  }

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

export function rankUnidades(records: FinancialRecord[], metric: 'receitaBruta' | 'margem' = 'receitaBruta') {
  const byUnidade = groupBy(records, 'unidade');
  const ranked = Object.entries(byUnidade).map(([unidade, recs]) => ({
    unidade,
    regional: recs[0].regional,
    value: metric === 'receitaBruta'
      ? recs.reduce((s, r) => s + r.receitaBruta, 0)
      : recs.reduce((s, r) => s + r.margem, 0) / recs.length,
  }));
  ranked.sort((a, b) => b.value - a.value);
  return ranked;
}
