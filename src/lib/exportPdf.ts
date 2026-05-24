import { calcMetrics, generateAlerts, groupBy, formatCurrency, formatPercent, calcHealthScores } from '@/lib/calculations';
import { filterOutAdm } from '@/lib/constants';
import { FinancialRecord } from '@/types/financial';

function getRegionais(records: FinancialRecord[]): string[] {
  return [...new Set(records.map(r => r.regional))].filter(Boolean).sort();
}

function getLastMonth(records: FinancialRecord[]): string {
  const months = [...new Set(records.map(r => r.data))].filter(Boolean).sort();
  return months[months.length - 1] ?? '—';
}

function scoreColor(score: number): string {
  if (score >= 80) return '#1D9E75';
  if (score >= 50) return '#EF9F27';
  return '#E24B4A';
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Saudável';
  if (score >= 50) return 'Atenção';
  return 'Crítico';
}

function kpiCard(label: string, value: string, sub?: string, color = '#111827'): string {
  return `
    <div style="background:#fff;border:1px solid #E5E7EB;border-radius:10px;padding:14px 16px;">
      <div style="font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:.04em;">${label}</div>
      <div style="font-size:20px;font-weight:700;color:${color};margin-top:6px;">${value}</div>
      ${sub ? `<div style="font-size:11px;color:#6B7280;margin-top:4px;">${sub}</div>` : ''}
    </div>`;
}

function sectionTitle(title: string): string {
  return `<h2 style="font-size:16px;font-weight:700;color:#111827;margin:28px 0 12px;border-bottom:2px solid #1D9E75;padding-bottom:6px;">${title}</h2>`;
}

function barChart(items: { label: string; receita: number; despesa: number; margem: number }[], maxVal: number): string {
  const bars = items.map(item => {
    const recW = Math.round((item.receita / maxVal) * 100);
    const desW = Math.round((item.despesa / maxVal) * 100);
    const mColor = item.margem < 0 ? '#E24B4A' : item.margem < 5 ? '#EF9F27' : '#1D9E75';
    return `
      <div style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
          <span style="font-weight:600;color:#111827;">${item.label}</span>
          <span style="color:${mColor};font-weight:600;">Margem: ${formatPercent(item.margem)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">
          <span style="width:60px;font-size:10px;color:#6B7280;">Receita</span>
          <div style="flex:1;background:#F3F4F6;height:14px;border-radius:3px;overflow:hidden;">
            <div style="width:${recW}%;background:#1D9E75;height:100%;display:flex;align-items:center;justify-content:flex-end;padding-right:4px;color:#fff;font-size:10px;">${formatCurrency(item.receita)}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="width:60px;font-size:10px;color:#6B7280;">Despesa</span>
          <div style="flex:1;background:#F3F4F6;height:14px;border-radius:3px;overflow:hidden;">
            <div style="width:${desW}%;background:#E24B4A;height:100%;display:flex;align-items:center;justify-content:flex-end;padding-right:4px;color:#fff;font-size:10px;">${formatCurrency(item.despesa)}</div>
          </div>
        </div>
      </div>`;
  }).join('');
  return `<div>${bars}</div>`;
}

function scoreGauge(label: string, score: number): string {
  const color = scoreColor(score);
  const lbl = scoreLabel(score);
  const pct = score;
  const r = 36;
  const cx = 50;
  const cy = 50;
  const circ = Math.PI * r;
  const dash = (pct / 100) * circ;
  return `
    <div style="text-align:center;padding:8px;">
      <svg width="100" height="60" viewBox="0 0 100 60">
        <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="#E5E7EB" stroke-width="8" />
        <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="${color}" stroke-width="8" stroke-dasharray="${dash} ${circ}" />
        <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="16" font-weight="700" fill="#111827">${score}</text>
      </svg>
      <div style="font-size:12px;font-weight:600;color:#111827;margin-top:2px;">${label}</div>
      <div style="font-size:10px;color:${color};">${lbl}</div>
    </div>`;
}

function alertBadge(type: string, unidade: string, message: string): string {
  const color = type === 'danger' ? '#E24B4A' : '#EF9F27';
  const bg = type === 'danger' ? '#FCEBEB' : '#FAEEDA';
  const lbl = type === 'danger' ? 'Crítico' : 'Atenção';
  return `
    <div style="background:${bg};border-left:4px solid ${color};padding:8px 12px;margin-bottom:6px;border-radius:4px;">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:8px;">
        <div style="flex:1;">
          <span style="font-weight:700;color:#111827;font-size:12px;">${unidade}</span>
          <span style="background:${color};color:#fff;font-size:9px;padding:1px 6px;border-radius:8px;margin-left:6px;">${lbl}</span>
          <div style="font-size:11px;color:#374151;margin-top:2px;">${message}</div>
        </div>
      </div>
    </div>`;
}

