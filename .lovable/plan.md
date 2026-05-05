## Objetivo
Melhorar o gráfico "Distribuição de Custos" no Dashboard Regional (`src/pages/RegionalDashboard.tsx`).

## Mudanças

1. **Remover os rótulos de valor** (caixas brancas com valores) que aparecem ao redor das fatias do gráfico de pizza.
2. **Remover o tooltip** que aparece ao passar o mouse sobre as fatias.
3. **Criar cards laterais** com os valores de cada categoria (Mão de Obra, Impostos, Matéria Prima), exibidos ao lado do gráfico:
   - Cada card mostra: nome da categoria, valor formatado em R$, percentual do total, e um indicador colorido (bolinha) com a cor correspondente da fatia.
   - Visual alinhado ao design system (`glass-card`, tokens semânticos, tipografia consistente com os demais KPIs).

## Layout proposto

```text
┌─────────────────────────────────────────────┐
│ Distribuição de Custos                      │
│  ┌──────────────┐  ┌─────────────────────┐  │
│  │              │  │ ● Mão de Obra       │  │
│  │   [donut]    │  │   R$ 000.000  (45%) │  │
│  │              │  │ ● Impostos          │  │
│  │              │  │   R$ 000.000  (30%) │  │
│  │              │  │ ● Matéria Prima     │  │
│  │              │  │   R$ 000.000  (25%) │  │
│  └──────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────┘
```

## Detalhes técnicos
- No `<Pie>`: remover prop `label` e `labelLine`.
- Remover `<Tooltip>` do `PieChart`.
- Manter a `<Legend>` (ou substituir pelos cards e remover legenda — sugerido remover, já que os cards funcionam como legenda + valor).
- Adicionar grid interno de 2 colunas dentro do card do gráfico: `grid-cols-2` (chart + lista de cards).
- Calcular percentual: `value / total * 100`.
- Cores dos indicadores: reutilizar `PIE_COLORS` já existentes.

Sem alterações em outros arquivos.