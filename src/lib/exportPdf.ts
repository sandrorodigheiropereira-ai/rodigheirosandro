import {
  calcMetrics,
  generateAlerts,
  groupBy,
  formatCurrency,
  formatPercent,
  calcHealthScores,
} from "@/lib/calculations";
import { filterOutAdm, filterOnlyAdm } from "@/lib/constants";
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
    <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:16px 12px;flex:1;min-width:130px;max-width:200px;text-align:center;overflow:hidden">
      <div style="font-size:9px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${label}</div>
      <div style="font-size:16px;font-weight:800;color:${color};font-family:sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${value}</div>
      ${sub ? `<div style="font-size:9px;color:#9CA3AF;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${sub}</div>` : ""}
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
  const r = 36;
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

function admSection(allData: FinancialRecord[], lastMonth: string): string {
  const admRecs = filterOnlyAdm(allData).filter((r) => r.data === lastMonth);
  const opRecs = filterOutAdm(allData).filter((r) => r.data === lastMonth);
  if (admRecs.length === 0) return "";

  const ADM_TO_REGIONAL: Record<string, string> = {
    "ADM/ES": "ESPIRITO SANTO",
    "ADM/TO": "TOCANTINS",
    "ADM/GO": "GOIAS",
    "ADM/PR": "PARANA",
  };
  const THRESHOLD = 4;

  const totalDespAdm = admRecs.reduce((s, r) => s + r.despesaTotal, 0);
  const totalRecOp = opRecs.reduce((s, r) => s + r.receitaBruta, 0);
  const pctGlobal = totalRecOp > 0 ? (totalDespAdm / totalRecOp) * 100 : 0;
  const pctColor = pctGlobal > THRESHOLD ? "#E24B4A" : pctGlobal > THRESHOLD * 0.8 ? "#EF9F27" : "#1D9E75";

  const byUnit: Record<string, FinancialRecord[]> = {};
  for (const r of admRecs) {
    if (!byUnit[r.unidade]) byUnit[r.unidade] = [];
    byUnit[r.unidade].push(r);
  }

  const units = Object.entries(byUnit)
    .map(([unidade, recs]) => {
      const regional = ADM_TO_REGIONAL[unidade] || unidade;
      const despesa = recs.reduce((s, r) => s + r.despesaTotal, 0);
      const opRecsReg = opRecs.filter((r) => r.regional === regional);
      const receita = opRecsReg.reduce((s, r) => s + r.receitaBruta, 0);
      const pct = receita > 0 ? (despesa / receita) * 100 : 0;
      const grade = pct > THRESHOLD ? "danger" : pct > THRESHOLD * 0.8 ? "warning" : "ok";
      const color = grade === "danger" ? "#E24B4A" : grade === "warning" ? "#EF9F27" : "#1D9E75";
      return { unidade, regional, despesa, receita, pct, color, grade };
    })
    .sort((a, b) => b.pct - a.pct);

  const maxPct = Math.max(...units.map((u) => u.pct), THRESHOLD * 1.5);

  const unitRows = units
    .map(
      (u) => `
    <div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
        <div>
          <span style="font-size:12px;font-weight:700;color:#374151">${u.unidade}</span>
          <span style="font-size:10px;color:#9CA3AF;margin-left:8px">${u.regional}</span>
        </div>
        <div style="text-align:right">
          <span style="font-size:14px;font-weight:800;color:${u.color}">${formatPercent(u.pct)}</span>
          <span style="font-size:10px;color:#9CA3AF;margin-left:8px">${formatCurrency(u.despesa)}</span>
        </div>
      </div>
      <div style="position:relative;width:100%;background:#F3F4F6;border-radius:99px;height:10px">
        <div style="width:${Math.min(100, (u.pct / maxPct) * 100)}%;background:${u.color};height:10px;border-radius:99px"></div>
        <div style="position:absolute;top:-1px;left:${Math.min(98, (THRESHOLD / maxPct) * 100)}%;width:2px;height:12px;background:#E24B4A;border-radius:1px"></div>
      </div>
      <div style="font-size:9px;color:#9CA3AF;margin-top:3px">Receita regional: ${formatCurrency(u.receita)}</div>
    </div>`,
    )
    .join("");

  return `
    <div style="page-break-before:always;padding-top:8px">
      <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:12px;padding:20px 28px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:10px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">Custo Administrativo</div>
          <div style="font-size:22px;font-weight:800;color:#FFFFFF">Despesa ADM vs Receita Regional</div>
          <div style="font-size:12px;color:#9CA3AF">Referência: ${lastMonth} · Limite: ${THRESHOLD}%</div>
        </div>
        <div style="text-align:center;background:${pctColor}22;border-radius:12px;padding:12px 24px;border:2px solid ${pctColor}">
          <div style="font-size:28px;font-weight:800;color:${pctColor}">${formatPercent(pctGlobal)}</div>
          <div style="font-size:9px;font-weight:700;color:${pctColor};text-transform:uppercase;margin-top:2px">% ADM / Receita</div>
        </div>
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px">
        ${kpiCard("Despesa ADM Total", formatCurrency(totalDespAdm), undefined, "#E24B4A")}
        ${kpiCard("Receita das Regionais", formatCurrency(totalRecOp))}
        ${kpiCard("% ADM / Receita", formatPercent(pctGlobal), "Limite: " + THRESHOLD + "%", pctColor)}
        ${kpiCard("Unidades ADM", String(units.length))}
      </div>
      ${sectionTitle("% ADM / Receita por Unidade")}
      <div style="margin-bottom:8px;font-size:10px;color:#9CA3AF">
        Linha vermelha = limite de ${THRESHOLD}% · Quanto menor, melhor
      </div>
      <div style="padding:4px 0">${unitRows}</div>
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
  const topMdo = [...recs]
    .filter((r) => r.percentualMdo > 0)
    .sort((a, b) => a.percentualMdo - b.percentualMdo)
    .slice(0, 5);
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
        ${kpiCard("% MdO Médio", formatPercent(avgPct), metaAvg > 0 ? "Meta: " + formatPercent(metaAvg) : "Sem meta", pctColor)}
        ${kpiCard("Funcionários", totalFunc > 0 ? totalFunc.toFixed(0) : "—")}
        ${kpiCard("Custo Hora Extra", totalHe > 0 ? formatCurrency(totalHe) : "—", undefined, totalHe > 0 ? "#EF9F27" : "#111827")}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div>
          ${sectionTitle("✅ Melhor % MdO — Top 5")}
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
              ${u.metaPercentual > 0 ? '<div style="font-size:9px;color:#9CA3AF;margin-top:2px">Meta: ' + formatPercent(u.metaPercentual) + "</div>" : ""}
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
        ${kpiCard("Margem", formatPercent(m.margem), "Meta: " + formatPercent(m.meta), mColor)}
        ${kpiCard("CMV", formatPercent(m.cmvPercent), "Ideal ≤ 40%", cmvColor)}
        ${kpiCard("Despesa", formatCurrency(m.despesaTotal))}
      </div>
      ${
        alerts.length > 0
          ? `
        ${sectionTitle("Alertas (" + alerts.length + ")")}
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

function evolucaoAnualSection(records: FinancialRecord[], lastMonth: string): string {
  const months = [...new Set(records.map((r) => r.data))].filter(Boolean).sort();
  const ultimos12 = months.slice(-12);
  if (ultimos12.length < 2) return "";

  const byMonth = groupBy(records, "data");
  const data = ultimos12.map((mes) => {
    const recs = byMonth[mes] || [];
    const m = calcMetrics(recs);
    return { mes, receita: m.receitaBruta, despesa: m.despesaTotal, margem: m.margem };
  });

  const maxVal = Math.max(...data.map((d) => Math.max(d.receita, d.despesa))) * 1.05 || 1;
  const barWidth = Math.floor(520 / data.length) - 4;

  const bars = data
    .map((d) => {
      const recH = Math.round((d.receita / maxVal) * 120);
      const desH = Math.round((d.despesa / maxVal) * 120);
      const mColor = d.margem < 0 ? "#E24B4A" : d.margem < 5 ? "#EF9F27" : "#1D9E75";
      const isLast = d.mes === lastMonth;
      return `
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1">
        <div style="font-size:8px;font-weight:700;color:${mColor}">${d.margem.toFixed(1)}%</div>
        <div style="display:flex;align-items:flex-end;gap:1px;height:120px">
          <div style="width:${Math.max(barWidth / 2 - 1, 4)}px;height:${recH}px;background:${isLast ? "#1D9E75" : "#86EFAC"};border-radius:2px 2px 0 0"></div>
          <div style="width:${Math.max(barWidth / 2 - 1, 4)}px;height:${desH}px;background:${isLast ? "#E24B4A" : "#FCA5A5"};border-radius:2px 2px 0 0"></div>
        </div>
        <div style="font-size:7px;color:#6B7280;text-align:center;width:${barWidth + 2}px;overflow:hidden;white-space:nowrap">${d.mes}</div>
      </div>`;
    })
    .join("");

  const totalReceita = data.reduce((s, d) => s + d.receita, 0);
  const totalDespesa = data.reduce((s, d) => s + d.despesa, 0);
  const margemMedia = data.reduce((s, d) => s + d.margem, 0) / data.length;
  const melhorMes = [...data].sort((a, b) => b.margem - a.margem)[0];
  const piorMes = [...data].sort((a, b) => a.margem - b.margem)[0];

  return `
    <div style="page-break-before:always;padding-top:8px">
      <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:12px;padding:20px 28px;margin-bottom:20px">
        <div style="font-size:10px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">Análise Temporal</div>
        <div style="font-size:22px;font-weight:800;color:#FFFFFF">Evolução — Últimos ${data.length} Meses</div>
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px">
        ${kpiCard("Receita Acumulada", formatCurrency(totalReceita))}
        ${kpiCard("Despesa Acumulada", formatCurrency(totalDespesa))}
        ${kpiCard("Margem Média", formatPercent(margemMedia), undefined, margemMedia < 0 ? "#E24B4A" : margemMedia < 5 ? "#EF9F27" : "#1D9E75")}
        ${kpiCard("Melhor Mês", melhorMes.mes, "Margem: " + formatPercent(melhorMes.margem), "#1D9E75")}
        ${kpiCard("Pior Mês", piorMes.mes, "Margem: " + formatPercent(piorMes.margem), "#E24B4A")}
      </div>
      ${sectionTitle("Receita (verde) vs Despesa (vermelho) por Mês")}
      <div style="display:flex;align-items:flex-end;gap:2px;padding:0 8px;margin-bottom:24px">
        ${bars}
      </div>
    </div>`;
}

function comparativoAnualSection(records: FinancialRecord[], lastMonth: string): string {
  if (!lastMonth || lastMonth === "—") return "";
  const [mm, yyyy] = lastMonth.split("/").map(Number);
  if (!mm || !yyyy) return "";
  const sameMonthLastYear = String(mm).padStart(2, "0") + "/" + (yyyy - 1);

  const currRecs = records.filter((r) => r.data === lastMonth);
  const prevRecs = records.filter((r) => r.data === sameMonthLastYear);
  if (currRecs.length === 0) return "";

  const curr = calcMetrics(currRecs);
  const prev = prevRecs.length > 0 ? calcMetrics(prevRecs) : null;

  const delta = (cur: number, pre: number | null | undefined) => {
    if (!pre || pre === 0) return null;
    return ((cur - pre) / Math.abs(pre)) * 100;
  };

  const arrowHtml = (d: number | null, invert = false) => {
    if (d === null) return '<span style="color:#9CA3AF;font-size:10px">N/D</span>';
    const positive = invert ? d < 0 : d > 0;
    const color = positive ? "#1D9E75" : "#E24B4A";
    const arrow = d > 0 ? "▲" : "▼";
    return (
      '<span style="color:' +
      color +
      ';font-size:11px;font-weight:700">' +
      arrow +
      " " +
      Math.abs(d).toFixed(1) +
      "%</span>"
    );
  };

  const regionais = getRegionais(currRecs);
  const byRegional = groupBy(currRecs, "regional");
  const byRegionalPrev = groupBy(prevRecs, "regional");

  const regionalRows = regionais
    .map((reg) => {
      const cm = calcMetrics(byRegional[reg] || []);
      const pm = byRegionalPrev[reg] ? calcMetrics(byRegionalPrev[reg]) : null;
      const mColor = cm.margem < 0 ? "#E24B4A" : cm.margem < 5 ? "#EF9F27" : "#1D9E75";
      return `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #F0F0F0;font-size:12px;font-weight:600;color:#374151">${reg}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #F0F0F0;font-size:12px;text-align:right">${formatCurrency(cm.receitaBruta)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #F0F0F0;font-size:11px;text-align:right">${pm ? formatCurrency(pm.receitaBruta) : "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #F0F0F0;text-align:center">${arrowHtml(delta(cm.receitaBruta, pm?.receitaBruta))}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #F0F0F0;font-size:12px;text-align:right;color:${mColor};font-weight:700">${formatPercent(cm.margem)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #F0F0F0;font-size:11px;text-align:right">${pm ? formatPercent(pm.margem) : "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #F0F0F0;text-align:center">${arrowHtml(cm.margem - (pm?.margem ?? cm.margem), false)}</td>
      </tr>`;
    })
    .join("");

  const growthArrow = arrowHtml(delta(curr.receitaBruta, prev?.receitaBruta));

  return `
    <div style="page-break-before:always;padding-top:8px">
      <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:12px;padding:20px 28px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:10px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">Comparativo Anual</div>
          <div style="font-size:22px;font-weight:800;color:#FFFFFF">${lastMonth} vs ${sameMonthLastYear}</div>
        </div>
        ${prev ? '<div style="text-align:center;background:rgba(255,255,255,0.1);border-radius:10px;padding:10px 20px"><div style="font-size:11px;color:#9CA3AF;margin-bottom:2px">Crescimento receita</div><div style="font-size:22px;font-weight:800">' + growthArrow + "</div></div>" : ""}
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px">
        ${kpiCard("Receita " + lastMonth, formatCurrency(curr.receitaBruta))}
        ${prev ? kpiCard("Receita " + sameMonthLastYear, formatCurrency(prev.receitaBruta), undefined, "#6B7280") : ""}
        ${kpiCard("Margem " + lastMonth, formatPercent(curr.margem), undefined, curr.margem < 0 ? "#E24B4A" : "#1D9E75")}
        ${prev ? kpiCard("Margem " + sameMonthLastYear, formatPercent(prev.margem), undefined, "#6B7280") : ""}
      </div>
      ${sectionTitle("Comparativo por Regional")}
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:#F9FAFB">
            <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:600;color:#6B7280;text-transform:uppercase">Regional</th>
            <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:600;color:#6B7280;text-transform:uppercase">Receita ${lastMonth}</th>
            <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:600;color:#6B7280;text-transform:uppercase">Receita ${sameMonthLastYear}</th>
            <th style="padding:10px 12px;text-align:center;font-size:10px;font-weight:600;color:#6B7280;text-transform:uppercase">Var.</th>
            <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:600;color:#6B7280;text-transform:uppercase">Margem ${lastMonth}</th>
            <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:600;color:#6B7280;text-transform:uppercase">Margem ${sameMonthLastYear}</th>
            <th style="padding:10px 12px;text-align:center;font-size:10px;font-weight:600;color:#6B7280;text-transform:uppercase">Var.</th>
          </tr>
        </thead>
        <tbody>${regionalRows}</tbody>
      </table>
    </div>`;
}

function metasSection(records: FinancialRecord[], lastMonth: string): string {
  const recs = records.filter((r) => r.data === lastMonth);
  if (recs.length === 0) return "";

  const byUnidade = groupBy(recs, "unidade");
  const unidades = Object.entries(byUnidade)
    .map(([unidade, urecs]) => {
      const m = calcMetrics(urecs);
      const meta = m.meta;
      const atingimento = meta > 0 ? (m.margem / meta) * 100 : null;
      const grade =
        atingimento === null ? "neutral" : atingimento >= 100 ? "success" : atingimento >= 80 ? "warning" : "danger";
      return {
        unidade,
        regional: urecs[0]?.regional ?? "",
        margem: m.margem,
        meta,
        atingimento,
        grade,
        receita: m.receitaBruta,
      };
    })
    .filter((u) => u.meta > 0)
    .sort((a, b) => (b.atingimento ?? 0) - (a.atingimento ?? 0));

  const semMeta = Object.entries(byUnidade)
    .filter(([_, urecs]) => calcMetrics(urecs).meta <= 0)
    .map(([unidade]) => unidade);

  const atingiram = unidades.filter((u) => (u.atingimento ?? 0) >= 100).length;
  const naoAtingiram = unidades.filter((u) => (u.atingimento ?? 0) < 100).length;

  const gradeColor = (g: string) =>
    g === "success" ? "#1D9E75" : g === "warning" ? "#EF9F27" : g === "danger" ? "#E24B4A" : "#9CA3AF";
  const gradeBg = (g: string) =>
    g === "success" ? "#EAF3DE" : g === "warning" ? "#FAEEDA" : g === "danger" ? "#FCEBEB" : "#F9FAFB";

  const rows = unidades
    .map((u) => {
      const color = gradeColor(u.grade);
      const bg = gradeBg(u.grade);
      const barW = Math.min(100, Math.max(0, u.atingimento ?? 0));
      const statusLabel = u.grade === "success" ? "✓ Meta atingida" : u.grade === "warning" ? "⚠ Próximo" : "✗ Abaixo";
      return `
      <tr style="background:${bg}">
        <td style="padding:8px 12px;border-bottom:1px solid #F0F0F0;font-size:12px;font-weight:600">${u.unidade}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #F0F0F0;font-size:11px;color:#6B7280">${u.regional}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #F0F0F0;font-size:12px;text-align:right;color:${u.margem < 0 ? "#E24B4A" : "#374151"};font-weight:700">${formatPercent(u.margem)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #F0F0F0;font-size:12px;text-align:right;color:#6B7280">${formatPercent(u.meta)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #F0F0F0">
          <div style="display:flex;align-items:center;gap:8px">
            <div style="flex:1;background:#E5E7EB;border-radius:99px;height:6px">
              <div style="width:${barW}%;background:${color};height:6px;border-radius:99px"></div>
            </div>
            <span style="font-size:11px;font-weight:800;color:${color};width:40px;text-align:right">${u.atingimento?.toFixed(0)}%</span>
          </div>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #F0F0F0;text-align:center">
          <span style="font-size:9px;font-weight:700;padding:2px 8px;border-radius:99px;background:${color}20;color:${color}">${statusLabel}</span>
        </td>
      </tr>`;
    })
    .join("");

  return `
    <div style="page-break-before:always;padding-top:8px">
      <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:12px;padding:20px 28px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:10px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">Performance</div>
          <div style="font-size:22px;font-weight:800;color:#FFFFFF">Metas — ${lastMonth}</div>
        </div>
        <div style="display:flex;gap:12px">
          <div style="text-align:center;background:#1D9E7522;border-radius:10px;padding:10px 16px;border:1px solid #1D9E75">
            <div style="font-size:22px;font-weight:800;color:#1D9E75">${atingiram}</div>
            <div style="font-size:9px;color:#1D9E75;text-transform:uppercase;font-weight:600">Atingiram</div>
          </div>
          <div style="text-align:center;background:#E24B4A22;border-radius:10px;padding:10px 16px;border:1px solid #E24B4A">
            <div style="font-size:22px;font-weight:800;color:#E24B4A">${naoAtingiram}</div>
            <div style="font-size:9px;color:#E24B4A;text-transform:uppercase;font-weight:600">Não atingiram</div>
          </div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:#F9FAFB">
            <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:600;color:#6B7280;text-transform:uppercase">Unidade</th>
            <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:600;color:#6B7280;text-transform:uppercase">Regional</th>
            <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:600;color:#6B7280;text-transform:uppercase">Margem Real</th>
            <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:600;color:#6B7280;text-transform:uppercase">Meta</th>
            <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:600;color:#6B7280;text-transform:uppercase">Atingimento</th>
            <th style="padding:10px 12px;text-align:center;font-size:10px;font-weight:600;color:#6B7280;text-transform:uppercase">Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ${semMeta.length > 0 ? '<div style="margin-top:16px;padding:12px 16px;background:#F9FAFB;border-radius:8px;border:1px solid #E5E7EB"><p style="font-size:10px;color:#9CA3AF;margin:0">Unidades sem meta definida: ' + semMeta.join(", ") + "</p></div>" : ""}
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

  const byRegional = groupBy(lastMonthRecords, "regional");
  const regionalData = regionais.map((reg) => {
    const recs = byRegional[reg] || [];
    const rm = calcMetrics(recs);
    return { label: reg, receita: rm.receitaBruta, despesa: rm.despesaTotal, margem: rm.margem };
  });
  const maxVal = Math.max(...regionalData.map((r) => Math.max(r.receita, r.despesa))) * 1.05;

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
    <button onclick="window.print()" style="background:#1D9E75;color:#fff;border:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">
      📄 Salvar como PDF
    </button>
  </div>
  <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);border-radius:16px;padding:48px 40px;margin-bottom:36px;text-align:center">
    <div style="font-size:13px;color:#9CA3AF;margin-bottom:20px;letter-spacing:0.08em;text-transform:uppercase">Relatório de Gestão Financeira</div>
    <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:12px;padding:12px 40px;margin-bottom:20px">
      <div style="font-size:28px;font-weight:800;color:#FFFFFF">${lastMonth}</div>
    </div>
    <div style="font-size:11px;color:#9CA3AF;margin-top:8px">${today}</div>
    <div style="font-size:11px;color:#9CA3AF;margin-top:3px">Desenvolvido pelo Superintendente Sandro Rodigheiro</div>
  </div>

  ${sectionTitle("Visão Consolidada da Rede")}
  <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px">
    ${kpiCard("Receita Total", formatCurrency(m.receitaBruta))}
    ${kpiCard("Despesa Total", formatCurrency(m.despesaTotal))}
    ${kpiCard("Margem Geral", formatPercent(m.margem), "Meta: " + formatPercent(m.meta), mColor)}
    ${kpiCard("CMV Médio", formatPercent(m.cmvPercent), "Ideal ≤ 40%", cmvColor)}
  </div>

  <div style="display:flex;gap:12px;margin-bottom:28px">
    <div style="background:#FCEBEB;border:1px solid #F09595;border-radius:10px;padding:18px;flex:1;text-align:center">
      <div style="font-size:36px;font-weight:800;color:#A32D2D">${dangerAlerts.length}</div>
      <div style="font-size:10px;font-weight:700;color:#A32D2D;text-transform:uppercase;margin-top:4px">Alertas Críticos</div>
    </div>
    <div style="background:#FAEEDA;border:1px solid #FAC775;border-radius:10px;padding:18px;flex:1;text-align:center">
      <div style="font-size:36px;font-weight:800;color:#633806">${warningAlerts.length}</div>
      <div style="font-size:10px;font-weight:700;color:#633806;text-transform:uppercase;margin-top:4px">Alertas de Atenção</div>
    </div>
    <div style="background:#EAF3DE;border:1px solid #C0DD97;border-radius:10px;padding:18px;flex:1;text-align:center">
      <div style="font-size:36px;font-weight:800;color:#27500A">${scores.filter((s) => s.grade === "green").length}</div>
      <div style="font-size:10px;font-weight:700;color:#27500A;text-transform:uppercase;margin-top:4px">Unidades Saudáveis</div>
    </div>
    <div style="background:#F0F9FF;border:1px solid #BAE6FD;border-radius:10px;padding:18px;flex:1;text-align:center">
      <div style="font-size:36px;font-weight:800;color:#0C447C">${scores.length}</div>
      <div style="font-size:10px;font-weight:700;color:#0C447C;text-transform:uppercase;margin-top:4px">Total de Unidades</div>
    </div>
  </div>

  ${sectionTitle("Receita vs Despesa por Regional")}
  ${barChart(regionalData, maxVal)}

  ${sectionTitle("Score de Saúde por Regional")}
  <div style="display:flex;gap:16px;flex-wrap:wrap;justify-content:center;margin-bottom:24px;padding:16px;background:#F9FAFB;border-radius:12px">
    ${regionalScores.map((r) => scoreGauge(r.regional, r.score)).join("")}
  </div>

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

  ${
    dangerAlerts.length > 0
      ? sectionTitle("Alertas Críticos (" + dangerAlerts.length + ")") +
        '<div style="margin-bottom:24px">' +
        dangerAlerts
          .slice(0, 10)
          .map((a) => alertBadge(a.type, a.unidade, a.message))
          .join("") +
        "</div>"
      : ""
  }

  ${evolucaoAnualSection(records, lastMonth)}
  ${comparativoAnualSection(records, lastMonth)}
  ${metasSection(records, lastMonth)}
  ${admSection(allData, lastMonth)}
  ${rhSection(rhRecords, lastMonth)}
  ${regionais.map((reg) => regionalSection(reg, records, lastMonth)).join("")}

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

interface RegionalPdfOptions {
  selectedMonths?: string[];
  managerName?: string;
  logoUrl?: string;
}

export function exportPdfRegional(
  allData: FinancialRecord[],
  regional: string,
  rhRecords: RhRecord[] = [],
  options: RegionalPdfOptions = {},
) {
  const records = filterOutAdm(allData).filter((r) => r.regional === regional);
  if (records.length === 0) return;

  const availableMonths = [...new Set(records.map((r) => r.data))].filter(Boolean).sort();
  const selectedAvailableMonths = (options.selectedMonths ?? [])
    .filter((month) => availableMonths.includes(month))
    .sort();
  const lastMonth = selectedAvailableMonths[selectedAvailableMonths.length - 1] ?? getLastMonth(records);
  const lastMonthRecords = records.filter((r) => r.data === lastMonth);
  const m = calcMetrics(lastMonthRecords);
  const alerts = generateAlerts(lastMonthRecords);
  const dangerAlerts = alerts.filter((a) => a.type === "danger");
  const warningAlerts = alerts.filter((a) => a.type === "warning");
  const scores = calcHealthScores(lastMonthRecords);
  const rhRecsRegional = rhRecords.filter((r) => {
    const reg = r.regional?.toUpperCase() ?? "";
    return reg === regional.toUpperCase() || reg.includes(regional.split(" ")[0]);
  });
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const mColor = m.margem < 0 ? "#E24B4A" : m.margem < 5 ? "#EF9F27" : "#1D9E75";
  const cmvColor = m.cmvPercent > 50 ? "#E24B4A" : m.cmvPercent > 40 ? "#EF9F27" : "#1D9E75";
  const metaLabel = "Meta: " + formatPercent(m.meta);
  const logoUrl = new URL(options.logoUrl || "/logo.png", window.location.origin).href;
  const managerName = options.managerName?.trim();

  const alertasCriticos =
    dangerAlerts.length > 0
      ? "<div>" +
        sectionTitle("Alertas Críticos (" + dangerAlerts.length + ")") +
        '<div style="margin-bottom:24px">' +
        dangerAlerts
          .slice(0, 15)
          .map((a) => alertBadge(a.type, a.unidade, a.message))
          .join("") +
        "</div></div>"
      : "";

  const alertasAtencao =
    warningAlerts.length > 0
      ? "<div>" +
        sectionTitle("Alertas de Atenção (" + warningAlerts.length + ")") +
        '<div style="margin-bottom:24px">' +
        warningAlerts
          .slice(0, 10)
          .map((a) => alertBadge(a.type, a.unidade, a.message))
          .join("") +
        "</div></div>"
      : "";

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório ${regional} — ${lastMonth}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F8F9FA; color: #111827; padding: 32px; }
  @media print { body { padding: 0; } .no-print { display: none; } }
</style>
</head>
<body>
  <div class="no-print" style="text-align:center;padding:12px;background:#1D9E75;color:white;border-radius:8px;margin-bottom:24px;cursor:pointer" onclick="window.print()">
    📄 Salvar como PDF
  </div>
  <div style="background:linear-gradient(135deg,#1D9E75 0%,#157C5D 100%);border-radius:16px;padding:42px 40px;margin-bottom:36px;text-align:center">
    <img src="${logoUrl}" alt="Logo Mais Sabor" style="display:block;width:auto;height:64px;max-width:180px;object-fit:contain;margin:0 auto 22px;background:#FFFFFF;border-radius:14px;padding:10px;box-shadow:0 14px 32px rgba(0,0,0,0.18)" />
    <div style="font-size:13px;color:rgba(255,255,255,0.78);margin-bottom:18px;letter-spacing:0.08em;text-transform:uppercase">Relatório de Gestão Financeira</div>
    <div style="font-size:28px;font-weight:800;color:#FFFFFF;margin-bottom:8px">${regional}</div>
    ${managerName ? `<div style="font-size:13px;font-weight:700;color:#FFFFFF;margin-bottom:16px">Gerente responsável: ${managerName}</div>` : ""}
    <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:12px;padding:12px 40px;margin-bottom:20px">
      <div style="font-size:28px;font-weight:800;color:#FFFFFF">${lastMonth}</div>
    </div>
    <div style="font-size:11px;color:rgba(255,255,255,0.78);margin-top:8px">${today}</div>
  </div>
  ${sectionTitle("Visão da Regional")}
  <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px">
    ${kpiCard("Receita Total", formatCurrency(m.receitaBruta))}
    ${kpiCard("Despesa Total", formatCurrency(m.despesaTotal))}
    ${kpiCard("Margem Geral", formatPercent(m.margem), metaLabel, mColor)}
    ${kpiCard("CMV Médio", formatPercent(m.cmvPercent), "Ideal ≤ 40%", cmvColor)}
  </div>
  ${alertasCriticos}
  ${alertasAtencao}
  ${sectionTitle("Score de Saúde por Unidade")}
  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:24px">
    ${scores.map((s, i) => unitScoreBar(i + 1, s.unidade, s.score, s.metrics.margem, s.metrics.cmvPercent)).join("")}
  </div>
  ${evolucaoAnualSection(records, lastMonth)}
  ${metasSection(records, lastMonth)}
  ${rhSection(rhRecsRegional, lastMonth)}
  <div style="margin-top:48px;padding-top:16px;border-top:1px solid #E5E7EB;text-align:center">
    <div style="font-size:11px;color:#9CA3AF">Mais Sabor · Desenvolvido pelo Superintendente Sandro Rodigheiro</div>
    <div style="font-size:10px;color:#D1D5DB;margin-top:4px">Gerado em ${today}</div>
  </div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=1200,height=800");
  if (!win) {
    alert("Permita pop-ups para exportar o PDF.");
    return;
  }
  win.document.write(html);
  win.document.close();
}