function unitScoreBar(pos: number, unidade: string, score: number, margem: number, cmv: number): string {
  const color = scoreColor(score);
  return `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #F3F4F6;">
      <span style="font-weight:700;color:#6B7280;width:20px;font-size:12px;">${pos}</span>
      <div style="flex:1;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:600;color:#111827;font-size:12px;">${unidade}</span>
          <div style="display:flex;gap:8px;font-size:10px;color:#6B7280;">
            <span>Margem ${formatPercent(margem)}</span>
            <span>CMV ${formatPercent(cmv)}</span>
            <span style="background:${color};color:#fff;padding:1px 8px;border-radius:8px;font-weight:700;">${score}</span>
          </div>
        </div>
        <div style="background:#F3F4F6;height:6px;border-radius:3px;margin-top:4px;overflow:hidden;">
          <div style="width:${score}%;background:${color};height:100%;"></div>
        </div>
      </div>
    </div>`;
}

function regionalSection(regional: string, records: FinancialRecord[], lastMonth: string): string {
  const recs = records.filter(r => r.regional === regional && r.data === lastMonth);
  if (recs.length === 0) return '';
  const m = calcMetrics(recs);
  const alerts = generateAlerts(recs).filter(a => a.type === 'danger' || a.type === 'warning').slice(0, 6);
  const scores = calcHealthScores(recs);
  const top3 = scores.slice(0, 3);
  const bottom3 = scores.slice(-3).reverse();

  const mColor = m.margem < 0 ? '#E24B4A' : m.margem < 5 ? '#EF9F27' : '#1D9E75';
  const cmvColor = m.cmvPercent > 50 ? '#E24B4A' : m.cmvPercent > 40 ? '#EF9F27' : '#111827';
  const avgScore = Math.round(scores.reduce((s,u)=>s+u.score,0)/Math.max(1,scores.length));

  return `
    <div style="margin-top:32px;padding-top:20px;border-top:3px solid #1D9E75;page-break-before:always;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <div>
          <div style="font-size:11px;color:#6B7280;text-transform:uppercase;">Regional</div>
          <div style="font-size:22px;font-weight:700;color:#111827;">${regional}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;color:#6B7280;text-transform:uppercase;">Score médio</div>
          <div style="font-size:22px;font-weight:700;color:${scoreColor(avgScore)};">${avgScore}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px;">
        ${kpiCard('Receita', formatCurrency(m.receitaBruta))}
        ${kpiCard('Margem', formatPercent(m.margem), `Meta: ${formatPercent(m.meta)}`, mColor)}
        ${kpiCard('CMV', formatPercent(m.cmvPercent), 'Ideal ≤ 40%', cmvColor)}
        ${kpiCard('Despesa', formatCurrency(m.despesaTotal))}
      </div>

      ${alerts.length > 0 ? `
        ${sectionTitle(`Alertas (${alerts.length})`)}
        <div>${alerts.map(a => alertBadge(a.type, a.unidade, a.message)).join('')}</div>
      ` : `<div style="background:#E8F7F0;color:#1D9E75;padding:10px;border-radius:6px;font-size:12px;margin-top:10px;">✅ Nenhum alerta crítico nesta regional.</div>`}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:14px;">
        <div>
          ${sectionTitle('🏆 Top 3 — Melhor Score')}
          ${top3.map((u,i) => unitScoreBar(i+1, u.unidade, u.score, u.metrics.margem, u.metrics.cmvPercent)).join('')}
        </div>
        <div>
          ${sectionTitle('⚠️ Bottom 3 — Pior Score')}
          ${bottom3.map((u,i) => unitScoreBar(i+1, u.unidade, u.score, u.metrics.margem, u.metrics.cmvPercent)).join('')}
        </div>
      </div>
    </div>`;
}

