import { FinancialRecord } from '@/types/financial';
import { formatCurrency } from './calculations';

export function exportPdf(records: FinancialRecord[]) {
  if (!records || records.length === 0) {
    alert('Nenhum dado para exportar.');
    return;
  }

  const headers = [
    'Data',
    'Regional',
    'Unidade',
    'Receita Bruta',
    'Despesa Total',
    'CMV',
    'CMV %',
    'Margem',
    'Margem %',
  ];

  const rows = records.map((r) => [
    r.data,
    r.regional,
    r.unidade,
    formatCurrency(r.receitaBruta),
    formatCurrency(r.despesaTotal),
    formatCurrency(r.cmv),
    `${r.receitaBruta > 0 ? ((r.cmv / r.receitaBruta) * 100).toFixed(2) : '0.00'}%`,
    formatCurrency(r.receitaLiquida - r.despesaTotal),
    `${r.margem.toFixed(2)}%`,
  ]);

  const csvContent = [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `dashboard-consolidado-${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
