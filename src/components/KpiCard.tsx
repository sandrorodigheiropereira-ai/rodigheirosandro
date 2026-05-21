import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatCurrency, formatPercent } from '@/lib/calculations';

interface SparklineProps {
  data: number[];
  color: string;
}

function Sparkline({ data, color }: SparklineProps) {
  if (!data || data.length < 2) return null;

  const width = 80;
  const height = 28;
  const pad = 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return `${x},${y}`;
  });

  const polyline = points.join(' ');
  const lastPoint = points[points.length - 1].split(',');
  const lastX = parseFloat(lastPoint[0]);
  const lastY = parseFloat(lastPoint[1]);

  // Fill area under curve
  const fillPoints = `${pad},${height - pad} ${polyline} ${width - pad},${height - pad}`;

  return (
    <svg width={width} height={height} className="block">
      <defs>
        <linearGradient id="sparklineFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill="url(#sparklineFill)" />
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r={2.5} fill={color} />
    </svg>
  );
}

interface KpiCardProps {
  title: string;
  value: number;
  format: 'currency' | 'percent' | 'number';
  change?: number;
  subtitle?: string;
  icon?: React.ReactNode;
  delay?: number;
  sparkline?: number[];
  invertTrend?: boolean; // true para métricas onde queda é positiva (ex: CMV, despesa)
}

export function KpiCard({
  title,
  value,
  format,
  change,
  subtitle,
  icon,
  delay = 0,
  sparkline,
  invertTrend = false,
}: KpiCardProps) {
  const formatted =
    format === 'currency'
      ? formatCurrency(value)
      : format === 'percent'
      ? formatPercent(value)
      : value.toLocaleString('pt-BR');

  // Para métricas invertidas (CMV, despesa), queda é boa → verde
  const effectiveChange = invertTrend && change !== undefined ? -change : change;

  const isPositive = effectiveChange !== undefined && effectiveChange > 0;
  const isNegative = effectiveChange !== undefined && effectiveChange < 0;

  const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
  const trendColor = isPositive
    ? 'text-success'
    : isNegative
    ? 'text-danger'
    : 'text-muted-foreground';

  // Cor da sparkline baseada na tendência
  const sparkColor = isPositive
    ? '#1D9E75'   // success
    : isNegative
    ? '#E24B4A'   // danger
    : '#6B7280';  // neutro

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="glass-card rounded-xl p-5 hover:border-primary/30 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        {icon && <span className="text-primary opacity-70">{icon}</span>}
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xl font-display font-bold tracking-tight truncate">
            {formatted}
          </div>
          {subtitle && (
            <div className="text-[10px] text-muted-foreground mt-1">{subtitle}</div>
          )}
          {change !== undefined && (
            <div className={`flex items-center gap-1 mt-2 text-[10px] font-medium ${trendColor}`}>
              <TrendIcon className="w-3 h-3" />
              <span>
                {change > 0 ? '+' : ''}
                {change.toFixed(1)}% vs mês anterior
              </span>
            </div>
          )}
        </div>

        {sparkline && sparkline.length >= 2 && (
          <div className="shrink-0">
            <Sparkline data={sparkline} color={sparkColor} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
