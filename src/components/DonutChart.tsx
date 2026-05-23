import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatCurrency, formatPercent } from '@/lib/calculations';

interface DonutItem {
  name: string;
  value: number;
  prevValue?: number;
  color: string;
}

interface DonutChartProps {
  title: string;
  items: DonutItem[];
  totalLabel?: string;
  comparisonLabel?: string;
  height?: number;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const total = payload[0].payload._total ?? 1;
  return (
    <div className="bg-background border border-border rounded-lg p-3 shadow-lg text-xs space-y-1">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
        <span className="font-semibold">{d.name}</span>
      </div>
      <p className="text-muted-foreground">{formatCurrency(d.value)}</p>
      <p className="text-muted-foreground">{((d.value / total) * 100).toFixed(1)}% do total</p>
    </div>
  );
};

export function DonutChart({ title, items, totalLabel, comparisonLabel, height = 200 }: DonutChartProps) {
  const total = items.reduce((s, d) => s + d.value, 0);
  const itemsWithTotal = items.map(d => ({ ...d, _total: total }));

  if (total <= 0) {
    return (
      <div className="glass-card rounded-xl p-5">
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">{title}</h3>
        <p className="text-xs text-muted-foreground text-center py-8">Sem dados para o filtro atual.</p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-5">
      <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">

        {/* Rosca */}
        <div className="relative">
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={itemsWithTotal}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={50}
                paddingAngle={3}
                isAnimationActive={false}
              >
                {itemsWithTotal.map((d, i) => (
                  <Cell key={i} fill={d.color} stroke="transparent" strokeWidth={0} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Centro da rosca */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-[10px] text-muted-foreground">Total</p>
            <p className="text-sm font-display font-bold">{formatCurrency(total)}</p>
          </div>
        </div>

        {/* Legenda detalhada */}
        <div className="space-y-2">
          {items.map((d, i) => {
            const pct = total > 0 ? (d.value / total) * 100 : 0;
            const variacao = d.prevValue && d.prevValue > 0
              ? ((d.value - d.prevValue) / d.prevValue) * 100
              : null;
            const isUp = variacao !== null && variacao > 0;
            const isDown = variacao !== null && variacao < 0;
            const trendColor = isUp ? 'text-danger' : isDown ? 'text-success' : 'text-muted-foreground';
            const TrendIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;

            return (
              <div key={d.name} className="rounded-lg border border-border bg-secondary/40 p-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-[11px] font-medium">{d.name}</span>
                  </div>
                  <span className="text-[11px] font-semibold" style={{ color: d.color }}>
                    {pct.toFixed(1)}%
                  </span>
                </div>

                {/* Barra de progresso */}
                <div className="w-full h-1 rounded-full bg-secondary mb-1.5">
                  <div
                    className="h-1 rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: d.color }}
                  />
                </div>

                <div className="flex items-end justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-[11px] font-display font-bold truncate">{formatCurrency(d.value)}</p>
                    {d.prevValue !== undefined && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        Ant: {formatCurrency(d.prevValue)}
                      </p>
                    )}
                  </div>
                  {variacao !== null && (
                    <div className={`flex items-center gap-1 text-[10px] font-bold shrink-0 ${trendColor}`}>
                      <TrendIcon className="w-3 h-3" />
                      <span>{variacao > 0 ? '+' : ''}{variacao.toFixed(1)}%</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Total */}
          <div className="flex items-center justify-between rounded-lg border border-border/60 px-2.5 py-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {totalLabel ?? 'Total'}
            </span>
            <span className="text-[11px] font-display font-bold">{formatCurrency(total)}</span>
          </div>

          {comparisonLabel && (
            <p className="text-[10px] text-muted-foreground text-right">{comparisonLabel}</p>
          )}
        </div>
      </div>
    </div>
  );
}
