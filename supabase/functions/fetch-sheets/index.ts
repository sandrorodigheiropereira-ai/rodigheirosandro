import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ALLOWED_ORIGINS = [
  'https://rodigheirosandro.lovable.app',
  'http://localhost:5173',
  'http://localhost:8080',
];

function getCorsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

const SPREADSHEET_ID = '1-CinFq0rTXDGlGgFFQZ22Vfr2qraQeoSbhyET3p8oxA';

function parseBrazilianNumber(value: string): number {
  if (!value || value.trim() === '') return 0;
  const cleaned = value.replace('%', '').trim();
  const normalized = cleaned.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : num;
}

function parseDate(value: string): string {
  const parts = value.split('/');
  if (parts.length === 3) {
    return `${parts[1]}/${parts[2]}`;
  }
  return value;
}

interface SheetRow {
  id: string;
  data: string;
  regional: string;
  unidade: string;
  receitaBruta: number;
  impostos: number;
  receitaLiquida: number;
  maoDeObra: number;
  materiaPrima: number;
  cmv: number;
  despesaTotal: number;
  meta: number;
  margem: number;
}

function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (char === '"') {
      if (inQuotes && csv[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && csv[i + 1] === '\n') i++;
      row.push(current);
      current = '';
      if (row.some(cell => cell.trim() !== '')) rows.push(row);
      row = [];
    } else {
      current += char;
    }
  }
  if (current || row.length > 0) {
    row.push(current);
    if (row.some(cell => cell.trim() !== '')) rows.push(row);
  }
  return rows;
}

const HEADER_MAP: Record<string, string> = {
  'data':            'data',
  'regional':        'regional',
  'unidade':         'unidade',
  'receita bruta':   'receitaBruta',
  'impostos':        'impostos',
  'receita liquida': 'receitaLiquida',
  'receita líquida': 'receitaLiquida',
  'mao de obra':     'maoDeObra',
  'mão de obra':     'maoDeObra',
  'materia prima':   'materiaPrima',
  'matéria prima':   'materiaPrima',
  'cmv':             'cmv',
  'despesa total':   'despesaTotal',
  'meta':            'meta',
  'margem':          'margem',
};

function buildIndexMap(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    const normalized = h.trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const key = Object.keys(HEADER_MAP).find(k =>
      k.normalize('NFD').replace(/[\u0300-\u036f]/g, '') === normalized
    );
    if (key) map[HEADER_MAP[key]] = i;
  });
  return map;
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=BASE_FINANCEIRA`;
    const response = await fetch(csvUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch spreadsheet: ${response.status}`);
    }

    const csvText = await response.text();
    const rows = parseCSV(csvText);

    if (rows.length < 2) {
      return new Response(JSON.stringify({ data: [], regionais: [], unidades: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const headerRow = rows[0].map(h => h.trim());
    const idx = buildIndexMap(headerRow);
    const useFallback = Object.keys(idx).length < 8;

    const col = (row: string[], field: string, legacyPos: number): string => {
      if (useFallback) return row[legacyPos] || '';
      const i = idx[field];
      return i !== undefined ? (row[i] || '') : '';
    };

    const dataRows = rows.slice(1);
    let idCounter = 0;

    const records: SheetRow[] = dataRows.map((cols) => {
      const receitaLiquida = parseBrazilianNumber(col(cols, 'receitaLiquida', 5));
      const cmvPercent = parseBrazilianNumber(col(cols, 'cmv', 8));
      const cmv = cmvPercent < 100 && cmvPercent > 0
        ? (cmvPercent / 100) * receitaLiquida
        : cmvPercent;

      return {
        id: `rec-${++idCounter}`,
        data: parseDate(col(cols, 'data', 0)),
        regional: col(cols, 'regional', 1).trim(),
        unidade: col(cols, 'unidade', 2).trim(),
        receitaBruta: parseBrazilianNumber(col(cols, 'receitaBruta', 3)),
        impostos: parseBrazilianNumber(col(cols, 'impostos', 4)),
        receitaLiquida,
        maoDeObra: parseBrazilianNumber(col(cols, 'maoDeObra', 6)),
        materiaPrima: parseBrazilianNumber(col(cols, 'materiaPrima', 7)),
        cmv,
        despesaTotal: parseBrazilianNumber(col(cols, 'despesaTotal', 9)),
        meta: parseBrazilianNumber(col(cols, 'meta', 10)),
        margem: parseBrazilianNumber(col(cols, 'margem', 11)),
      };
    });

    const regionais = [...new Set(records.map(r => r.regional))].filter(Boolean).sort();
    const unidades = [...new Set(records.map(r => r.unidade))].filter(Boolean).sort();

    return new Response(JSON.stringify({ data: records, regionais, unidades }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching sheets:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});