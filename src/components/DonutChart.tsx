import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';
import { motion } from 'framer-motion';

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

export function DonutChart({ title, items, totalLabel, comparisonLabel, height = 200 }: DonutChartProps) {
  const total = items.reduce((s, d) => s + d.value, 0);

  if (total <= 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-xl p-5"
      >
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {title}
        </h3>
        <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
          Sem dados para o filtro atual.
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-xl p-5"
    >
      <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">
        {title}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center max-w-lg mx-auto">
        {/* Rosca */}
        <div className="relative">
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={items}
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
                isAnimationActive={false}
                stroke="none"
              >
                {items.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Centro da rosca */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] text-muted-foreground font-medium">
              {totalLabel ?? 'Total'}
            </span>
            <span className="text-sm font-display font-bold text-foreground">
              {formatCurrency(total)}
            </span>
          </div>
        </div>

        {/* Legenda detalhada */}
        <div className="space-y-2.5">
          {items.map((d, i) => {
            const pct = total > 0 ? (d.value / total) * 100 : 0;
            const variacao =
              d.prevValue && d.prevValue > 0
                ? ((d.value - d.prevValue) / d.prevValue) * 100
                : null;
            const isUp = variacao !== null && variacao > 0;
            const isDown = variacao !== null && variacao < 0;
            const trendColor = isUp
              ? 'text-danger'
              : isDown
                ? 'text-success'
                : 'text-muted-foreground';
            const TrendIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;

            return (
              <div
                key={d.name}
                className="rounded-lg border border-border/60 bg-secondary/40 p-2.5"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: d.color }}
                    />
                    <span className="text-[11px] font-medium text-foreground">
                      {d.name}
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {pct.toFixed(1)}%
                  </span>
                </div>

                {/* Barra de progresso */}
                <div className="w-full h-1.5 rounded-full bg-secondary mb-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: d.color,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-display font-bold text-foreground">
                      {formatCurrency(d.value)}
                    </span>
                    {d.prevValue !== undefined && (
                      <span className="text-[10px] text-muted-foreground">
                        Ant: {formatCurrency(d.prevValue)}
                      </span>
                    )}
                  </div>

                  {variacao !== null && (
                    <div className={`flex items-center gap-0.5 text-[10px] font-medium ${trendColor}`}>
                      <TrendIcon className="w-3 h-3" />
                      {variacao > 0 ? '+' : ''}
                      {variacao.toFixed(1)}%
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Total */}
          <div className="rounded-lg border border-border/60 bg-secondary/60 p-2.5 mt-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">
                {totalLabel ?? 'Total'}
              </span>
              <span className="text-sm font-display font-bold text-foreground">
                {formatCurrency(total)}
              </span>
            </div>
          </div>

          {comparisonLabel && (
            <p className="text-[10px] text-center text-muted-foreground pt-1">
              {comparisonLabel}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
