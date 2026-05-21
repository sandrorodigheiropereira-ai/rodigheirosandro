import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return (
    /^https:\/\/[a-z0-9-]+\.lovable\.app$/.test(origin) ||
    origin === 'http://localhost:5173' ||
    origin === 'http://localhost:8080'
  );
}

function getCorsHeaders(origin: string | null) {
  const allowed = isAllowedOrigin(origin) ? origin! : 'https://lovable.app';
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
  if (!value || value.trim() === '') return '';
  const v = value.trim().replace(/^"|"$/g, '');

  if (/^\d{2}\/\d{4}$/.test(v)) return v;

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
    const p = v.split('/');
    return `${p[1]}/${p[2]}`;
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)) {
    const p = v.split('/');
    return `${p[0].padStart(2,'0')}/${p[2]}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const p = v.split('-');
    return `${p[1]}/${p[0]}`;
  }

  if (/^\d{4,5}$/.test(v)) {
    const serial = parseInt(v);
    const date = new Date((serial - 25569) * 86400 * 1000);
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = date.getUTCFullYear();
    return `${mm}/${yyyy}`;
  }

  return v;
}

function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  let row: string[] = [];
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (char === '"') {
      if (inQuotes && csv[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === ',' && !inQuotes) {
      row.push(current); current = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && csv[i + 1] === '\n') i++;
      row.push(current); current = '';
      if (row.some(cell => cell.trim() !== '')) rows.push(row);
      row = [];
    } else { current += char; }
  }
  if (current || row.length > 0) {
    row.push(current);
    if (row.some(cell => cell.trim() !== '')) rows.push(row);
  }
  return rows;
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
    if (!response.ok) throw new Error(`Failed to fetch spreadsheet: ${response.status}`);

    const csvText = await response.text();
    const rows = parseCSV(csvText);

    if (rows.length < 2) {
      return new Response(JSON.stringify({ data: [], regionais: [], unidades: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Raw date value col[0]:', JSON.stringify(rows[1][0]));

    const dataRows = rows.slice(1);
    let idCounter = 0;

    const records = dataRows.map((cols) => {
      const receitaLiquida = parseBrazilianNumber(cols[5] || '');
      const cmvPercent = parseBrazilianNumber(cols[8] || '');
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
