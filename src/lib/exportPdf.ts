import {
  calcMetrics,
  generateAlerts,
  groupBy,
  formatCurrency,
  formatPercent,
  calcHealthScores,
} from "@/lib/calculations";
import { filterOutAdm } from "@/lib/constants";
import { FinancialRecord, RhRecord } from "@/types/financial";

function getRegionais(records: FinancialRecord[]): string[] {
  return [...new Set(records.map((r) => r.regional))].filter(Boolean).sort();
}

function getLastMonth(records: FinancialRecord[]): string {
  const months = [...new Set(records.map((r) => r.data))].filter(Boolean).sort();
  return months[months.length - 1] ?? "—";
}

function scoreColor(score: number): string {
  if (score >= 80) return "#1D9E75";
  if (score >= 50) return "#EF9F27";
  return "#E24B4A";
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Saudável";
  if (score >= 50) return "Atenção";
  return "Crítico";
}

function kpiCard(label: string, value: string, sub?: string, color = "#111827"): string {
  return `
    <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:20px 24px;flex:1;min-width:160px;text-align:center">
      <div style="font-size:10px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">${label}</div>
      <div style="font-size:22px;font-weight:800;color:${color};font-family:sans-serif">${value}</div>
      ${sub ? `<div style="font-size:10px;color:#9CA3AF;margin-top:6px">${sub}</div>` : ""}
    </div>`;
}

function sectionTitle(title: string): string {
  return `<div style="font-size:13px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.06em;margin:28px 0 14px;padding-bottom:8px;border-bottom:2px solid #E5E7EB">${title}</div>`;
}

