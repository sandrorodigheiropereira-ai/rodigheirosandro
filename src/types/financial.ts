export interface FinancialRecord {
  id: string;
  data: string; // mês/ano e.g. "01/2025"
  regional: string;
  unidade: string;
  receitaBruta: number;
  impostos: number;
  receitaLiquida: number;
  maoDeObra: number;
  materiaPrima: number;
  cmv: number;
  despesaTotal: number;
  meta: number; // %
  margem: number; // %
}

export interface MetaRecord {
  regional: string;
  unidade: string;
  metaReceita: number;
  metaEbitda: number;
  metaCmv: number; // %
  metaMaoDeObra: number; // %
}

export interface CalculatedMetrics {
  receitaBruta: number;
  receitaLiquida: number;
  despesaTotal: number;
  margem: number;
  meta: number;
  cmvPercent: number;
  maoDeObraPercent: number;
  crescimentoCmv: number;
}

export interface Alert {
  type: 'danger' | 'warning' | 'info';
  message: string;
  unidade: string;
  regional: string;
  value: number;
}

export type DashboardView = 'consolidado' | 'regional' | 'unidade';
