import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SPREADSHEET_ID = '1-CinFq0rTXDGlGgFFQZ22Vfr2qraQeoSbhyET3p8oxA';

function parseBrazilianNumber(value: string): number {
  if (!value || value.trim() === '') return 0;
  // Remove percentage sign
  const cleaned = value.replace('%', '').trim();
  // Brazilian format: 1.234.567,89 → 1234567.89
  const normalized = cleaned.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : num;
}

function parseDate(value: string): string {
  // Input: "01/01/2026" → Output: "01/2026" (MM/YYYY)
  const parts = value.split('/');
  if (parts.length === 3) {
    return `${parts[1]}/${parts[2]}`; // month/year
  }
  return value;
}

interface SheetRow {
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

serve(async (req) => {
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

    // Skip header row
    const dataRows = rows.slice(1);
    let idCounter = 0;

    const records: SheetRow[] = dataRows.map((cols) => {
      // CMV in sheet is a percentage string like "53,87%" — convert to absolute value
      const receitaLiquida = parseBrazilianNumber(cols[5] || '');
      const cmvPercent = parseBrazilianNumber(cols[8] || '');
      // If CMV looks like a percentage (< 100), compute absolute from receita liquida
      const cmv = cmvPercent < 100 && cmvPercent > 0
        ? (cmvPercent / 100) * receitaLiquida
        : cmvPercent;

      return {
        id: `rec-${++idCounter}`,
        data: parseDate(cols[0] || ''),
        regional: (cols[1] || '').trim(),
        unidade: (cols[2] || '').trim(),
        receitaBruta: parseBrazilianNumber(cols[3] || ''),
        impostos: parseBrazilianNumber(cols[4] || ''),
        receitaLiquida,
        maoDeObra: parseBrazilianNumber(cols[6] || ''),
        materiaPrima: parseBrazilianNumber(cols[7] || ''),
        cmv,
        despesaTotal: parseBrazilianNumber(cols[9] || ''),
        meta: parseBrazilianNumber(cols[10] || ''),
        margem: parseBrazilianNumber(cols[11] || ''),
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
