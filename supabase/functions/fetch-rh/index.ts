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

function parseBR(value: string): number {
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
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) { const p = v.split('/'); return `${p[1]}/${p[2]}`; }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)) { const p = v.split('/'); return `${p[0].padStart(2,'0')}/${p[2]}`; }
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { const p = v.split('-'); return `${p[1]}/${p[0]}`; }
  if (/^\d{4,5}$/.test(v)) {
    const date = new Date((parseInt(v) - 25569) * 86400 * 1000);
    return `${String(date.getUTCMonth() + 1).padStart(2,'0')}/${date.getUTCFullYear()}`;
  }
  return v;
}

function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  let cur = '', inQ = false, row: string[] = [];
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (c === '"') { if (inQ && csv[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (c === ',' && !inQ) { row.push(cur); cur = ''; }
    else if ((c === '\n' || c === '\r') && !inQ) {
      if (c === '\r' && csv[i+1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some(x => x.trim())) rows.push(row);
      row = [];
    } else cur += c;
  }
  if (cur || row.length) { row.push(cur); if (row.some(x => x.trim())) rows.push(row); }
  return rows;
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=BASE_RH`;
    const res = await fetch(csvUrl);
    if (!res.ok) throw new Error(`Failed to fetch BASE_RH: ${res.status}`);

    const csvText = await res.text();
    const rows = parseCSV(csvText);
    if (rows.length < 2) {
      return new Response(JSON.stringify({ data: [], regionais: [], unidades: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('BASE_RH headers:', rows[0]);

    const dataRows = rows.slice(1);
    let idCounter = 0;

    const records = dataRows
      .filter(cols => cols[2]?.trim())
      .map(cols => ({
        id: `rh-${++idCounter}`,
        data: parseDate(cols[0] || ''),
        regional: (cols[1] || '').trim().toUpperCase(),
        unidade: (cols[2] || '').trim(),
        maoDeObra: parseBR(cols[3] || ''),
        encargosSociais: parseBR(cols[4] || ''),
        percentualMdo: parseBR(cols[5] || ''),
        metaPercentual: parseBR(cols[6] || ''),
        numFuncionarios: parseBR(cols[7] || ''),
        horaExtra: parseBR(cols[8] || ''),
      }))
      .filter(r => r.data && r.regional && r.unidade);

    const regionais = [...new Set(records.map(r => r.regional))].filter(Boolean).sort();
    const unidades = [...new Set(records.map(r => r.unidade))].filter(Boolean).sort();

    return new Response(JSON.stringify({ data: records, regionais, unidades }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('fetch-rh error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
