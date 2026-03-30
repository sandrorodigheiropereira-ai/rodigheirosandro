import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { Alert as AlertType } from '@/types/financial';
import { motion } from 'framer-motion';

interface AlertsPanelProps {
  alerts: AlertType[];
}

const icons = {
  danger: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const colors = {
  danger: 'border-danger/30 bg-danger/5',
  warning: 'border-warning/30 bg-warning/5',
  info: 'border-info/30 bg-info/5',
};

const iconColors = {
  danger: 'text-danger',
  warning: 'text-warning',
  info: 'text-info',
};

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Alertas</h3>
      {alerts.slice(0, 5).map((alert, i) => {
        const Icon = icons[alert.type];
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`flex items-start gap-3 p-3 rounded-lg border ${colors[alert.type]}`}
          >
            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconColors[alert.type]}`} />
            <div className="min-w-0">
              <p className="text-sm font-medium">{alert.unidade}</p>
              <p className="text-xs text-muted-foreground">{alert.message}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
