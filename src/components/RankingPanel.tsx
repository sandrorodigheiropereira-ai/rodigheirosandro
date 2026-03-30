import { formatCurrency } from '@/lib/calculations';
import { motion } from 'framer-motion';
import { Trophy, ArrowDown } from 'lucide-react';

interface RankedItem {
  unidade: string;
  regional: string;
  value: number;
}

interface RankingPanelProps {
  data: RankedItem[];
  format?: 'currency' | 'percent';
  title?: string;
}

export function RankingPanel({ data, format = 'currency', title = 'Ranking' }: RankingPanelProps) {
  const top3 = data.slice(0, 3);
  const bottom3 = data.slice(-3).reverse();

  const fmt = (v: number) => format === 'currency' ? formatCurrency(v) : `${v.toFixed(1)}%`;

  return (
    <div className="glass-card rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>
      
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="w-4 h-4 text-success" />
          <span className="text-xs font-medium text-success">Top 3</span>
        </div>
        {top3.map((item, i) => (
          <motion.div
            key={item.unidade}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="flex items-center justify-between py-2 px-3 rounded-lg bg-success/5 border border-success/10"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-success w-5">{i + 1}º</span>
              <div>
                <p className="text-sm font-medium">{item.unidade}</p>
                <p className="text-xs text-muted-foreground">{item.regional}</p>
              </div>
            </div>
            <span className="text-sm font-semibold">{fmt(item.value)}</span>
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
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-danger w-5">{data.length - 2 + i}º</span>
              <div>
                <p className="text-sm font-medium">{item.unidade}</p>
                <p className="text-xs text-muted-foreground">{item.regional}</p>
              </div>
            </div>
            <span className="text-sm font-semibold">{fmt(item.value)}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
