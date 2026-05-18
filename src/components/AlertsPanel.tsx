import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { Alert as AlertType } from '@/types/financial';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

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

const badgeColors = {
  danger: 'bg-danger/10 text-danger',
  warning: 'bg-warning/10 text-warning',
  info: 'bg-info/10 text-info',
};

const badgeLabels = {
  danger: 'Crítico',
  warning: 'Atenção',
  info: 'Info',
};

const INITIAL_VISIBLE = 5;

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (alerts.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Alertas</h3>
        <div className="flex items-center gap-3 p-4 rounded-lg border border-success/30 bg-success/5">
          <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
          <p className="text-xs text-muted-foreground">Nenhum alerta ativo no período selecionado.</p>
        </div>
      </div>
    );
  }

  const dangerCount = alerts.filter(a => a.type === 'danger').length;
  const warningCount = alerts.filter(a => a.type === 'warning').length;
  const infoCount = alerts.filter(a => a.type === 'info').length;

  const visible = expanded ? alerts : alerts.slice(0, INITIAL_VISIBLE);
  const hasMore = alerts.length > INITIAL_VISIBLE;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Alertas</h3>
        <div className="flex items-center gap-1.5 flex-wrap">
          {dangerCount > 0 && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeColors.danger}`}>
              {dangerCount} crítico{dangerCount > 1 ? 's' : ''}
            </span>
          )}
          {warningCount > 0 && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeColors.warning}`}>
              {warningCount} atenção
            </span>
          )}
          {infoCount > 0 && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeColors.info}`}>
              {infoCount} info
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {visible.map((alert, i) => {
            const Icon = icons[alert.type];
            return (
              <motion.div
                key={`${alert.unidade}-${alert.message}-${i}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ delay: i * 0.03 }}
                className={`flex items-start gap-3 p-3 rounded-lg border ${colors[alert.type]}`}
              >
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconColors[alert.type]}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{alert.unidade}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${badgeColors[alert.type]}`}>
                      {badgeLabels[alert.type]}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{alert.message}</p>
                  {alert.regional && (
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">{alert.regional}</p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3 h-3" />
              Mostrar menos
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              Ver mais {alerts.length - INITIAL_VISIBLE} alerta{alerts.length - INITIAL_VISIBLE > 1 ? 's' : ''}
            </>
          )}
        </button>
      )}
    </div>
  );
}