export function exportPdf(allData: FinancialRecord[]) {
  const records = filterOutAdm(allData);
  const lastMonth = getLastMonth(records);
  const lastMonthRecords = records.filter(r => r.data === lastMonth);
  const regionais = getRegionais(lastMonthRecords);
  const m = calcMetrics(lastMonthRecords);
  const alerts = generateAlerts(lastMonthRecords);
  const dangerAlerts = alerts.filter(a => a.type === 'danger');
  const warningAlerts = alerts.filter(a => a.type === 'warning');
  const scores = calcHealthScores(lastMonthRecords);
  const top5 = scores.slice(0, 5);
  const bottom5 = scores.slice(-5).reverse();
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const byRegional = groupBy(lastMonthRecords, 'regional');
  const regionalData = regionais.map(reg => {
    const recs = byRegional[reg] || [];
    const rm = calcMetrics(recs);
    return { label: reg, receita: rm.receitaBruta, despesa: rm.despesaTotal, margem: rm.margem };
  });
  const maxVal = Math.max(...regionalData.map(r => Math.max(r.receita, r.despesa)), 1) * 1.05;

  const regionalScores = regionais.map(reg => {
    const regScores = scores.filter(u => u.regional === reg);
    const avg = regScores.length > 0 ? Math.round(regScores.reduce((s, u) => s + u.score, 0) / regScores.length) : 0;
    return { regional: reg, score: avg };
  });

  const mColor = m.margem < 0 ? '#E24B4A' : m.margem < 5 ? '#EF9F27' : '#1D9E75';
  const cmvColor = m.cmvPercent > 50 ? '#E24B4A' : m.cmvPercent > 40 ? '#EF9F27' : '#111827';

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>Relatório de Gestão Financeira — ${lastMonth}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; background: #F9FAFB; color: #111827; }
  .container { max-width: 860px; margin: 0 auto; padding: 32px 24px; background: #fff; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff; }
    .no-print { display: none !important; }
    @page { margin: 16mm 14mm; }
  }
  .print-btn { position: fixed; top: 16px; right: 16px; background: #1D9E75; color: #fff; border: none; padding: 10px 16px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
  .print-btn:hover { background: #168760; }
</style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">📄 Salvar como PDF</button>
  <div class="container">
    <div style="text-align:center;padding:20px 0 24px;border-bottom:3px solid #1D9E75;">
      <div style="font-size:13px;color:#6B7280;text-transform:uppercase;letter-spacing:.1em;">Mais Sabor</div>
      <h1 style="font-size:26px;font-weight:800;color:#111827;margin:6px 0;">Relatório de Gestão Financeira</h1>
      <div style="display:inline-block;background:#1D9E75;color:#fff;padding:4px 14px;border-radius:14px;font-size:13px;font-weight:600;margin-top:6px;">${lastMonth}</div>
      <div style="font-size:12px;color:#6B7280;margin-top:8px;">${today}</div>
      <div style="font-size:11px;color:#9CA3AF;margin-top:4px;">Desenvolvido pelo Superintendente Sandro Rodigheiro</div>
    </div>

    ${sectionTitle('Visão Consolidada da Rede')}
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
      ${kpiCard('Receita Total', formatCurrency(m.receitaBruta))}
      ${kpiCard('Despesa Total', formatCurrency(m.despesaTotal))}
      ${kpiCard('Margem Geral', formatPercent(m.margem), `Meta: ${formatPercent(m.meta)}`, mColor)}
      ${kpiCard('CMV Médio', formatPercent(m.cmvPercent), 'Ideal ≤ 40%', cmvColor)}
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:10px;">
      <div style="background:#FCEBEB;border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:22px;font-weight:800;color:#E24B4A;">${dangerAlerts.length}</div>
        <div style="font-size:11px;color:#6B7280;text-transform:uppercase;">Alertas Críticos</div>
      </div>
      <div style="background:#FAEEDA;border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:22px;font-weight:800;color:#EF9F27;">${warningAlerts.length}</div>
        <div style="font-size:11px;color:#6B7280;text-transform:uppercase;">Alertas de Atenção</div>
      </div>
      <div style="background:#E8F7F0;border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:22px;font-weight:800;color:#1D9E75;">${scores.filter(s => s.grade === 'green').length}</div>
        <div style="font-size:11px;color:#6B7280;text-transform:uppercase;">Unidades Saudáveis</div>
      </div>
      <div style="background:#F3F4F6;border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:22px;font-weight:800;color:#111827;">${scores.length}</div>
        <div style="font-size:11px;color:#6B7280;text-transform:uppercase;">Total de Unidades</div>
      </div>
    </div>

    ${sectionTitle('Receita vs Despesa por Regional')}
    ${barChart(regionalData, maxVal)}

    ${sectionTitle('Score de Saúde por Regional')}
    <div style="display:flex;flex-wrap:wrap;justify-content:space-around;gap:8px;">
      ${regionalScores.map(r => scoreGauge(r.regional, r.score)).join('')}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:14px;">
      <div>
        ${sectionTitle('🏆 Top 5 — Melhor Score')}
        ${top5.map((u,i) => unitScoreBar(i+1, u.unidade, u.score, u.metrics.margem, u.metrics.cmvPercent)).join('')}
      </div>
      <div>
        ${sectionTitle('⚠️ Top 5 — Pior Score')}
        ${bottom5.map((u,i) => unitScoreBar(i+1, u.unidade, u.score, u.metrics.margem, u.metrics.cmvPercent)).join('')}
      </div>
    </div>

    ${dangerAlerts.length > 0 ? `
      ${sectionTitle(`Alertas Críticos (${dangerAlerts.length})`)}
      <div>
        ${dangerAlerts.slice(0, 10).map(a => alertBadge(a.type, a.unidade, a.message)).join('')}
        ${dangerAlerts.length > 10 ? `<div style="text-align:center;font-size:11px;color:#6B7280;margin-top:6px;">+ ${dangerAlerts.length - 10} outros alertas críticos</div>` : ''}
      </div>
    ` : ''}

    ${regionais.map(reg => regionalSection(reg, records, lastMonth)).join('')}

    <div style="margin-top:40px;padding-top:16px;border-top:1px solid #E5E7EB;text-align:center;">
      <div style="font-size:11px;color:#6B7280;">Mais Sabor · Desenvolvido pelo Superintendente Sandro Rodigheiro</div>
      <div style="font-size:10px;color:#9CA3AF;margin-top:2px;">Gerado em ${today}</div>
    </div>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) { alert('Permita pop-ups para exportar o PDF.'); return; }
  win.document.write(html);
  win.document.close();
}
