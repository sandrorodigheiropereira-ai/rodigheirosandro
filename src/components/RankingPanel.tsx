import { formatCurrency } from '@/lib/calculations';
import { motion } from 'framer-motion';
import { Trophy, ArrowDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface RankedItem {
  unidade: string;
  regional: string;
  value: number;
}

interface RankingPanelProps {
  data: RankedItem[];
  previousData?: RankedItem[];
  format?: 'currency' | 'percent';
  title?: string;
  subtitle?: string;
  metricLabel?: string;
}

export function RankingPanel({ data, previousData, format = 'currency', title = 'Ranking', subtitle, metricLabel }: RankingPanelProps) {
  const top3 = data.slice(0, 3);
  const bottom3 = data.slice(-3).reverse();

  const fmt = (v: number) => format === 'currency' ? formatCurrency(v) : `${v.toFixed(1)}%`;

  const prevMap = new Map((previousData || []).map(p => [p.unidade, p.value]));

  const getChange = (item: RankedItem) => {
    if (!previousData) return null;
    const prev = prevMap.get(item.unidade);
    if (prev === undefined) return { pct: null, isNew: true };
    if (format === 'percent') {
      return { pct: item.value - prev, isNew: false, absolute: true };
    }
    if (prev === 0) return { pct: item.value === 0 ? 0 : null, isNew: false };
    return { pct: ((item.value - prev) / Math.abs(prev)) * 100, isNew: false };
  };

  const ChangeBadge = ({ item }: { item: RankedItem }) => {
    const change = getChange(item);
    if (!change) return null;
    if (change.isNew) {
      return <span className="text-[10px] font-medium text-muted-foreground px-1.5 py-0.5 rounded bg-muted/40">novo</span>;
    }
    if (change.pct === null) return null;
    const positive = change.pct > 0.05;
    const negative = change.pct < -0.05;
    const Icon = positive ? TrendingUp : negative ? TrendingDown : Minus;
    const color = positive ? 'text-success' : negative ? 'text-danger' : 'text-muted-foreground';
    const bg = positive ? 'bg-success/10' : negative ? 'bg-danger/10' : 'bg-muted/30';
    const sign = change.pct > 0 ? '+' : '';
    const suffix = (change as any).absolute ? 'pp' : '%';
    return (
      <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded ${color} ${bg}`}>
        <Icon className="w-2.5 h-2.5" />
        {sign}{change.pct.toFixed(1)}{suffix}
      </span>
    );
  };

  return (
    <div className="glass-card rounded-xl p-5 space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>
        {(metricLabel || subtitle) && (
          <p className="text-[11px] text-muted-foreground">
            {metricLabel}{metricLabel && subtitle ? ' · ' : ''}{subtitle}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="w-4 h-4 text-success" />
          <span className="text-xs font-medium text-success">Top 3{metricLabel ? ` · ${metricLabel}` : ''}</span>
        </div>
        {top3.map((item, i) => (
          <motion.div
            key={item.unidade}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="flex items-center justify-between py-2 px-3 rounded-lg bg-success/5 border border-success/10"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-bold text-success w-5">{i + 1}º</span>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{item.unidade}</p>
                <p className="text-xs text-muted-foreground truncate">{item.regional}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <ChangeBadge item={item} />
              <span className="text-sm font-semibold">{fmt(item.value)}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-2">
          <ArrowDown className="w-4 h-4 text-danger" />
          <span className="text-xs font-medium text-danger">Bottom 3</span>
        </div>
        {bottom3.map((item, i) => (
          <motion.div
            key={item.unidade}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: (i + 3) * 0.08 }}
            className="flex items-center justify-between py-2 px-3 rounded-lg bg-danger/5 border border-danger/10"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-bold text-danger w-5">{data.length - 2 + i}º</span>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{item.unidade}</p>
                <p className="text-xs text-muted-foreground truncate">{item.regional}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <ChangeBadge item={item} />
              <span className="text-sm font-semibold">{fmt(item.value)}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