function barChart(
  items: { label: string; receita: number; despesa: number; margem: number }[],
  maxVal: number,
): string {
  const bars = items
    .map((item) => {
      const recW = Math.round((item.receita / maxVal) * 100);
      const desW = Math.round((item.despesa / maxVal) * 100);
      const mColor = item.margem < 0 ? "#E24B4A" : item.margem < 5 ? "#EF9F27" : "#1D9E75";
      return `
      <div style="margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-size:12px;font-weight:600;color:#374151">${item.label}</span>
          <span style="font-size:11px;font-weight:700;color:${mColor}">Margem: ${formatPercent(item.margem)}</span>
        </div>
        <div style="margin-bottom:3px">
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:48px;font-size:9px;color:#9CA3AF;text-align:right;flex-shrink:0">Receita</div>
            <div style="flex:1;background:#F3F4F6;border-radius:99px;height:18px;overflow:hidden">
              <div style="width:${recW}%;background:#1D9E75;height:18px;border-radius:99px;display:flex;align-items:center;justify-content:flex-end;padding-right:8px">
                <span style="font-size:9px;font-weight:600;color:#fff">${formatCurrency(item.receita)}</span>
              </div>
            </div>
          </div>
        </div>
        <div>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:48px;font-size:9px;color:#9CA3AF;text-align:right;flex-shrink:0">Despesa</div>
            <div style="flex:1;background:#F3F4F6;border-radius:99px;height:18px;overflow:hidden">
              <div style="width:${desW}%;background:#E24B4A;height:18px;border-radius:99px;display:flex;align-items:center;justify-content:flex-end;padding-right:8px">
                <span style="font-size:9px;font-weight:600;color:#fff">${formatCurrency(item.despesa)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    })
    .join("");
  return `<div style="padding:4px 0">${bars}</div>`;
}

function scoreGauge(label: string, score: number): string {
  const color = scoreColor(score);
  const lbl = scoreLabel(score);
  const pct = score;
  // SVG semicircle gauge
  const r = 36;
  const cx = 50;
  const cy = 50;
  const circ = Math.PI * r;
  const dash = (pct / 100) * circ;
  return `
    <div style="text-align:center;flex:1;min-width:120px">
      <svg viewBox="0 0 100 60" width="120" height="72" xmlns="http://www.w3.org/2000/svg">
        <path d="M 14 50 A 36 36 0 0 1 86 50" fill="none" stroke="#F3F4F6" stroke-width="10" stroke-linecap="round"/>
        <path d="M 14 50 A 36 36 0 0 1 86 50" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round"
          stroke-dasharray="${dash} ${circ}" />
        <text x="50" y="45" text-anchor="middle" font-size="14" font-weight="800" fill="${color}" font-family="sans-serif">${score}</text>
      </svg>
      <div style="font-size:11px;font-weight:600;color:#374151;margin-top:-8px">${label}</div>
      <div style="font-size:9px;font-weight:600;color:${color};margin-top:2px">${lbl}</div>
    </div>`;
}

function alertBadge(type: string, unidade: string, message: string): string {
  const color = type === "danger" ? "#E24B4A" : "#EF9F27";
  const bg = type === "danger" ? "#FCEBEB" : "#FAEEDA";
  const lbl = type === "danger" ? "Crítico" : "Atenção";
  return `
    <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 14px;background:${bg};border-radius:8px;margin-bottom:6px;border-left:3px solid ${color}">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;color:#374151">${unidade}
          <span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:99px;background:${color}20;color:${color};margin-left:6px">${lbl}</span>
        </div>
        <div style="font-size:11px;color:#6B7280;margin-top:2px">${message}</div>
      </div>
    </div>`;
}

function unitScoreBar(pos: number, unidade: string, score: number, margem: number, cmv: number): string {
  const color = scoreColor(score);
  const mColor = margem < 0 ? "#E24B4A" : margem < 5 ? "#EF9F27" : "#1D9E75";
  const cmvColor = cmv > 50 ? "#E24B4A" : cmv > 40 ? "#EF9F27" : "#1D9E75";
  return `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <span style="font-size:11px;font-weight:700;color:#9CA3AF;width:18px;text-align:right">${pos}</span>
      <div style="flex:1;min-width:0">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
          <span style="font-size:11px;font-weight:600;color:#374151">${unidade}</span>
          <div style="display:flex;gap:12px">
            <span style="font-size:10px;color:${mColor}">Margem ${formatPercent(margem)}</span>
            <span style="font-size:10px;color:${cmvColor}">CMV ${formatPercent(cmv)}</span>
            <span style="font-size:12px;font-weight:800;color:${color}">${score}</span>
          </div>
        </div>
        <div style="width:100%;background:#F3F4F6;border-radius:99px;height:6px">
          <div style="width:${score}%;background:${color};height:6px;border-radius:99px"></div>
        </div>
      </div>
    </div>`;
}

function rhSection(rhRecords: RhRecord[], lastMonth: string): string {
  const recs = rhRecords.filter((r) => r.data === lastMonth);
  if (recs.length === 0) return "";

  const totalMdo = recs.reduce((s, r) => s + r.maoDeObra, 0);
  const totalHe = recs.reduce((s, r) => s + r.horaExtra, 0);
  const totalFunc = recs.reduce((s, r) => s + r.numFuncionarios, 0);
  const avgPct = recs.length > 0 ? recs.reduce((s, r) => s + r.percentualMdo, 0) / recs.length : 0;
  const avgMeta = recs.filter((r) => r.metaPercentual > 0);
  const metaAvg = avgMeta.length > 0 ? avgMeta.reduce((s, r) => s + r.metaPercentual, 0) / avgMeta.length : 0;
  const acimaMeta = recs.filter((r) => r.metaPercentual > 0 && r.percentualMdo > r.metaPercentual).length;
  const topHe = [...recs]
    .sort((a, b) => b.horaExtra - a.horaExtra)
    .slice(0, 5)
    .filter((r) => r.horaExtra > 0);
  const topMdo = [...recs].sort((a, b) => b.percentualMdo - a.percentualMdo).slice(0, 5);

  const pctColor = metaAvg > 0 && avgPct > metaAvg ? "#E24B4A" : "#1D9E75";

  return `
    <div style="page-break-before:always;padding-top:8px">
      <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:12px;padding:20px 28px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:10px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">Dashboard de Pessoas</div>
          <div style="font-size:22px;font-weight:800;color:#FFFFFF">Mão de Obra & Headcount</div>
          <div style="font-size:12px;color:#9CA3AF">Referência: ${lastMonth}</div>
        </div>
        ${
          acimaMeta > 0
            ? `<div style="background:#FCEBEB;border-radius:8px;padding:8px 16px;text-align:center">
          <div style="font-size:18px;font-weight:800;color:#A32D2D">${acimaMeta}</div>
          <div style="font-size:9px;color:#A32D2D;text-transform:uppercase;font-weight:600">Acima da Meta</div>
        </div>`
            : `<div style="background:#EAF3DE;border-radius:8px;padding:8px 16px;text-align:center">
          <div style="font-size:18px;font-weight:800;color:#27500A">✓</div>
          <div style="font-size:9px;color:#27500A;text-transform:uppercase;font-weight:600">Dentro da Meta</div>
        </div>`
        }
      </div>
 
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px">
        ${kpiCard("Custo Total MdO", formatCurrency(totalMdo))}
        ${kpiCard("% MdO Médio", formatPercent(avgPct), metaAvg > 0 ? `Meta: ${formatPercent(metaAvg)}` : "Sem meta", pctColor)}
        ${kpiCard("Funcionários", totalFunc > 0 ? totalFunc.toFixed(0) : "—")}
        ${kpiCard("Custo Hora Extra", totalHe > 0 ? formatCurrency(totalHe) : "—", undefined, totalHe > 0 ? "#EF9F27" : "#111827")}
      </div>
 
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div>
          ${sectionTitle("% MdO por Unidade — Top 5")}
          ${topMdo
            .map((u, i) => {
              const color =
                u.metaPercentual > 0 && u.percentualMdo > u.metaPercentual
                  ? "#E24B4A"
                  : u.percentualMdo > 30
                    ? "#EF9F27"
                    : "#1D9E75";
              return `<div style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
                <span style="font-size:11px;font-weight:600;color:#374151">${i + 1}. ${u.unidade}</span>
                <span style="font-size:12px;font-weight:800;color:${color}">${formatPercent(u.percentualMdo)}</span>
              </div>
              <div style="width:100%;background:#F3F4F6;border-radius:99px;height:5px">
                <div style="width:${Math.min(100, u.percentualMdo)}%;background:${color};height:5px;border-radius:99px"></div>
              </div>
              ${u.metaPercentual > 0 ? `<div style="font-size:9px;color:#9CA3AF;margin-top:2px">Meta: ${formatPercent(u.metaPercentual)}</div>` : ""}
            </div>`;
            })
            .join("")}
        </div>
        ${
          topHe.length > 0
            ? `<div>
          ${sectionTitle("Hora Extra — Top 5")}
          ${topHe
            .map(
              (u, i) => `
            <div style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
                <span style="font-size:11px;font-weight:600;color:#374151">${i + 1}. ${u.unidade}</span>
                <span style="font-size:12px;font-weight:700;color:#EF9F27">${formatCurrency(u.horaExtra)}</span>
              </div>
              <div style="width:100%;background:#F3F4F6;border-radius:99px;height:5px">
                <div style="width:${Math.min(100, (u.horaExtra / topHe[0].horaExtra) * 100)}%;background:#EF9F27;height:5px;border-radius:99px"></div>
              </div>
            </div>`,
            )
            .join("")}
        </div>`
            : ""
        }
      </div>
    </div>`;
}

function regionalSection(regional: string, records: FinancialRecord[], lastMonth: string): string {
  const recs = records.filter((r) => r.regional === regional && r.data === lastMonth);
  if (recs.length === 0) return "";
  const m = calcMetrics(recs);
  const alerts = generateAlerts(recs)
    .filter((a) => a.type === "danger" || a.type === "warning")
    .slice(0, 6);
  const scores = calcHealthScores(recs);
  const top3 = scores.slice(0, 3);
  const bottom3 = scores.slice(-3).reverse();

  const mColor = m.margem < 0 ? "#E24B4A" : m.margem < 5 ? "#EF9F27" : "#1D9E75";
  const cmvColor = m.cmvPercent > 50 ? "#E24B4A" : m.cmvPercent > 40 ? "#EF9F27" : "#111827";

  return `
    <div style="page-break-before:always;padding-top:8px">
      <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:12px;padding:20px 28px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:10px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">Regional</div>
          <div style="font-size:24px;font-weight:800;color:#FFFFFF">${regional}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:10px;color:#9CA3AF;margin-bottom:4px">Score médio</div>
          <div style="font-size:28px;font-weight:800;color:${scoreColor(Math.round(scores.reduce((s, u) => s + u.score, 0) / Math.max(1, scores.length)))}">
            ${Math.round(scores.reduce((s, u) => s + u.score, 0) / Math.max(1, scores.length))}
          </div>
        </div>
      </div>
 
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px">
        ${kpiCard("Receita", formatCurrency(m.receitaBruta))}
        ${kpiCard("Margem", formatPercent(m.margem), `Meta: ${formatPercent(m.meta)}`, mColor)}
        ${kpiCard("CMV", formatPercent(m.cmvPercent), "Ideal ≤ 40%", cmvColor)}
        ${kpiCard("Despesa", formatCurrency(m.despesaTotal))}
      </div>
 
      ${
        alerts.length > 0
          ? `
        ${sectionTitle(`Alertas (${alerts.length})`)}
        <div style="margin-bottom:20px">
          ${alerts.map((a) => alertBadge(a.type, a.unidade, a.message)).join("")}
        </div>`
          : `
        <div style="background:#EAF3DE;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:12px;color:#27500A;border-left:3px solid #1D9E75">
          ✅ Nenhum alerta crítico nesta regional.
        </div>`
      }
 
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div>
          ${sectionTitle("🏆 Top 3 — Melhor Score")}
          ${top3.map((u, i) => unitScoreBar(i + 1, u.unidade, u.score, u.metrics.margem, u.metrics.cmvPercent)).join("")}
        </div>
        <div>
          ${sectionTitle("⚠️ Bottom 3 — Pior Score")}
          ${bottom3.map((u, i) => unitScoreBar(i + 1, u.unidade, u.score, u.metrics.margem, u.metrics.cmvPercent)).join("")}
        </div>
      </div>
    </div>`;
}

export function exportPdf(allData: FinancialRecord[], rhRecords: RhRecord[] = []) {
  const records = filterOutAdm(allData);
  const lastMonth = getLastMonth(records);
  const lastMonthRecords = records.filter((r) => r.data === lastMonth);
  const regionais = getRegionais(lastMonthRecords);
  const m = calcMetrics(lastMonthRecords);
  const alerts = generateAlerts(lastMonthRecords);
  const dangerAlerts = alerts.filter((a) => a.type === "danger");
  const warningAlerts = alerts.filter((a) => a.type === "warning");
  const scores = calcHealthScores(lastMonthRecords);
  const top5 = scores.slice(0, 5);
  const bottom5 = scores.slice(-5).reverse();
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Dados por regional para gráfico de barras
  const byRegional = groupBy(lastMonthRecords, "regional");
  const regionalData = regionais.map((reg) => {
    const recs = byRegional[reg] || [];
    const rm = calcMetrics(recs);
    return { label: reg, receita: rm.receitaBruta, despesa: rm.despesaTotal, margem: rm.margem };
  });
  const maxVal = Math.max(...regionalData.map((r) => Math.max(r.receita, r.despesa))) * 1.05;

  // Score médio por regional para gauges
  const regionalScores = regionais.map((reg) => {
    const regScores = scores.filter((u) => u.regional === reg);
    const avg = regScores.length > 0 ? Math.round(regScores.reduce((s, u) => s + u.score, 0) / regScores.length) : 0;
    return { regional: reg, score: avg };
  });

  const mColor = m.margem < 0 ? "#E24B4A" : m.margem < 5 ? "#EF9F27" : "#1D9E75";
  const cmvColor = m.cmvPercent > 50 ? "#E24B4A" : m.cmvPercent > 40 ? "#EF9F27" : "#111827";

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório Mais Sabor — ${lastMonth}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; background: #fff; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
    @page { margin: 16mm 14mm; }
  }
  .container { max-width: 860px; margin: 0 auto; padding: 32px 24px; }
</style>
</head>
<body>
<div class="container">
 
  <div class="no-print" style="text-align:right;margin-bottom:20px">
    <button onclick="window.print()" style="background:#1D9E75;color:#fff;border:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(29,158,117,0.3)">
      📄 Salvar como PDF
    </button>
  </div>
 
  <!-- Capa -->
  <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);border-radius:16px;padding:48px 40px;margin-bottom:36px;text-align:center">
    <div style="font-size:32px;font-weight:800;color:#FFFFFF;margin-bottom:6px;letter-spacing:-0.5px">Mais Sabor</div>
    <div style="font-size:13px;color:#9CA3AF;margin-bottom:24px;letter-spacing:0.04em;text-transform:uppercase">Relatório de Gestão Financeira</div>
    <div style="display:inline-block;background:rgba(255,255,255,0.12);border-radius:10px;padding:10px 32px;margin-bottom:20px">
      <div style="font-size:26px;font-weight:800;color:#FFFFFF">${lastMonth}</div>
    </div>
    <div style="font-size:11px;color:#6B7280;margin-top:8px">${today}</div>
    <div style="font-size:11px;color:#6B7280;margin-top:3px">Desenvolvido pelo Superintendente Sandro Rodigheiro</div>
  </div>
 
  <!-- KPIs Consolidados -->
  ${sectionTitle("Visão Consolidada da Rede")}
  <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px">
    ${kpiCard("Receita Total", formatCurrency(m.receitaBruta))}
    ${kpiCard("Despesa Total", formatCurrency(m.despesaTotal))}
    ${kpiCard("Margem Geral", formatPercent(m.margem), `Meta: ${formatPercent(m.meta)}`, mColor)}
    ${kpiCard("CMV Médio", formatPercent(m.cmvPercent), "Ideal ≤ 40%", cmvColor)}
  </div>
 
  <!-- Resumo alertas -->
  <div style="display:flex;gap:12px;margin-bottom:28px">
    <div style="background:#FCEBEB;border:1px solid #F09595;border-radius:10px;padding:18px;flex:1;text-align:center">
      <div style="font-size:36px;font-weight:800;color:#A32D2D;font-family:sans-serif">${dangerAlerts.length}</div>
      <div style="font-size:10px;font-weight:700;color:#A32D2D;text-transform:uppercase;margin-top:4px;letter-spacing:0.06em">Alertas Críticos</div>
    </div>
    <div style="background:#FAEEDA;border:1px solid #FAC775;border-radius:10px;padding:18px;flex:1;text-align:center">
      <div style="font-size:36px;font-weight:800;color:#633806;font-family:sans-serif">${warningAlerts.length}</div>
      <div style="font-size:10px;font-weight:700;color:#633806;text-transform:uppercase;margin-top:4px;letter-spacing:0.06em">Alertas de Atenção</div>
    </div>
    <div style="background:#EAF3DE;border:1px solid #C0DD97;border-radius:10px;padding:18px;flex:1;text-align:center">
      <div style="font-size:36px;font-weight:800;color:#27500A;font-family:sans-serif">${scores.filter((s) => s.grade === "green").length}</div>
      <div style="font-size:10px;font-weight:700;color:#27500A;text-transform:uppercase;margin-top:4px;letter-spacing:0.06em">Unidades Saudáveis</div>
    </div>
    <div style="background:#F0F9FF;border:1px solid #BAE6FD;border-radius:10px;padding:18px;flex:1;text-align:center">
      <div style="font-size:36px;font-weight:800;color:#0C447C;font-family:sans-serif">${scores.length}</div>
      <div style="font-size:10px;font-weight:700;color:#0C447C;text-transform:uppercase;margin-top:4px;letter-spacing:0.06em">Total de Unidades</div>
    </div>
  </div>
 
  <!-- Receita vs Despesa por Regional -->
  ${sectionTitle("Receita vs Despesa por Regional")}
  ${barChart(regionalData, maxVal)}
 
  <!-- Score de saúde por regional -->
  ${sectionTitle("Score de Saúde por Regional")}
  <div style="display:flex;gap:16px;flex-wrap:wrap;justify-content:center;margin-bottom:24px;padding:16px;background:#F9FAFB;border-radius:12px">
    ${regionalScores.map((r) => scoreGauge(r.regional, r.score)).join("")}
  </div>
 
  <!-- Top 5 e Bottom 5 -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px">
    <div>
      ${sectionTitle("🏆 Top 5 — Melhor Score")}
      ${top5.map((u, i) => unitScoreBar(i + 1, u.unidade, u.score, u.metrics.margem, u.metrics.cmvPercent)).join("")}
    </div>
    <div>
      ${sectionTitle("⚠️ Bottom 5 — Pior Score")}
      ${bottom5.map((u, i) => unitScoreBar(i + 1, u.unidade, u.score, u.metrics.margem, u.metrics.cmvPercent)).join("")}
    </div>
  </div>
 
  <!-- Top alertas críticos -->
  ${
    dangerAlerts.length > 0
      ? `
    ${sectionTitle(`Alertas Críticos (${dangerAlerts.length})`)}
    <div style="margin-bottom:24px">
      ${dangerAlerts
        .slice(0, 10)
        .map((a) => alertBadge(a.type, a.unidade, a.message))
        .join("")}
      ${dangerAlerts.length > 10 ? `<div style="font-size:11px;color:#9CA3AF;text-align:center;margin-top:8px">+ ${dangerAlerts.length - 10} outros alertas críticos</div>` : ""}
    </div>`
      : ""
  }
 
  <!-- Seção de Pessoas -->
  ${rhSection(rhRecords, lastMonth)}
 
  <!-- Seções por regional -->
  ${regionais.map((reg) => regionalSection(reg, records, lastMonth)).join("")}
 
  <!-- Rodapé -->
  <div style="margin-top:48px;padding-top:16px;border-top:1px solid #E5E7EB;text-align:center">
    <div style="font-size:11px;color:#9CA3AF">Mais Sabor · Desenvolvido pelo Superintendente Sandro Rodigheiro</div>
    <div style="font-size:10px;color:#D1D5DB;margin-top:4px">Gerado em ${today}</div>
  </div>
 
</div>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) {
    alert("Permita pop-ups para exportar o PDF.");
    return;
  }
  win.document.write(html);
  win.document.close();
}
