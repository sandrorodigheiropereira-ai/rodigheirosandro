import { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface MultiSelectUnidadeProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function MultiSelectUnidade({ options, selected, onChange }: MultiSelectUnidadeProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const isAll = selected.length === 0;

  const toggle = (value: string) => {
    if (value === 'all') {
      onChange([]);
      return;
    }
    const next = selected.includes(value)
      ? selected.filter(v => v !== value)
      : [...selected, value];
    onChange(next);
  };

  const label = isAll
    ? 'Todas'
    : selected.length === 1
      ? selected[0]
      : `${selected.length} selecionadas`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-[200px] h-9 px-3 py-2 text-sm rounded-md border border-border bg-secondary text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-[220px] rounded-md border border-border bg-popover p-1 shadow-md max-h-60 overflow-auto">
          <div
            className={cn(
              'flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm cursor-pointer hover:bg-accent',
              isAll && 'font-semibold'
            )}
            onClick={() => toggle('all')}
          >
            <div className={cn('h-4 w-4 rounded-sm border border-primary flex items-center justify-center', isAll && 'bg-primary')}>
              {isAll && <Check className="h-3 w-3 text-primary-foreground" />}
            </div>
            Todas
          </div>
          {options.map(opt => {
            const checked = selected.includes(opt);
            return (
              <div
                key={opt}
                className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm cursor-pointer hover:bg-accent"
                onClick={() => toggle(opt)}
              >
                <div className={cn('h-4 w-4 rounded-sm border border-primary flex items-center justify-center', checked && 'bg-primary')}>
                  {checked && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                {opt}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
