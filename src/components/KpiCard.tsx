import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatCurrency, formatPercent } from '@/lib/calculations';

interface KpiCardProps {
  title: string;
  value: number;
  format: 'currency' | 'percent' | 'number';
  change?: number;
  subtitle?: string;
  icon?: React.ReactNode;
  delay?: number;
}

export function KpiCard({ title, value, format, change, subtitle, icon, delay = 0 }: KpiCardProps) {
  const formatted = format === 'currency' ? formatCurrency(value)
    : format === 'percent' ? formatPercent(value)
    : value.toLocaleString('pt-BR');

  const TrendIcon = change && change > 0 ? TrendingUp : change && change < 0 ? TrendingDown : Minus;
  const trendColor = change && change > 0 ? 'text-success' : change && change < 0 ? 'text-danger' : 'text-muted-foreground';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="glass-card rounded-xl p-5 hover:border-primary/30 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        {icon && <span className="text-primary opacity-70">{icon}</span>}
      </div>
      <div className="text-2xl font-display font-bold tracking-tight">{formatted}</div>
      {change !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trendColor}`}>
          <TrendIcon className="w-3 h-3" />
          <span>{change > 0 ? '+' : ''}{change.toFixed(1)}% vs mês anterior</span>
        </div>
      )}
    </motion.div>
  );
}
