export function exportPdfRegional(allData: FinancialRecord[], regional: string, rhRecords: RhRecord[] = []) {
  const records = filterOutAdm(allData).filter((r) => r.regional === regional);
  if (records.length === 0) return;

  const lastMonth = getLastMonth(records);
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
  <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);border-radius:16px;padding:48px 40px;margin-bottom:36px;text-align:center">
    <div style="font-size:13px;color:#9CA3AF;margin-bottom:20px;letter-spacing:0.08em;text-transform:uppercase">Relatório de Gestão Financeira</div>
    <div style="font-size:28px;font-weight:800;color:#FFFFFF;margin-bottom:8px">${regional}</div>
    <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:12px;padding:12px 40px;margin-bottom:20px">
      <div style="font-size:28px;font-weight:800;color:#FFFFFF">${lastMonth}</div>
    </div>
    <div style="font-size:11px;color:#9CA3AF;margin-top:8px">${today}</div>
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
    ${scores.map((s) => unitScoreBar(s.score + 1, s.unidade, s.score, s.metrics.margem, s.metrics.cmvPercent)).join("")}
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
