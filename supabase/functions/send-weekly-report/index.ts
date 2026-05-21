import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SPREADSHEET_ID = '1-CinFq0rTXDGlGgFFQZ22Vfr2qraQeoSbhyET3p8oxA';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const FROM_EMAIL = 'relatorio@maissabor.ind.br';

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
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) { const p = v.split('/'); return `${p[1]}/${p[2]}`; }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)) { const p = v.split('/'); return `${p[0].padStart(2,'0')}/${p[2]}`; }
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { const p = v.split('-'); return `${p[1]}/${p[0]}`; }
  if (/^\d{4,5}$/.test(v)) {
    const date = new Date((parseInt(v) - 25569) * 86400 * 1000);
    return `${String(date.getUTCMonth() + 1).padStart(2,'0')}/${date.getUTCFullYear()}`;
  }
  return v;
}

function fmt(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function cor(n: number, invert = false): string {
  const positivo = invert ? n < 0 : n > 0;
  return positivo ? '#1D9E75' : '#E24B4A';
}

async function fetchSheetData() {
  const csvUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=BASE_FINANCEIRA`;
  const res = await fetch(csvUrl);
  if (!res.ok) throw new Error(`Sheets error: ${res.status}`);
  const text = await res.text();

  const rows: string[][] = [];
  let cur = '', inQ = false, row: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (inQ && text[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (c === ',' && !inQ) { row.push(cur); cur = ''; }
    else if ((c === '\n' || c === '\r') && !inQ) {
      if (c === '\r' && text[i+1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some(x => x.trim())) rows.push(row);
      row = [];
    } else cur += c;
  }
  if (cur || row.length) { row.push(cur); if (row.some(x => x.trim())) rows.push(row); }

  const ADM = ['ADM/TO', 'ADM/GO', 'ADM/PR', 'ADM/ES'];
  return rows.slice(1)
    .map(cols => ({
      data: parseDate(cols[0] || ''),
      regional: (cols[1] || '').trim().toUpperCase(),
      unidade: (cols[2] || '').trim(),
      receitaBruta: parseBrazilianNumber(cols[3] || ''),
      receitaLiquida: parseBrazilianNumber(cols[5] || ''),
      maoDeObra: parseBrazilianNumber(cols[6] || ''),
      cmv: parseBrazilianNumber(cols[8] || ''),
      despesaTotal: parseBrazilianNumber(cols[9] || ''),
      meta: parseBrazilianNumber(cols[10] || ''),
    }))
    .filter(r => r.regional && !ADM.includes(r.unidade));
}

function calcRegional(records: any[]) {
  const receita = records.reduce((s, r) => s + r.receitaBruta, 0);
  const rl = records.reduce((s, r) => s + r.receitaLiquida, 0);
  const cmv = records.reduce((s, r) => s + r.cmv, 0);
  const mdo = records.reduce((s, r) => s + r.maoDeObra, 0);
  const despesa = records.reduce((s, r) => s + r.despesaTotal, 0);
  const margem = receita > 0 ? ((receita - despesa) / receita) * 100 : 0;
  const cmvPct = rl > 0 ? (cmv / rl) * 100 : 0;
  const mdoPct = rl > 0 ? (mdo / rl) * 100 : 0;
  const meta = records.length > 0 ? records.reduce((s, r) => s + r.meta, 0) / records.length : 0;
  return { receita, margem, cmvPct, mdoPct, meta };
}

function buildEmailHtml(regional: string, nome: string, mes: string, curr: any, prev: any | null, unidades: any[]) {
  const deltaReceita = prev && prev.receita > 0 ? ((curr.receita - prev.receita) / prev.receita) * 100 : null;
  const deltaMargem = prev ? curr.margem - prev.margem : null;
  const deltaCmv = prev ? curr.cmvPct - prev.cmvPct : null;

  const badge = (v: number | null, invert = false) => v === null ? '' :
    `<span style="color:${cor(v, invert)};font-weight:600;">${v > 0 ? '+' : ''}${v.toFixed(1)}${invert ? 'pp' : '%'}</span>`;

  const unidadeRows = unidades.slice(0, 10).map(u => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;">${u.unidade}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${fmt(u.receita)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${fmtPct(u.margem)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${fmtPct(u.cmvPct)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px;">
  <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
    <div style="background:#1D9E75;color:#fff;padding:24px;">
      <h1 style="margin:0;font-size:22px;">Mais Sabor · Relatório Semanal</h1>
      <div style="font-size:14px;opacity:0.9;margin-top:4px;">Regional ${regional}</div>
      <div style="font-size:13px;opacity:0.85;margin-top:8px;">Olá, ${nome}! Aqui está o resumo de ${mes}</div>
    </div>

    <div style="padding:24px;">
      <div style="margin-bottom:16px;">
        <div style="font-size:12px;color:#666;text-transform:uppercase;">Receita Total</div>
        <div style="font-size:24px;font-weight:700;color:#1D9E75;">${fmt(curr.receita)}</div>
        <div>${badge(deltaReceita)}</div>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
        <tr>
          <td style="padding:12px;background:#f9f9f9;border-radius:6px;width:33%;">
            <div style="font-size:11px;color:#666;text-transform:uppercase;">Margem</div>
            <div style="font-size:18px;font-weight:700;">${fmtPct(curr.margem)}</div>
            <div>${badge(deltaMargem, true)}</div>
            ${curr.meta > 0 ? `<div style="font-size:11px;color:#888;">Meta: ${fmtPct(curr.meta)}</div>` : ''}
          </td>
          <td style="width:8px;"></td>
          <td style="padding:12px;background:#f9f9f9;border-radius:6px;width:33%;">
            <div style="font-size:11px;color:#666;text-transform:uppercase;">CMV</div>
            <div style="font-size:18px;font-weight:700;">${fmtPct(curr.cmvPct)}</div>
            <div>${badge(deltaCmv, true)}</div>
            <div style="font-size:11px;color:#888;">Ideal ≤ 40%</div>
          </td>
          <td style="width:8px;"></td>
          <td style="padding:12px;background:#f9f9f9;border-radius:6px;width:33%;">
            <div style="font-size:11px;color:#666;text-transform:uppercase;">Mão de Obra</div>
            <div style="font-size:18px;font-weight:700;">${fmtPct(curr.mdoPct)}</div>
            <div style="font-size:11px;color:#888;">Ideal ≤ 30%</div>
          </td>
        </tr>
      </table>

      <h2 style="font-size:16px;margin:24px 0 12px;">Desempenho por Unidade</h2>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f0f0f0;">
            <th style="padding:8px;text-align:left;">Unidade</th>
            <th style="padding:8px;text-align:right;">Receita</th>
            <th style="padding:8px;text-align:right;">Margem</th>
            <th style="padding:8px;text-align:right;">CMV</th>
          </tr>
        </thead>
        <tbody>${unidadeRows}</tbody>
      </table>
    </div>

    <div style="padding:16px 24px;background:#fafafa;font-size:11px;color:#888;text-align:center;">
      Mais Sabor · Plataforma de Gestão Financeira<br/>
      Este e-mail é enviado automaticamente toda segunda-feira às 8h
    </div>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: managers, error: mgErr } = await supabase
      .from('regional_managers')
      .select('*')
      .eq('ativo', true);

    if (mgErr) throw new Error(`Managers error: ${mgErr.message}`);
    if (!managers || managers.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhum gerente ativo.' }), { status: 200 });
    }

    const records = await fetchSheetData();
    const months = [...new Set(records.map(r => r.data))].filter(Boolean).sort();
    const lastMonth = months[months.length - 1];
    const prevMonth = months.length >= 2 ? months[months.length - 2] : null;

    const results: any[] = [];

    for (const manager of managers) {
      const regional = (manager.regional as string).toUpperCase();

      const currRecs = records.filter(r => r.regional === regional && r.data === lastMonth);
      const prevRecs = prevMonth ? records.filter(r => r.regional === regional && r.data === prevMonth) : [];

      if (currRecs.length === 0) {
        results.push({ regional, status: 'sem dados', email: manager.email });
        continue;
      }

      const curr = calcRegional(currRecs);
      const prev = prevRecs.length > 0 ? calcRegional(prevRecs) : null;

      const byUnidade: Record<string, any[]> = {};
      for (const r of currRecs) {
        if (!byUnidade[r.unidade]) byUnidade[r.unidade] = [];
        byUnidade[r.unidade].push(r);
      }
      const unidades = Object.entries(byUnidade).map(([unidade, recs]) => {
        const m = calcRegional(recs as any[]);
        return { unidade, ...m };
      }).sort((a, b) => b.receita - a.receita);

      const html = buildEmailHtml(regional, manager.nome, lastMonth, curr, prev, unidades);

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `Mais Sabor <${FROM_EMAIL}>`,
          to: [manager.email],
          subject: `📊 Relatório Semanal — Regional ${regional} · ${lastMonth}`,
          html,
        }),
      });

      const emailData = await emailRes.json();
      results.push({
        regional,
        email: manager.email,
        status: emailRes.ok ? 'enviado' : 'erro',
        resend: emailData,
      });
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('send-weekly-report error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
  }
});
