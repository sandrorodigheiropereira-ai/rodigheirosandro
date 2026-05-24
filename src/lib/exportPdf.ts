import { FinancialRecord } from '@/types/financial';
import { formatCurrency } from './calculations';

export function exportPdf(records: FinancialRecord[]) {
  if (!records || records.length === 0) {
    alert('Nenhum dado para exportar.');
    return;
  }

  const totalReceitaBruta = records.reduce((s, r) => s + r.receitaBruta, 0);
  const totalReceitaLiquida = records.reduce((s, r) => s + r.receitaLiquida, 0);
  const totalDespesa = records.reduce((s, r) => s + r.despesaTotal, 0);
  const totalCmv = records.reduce((s, r) => s + r.cmv, 0);
  const totalMargem = totalReceitaLiquida - totalDespesa;
  const margemPct = totalReceitaLiquida > 0 ? (totalMargem / totalReceitaLiquida) * 100 : 0;
  const cmvPct = totalReceitaBruta > 0 ? (totalCmv / totalReceitaBruta) * 100 : 0;

  const rowsHtml = records
    .map(
      (r) => `
      <tr>
        <td>${r.data}</td>
        <td>${r.regional}</td>
        <td>${r.unidade}</td>
        <td class="num">${formatCurrency(r.receitaBruta)}</td>
        <td class="num">${formatCurrency(r.despesaTotal)}</td>
        <td class="num">${formatCurrency(r.cmv)}</td>
        <td class="num">${r.receitaBruta > 0 ? ((r.cmv / r.receitaBruta) * 100).toFixed(2) : '0.00'}%</td>
        <td class="num">${formatCurrency(r.receitaLiquida - r.despesaTotal)}</td>
        <td class="num">${r.margem.toFixed(2)}%</td>
      </tr>`
    )
    .join('');

  const today = new Date().toLocaleDateString('pt-BR');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>Dashboard Consolidado - ${today}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 24px; color: #111; }
  header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 20px; }
  h1 { font-size: 20px; margin: 0; color: #065f46; }
  .meta { font-size: 12px; color: #555; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
  .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; background: #f9fafb; }
  .card .label { font-size: 11px; color: #6b7280; text-transform: uppercase; }
  .card .value { font-size: 16px; font-weight: 600; margin-top: 4px; color: #111; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: left; }
  th { background: #065f46; color: white; font-weight: 600; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  tr:nth-child(even) td { background: #f9fafb; }
  .actions { margin-bottom: 16px; }
  .btn { background: #059669; color: white; border: none; padding: 10px 16px; border-radius: 6px; font-size: 14px; cursor: pointer; font-weight: 600; }
  .btn:hover { background: #047857; }
  @media print {
    .actions { display: none; }
    body { margin: 12px; }
  }
</style>
</head>
<body>
  <div class="actions">
    <button class="btn" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
  </div>
  <header>
    <h1>Dashboard Consolidado</h1>
    <div class="meta">Gerado em ${today} • ${records.length} registros</div>
  </header>
  <div class="summary">
    <div class="card"><div class="label">Receita Bruta</div><div class="value">${formatCurrency(totalReceitaBruta)}</div></div>
    <div class="card"><div class="label">Despesa Total</div><div class="value">${formatCurrency(totalDespesa)}</div></div>
    <div class="card"><div class="label">CMV (${cmvPct.toFixed(2)}%)</div><div class="value">${formatCurrency(totalCmv)}</div></div>
    <div class="card"><div class="label">Margem (${margemPct.toFixed(2)}%)</div><div class="value">${formatCurrency(totalMargem)}</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Data</th><th>Regional</th><th>Unidade</th>
        <th style="text-align:right">Receita Bruta</th>
        <th style="text-align:right">Despesa Total</th>
        <th style="text-align:right">CMV</th>
        <th style="text-align:right">CMV %</th>
        <th style="text-align:right">Margem</th>
        <th style="text-align:right">Margem %</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) {
    alert('Permita pop-ups para exportar o PDF.');
    return;
  }
  win.document.write(html);
  win.document.close();
}
