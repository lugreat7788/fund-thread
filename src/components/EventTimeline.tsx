import type { TradeEvent } from '@/types/trade';
import { EVENT_TYPE_LABELS, IMPACT_LABELS } from '@/types/trade';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const impactColorClass = (impact: number) => {
  if (impact === 2) return 'bg-profit border-profit';
  if (impact === 1) return 'bg-profit/50 border-profit/50';
  if (impact === 0) return 'bg-neutral border-neutral';
  if (impact === -1) return 'bg-loss/50 border-loss/50';
  return 'bg-loss border-loss';
};

export function EventTimeline({ events, onDelete }: { events: TradeEvent[]; onDelete: (id: string) => void }) {
  if (events.length === 0) return null;
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="mt-3 pl-3 border-l-2 border-border space-y-3">
      {sorted.map(event => (
        <div key={event.id} className="relative pl-4">
          <div className={`absolute -left-[calc(0.75rem+1px)] top-1.5 w-3 h-3 rounded-full border-2 ${impactColorClass(event.impact)}`} />
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{event.date}</span>
                <span className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">{EVENT_TYPE_LABELS[event.type]}</span>
                <span className={event.impact >= 1 ? 'text-profit' : event.impact <= -1 ? 'text-loss' : 'text-neutral'}>
                  {IMPACT_LABELS[event.impact as keyof typeof IMPACT_LABELS]}
                </span>
              </div>
              <div className="text-sm font-medium mt-0.5">{event.title}</div>
              {event.description && <div className="text-xs text-muted-foreground mt-0.5">{event.description}</div>}
              {event.action && <div className="text-xs mt-0.5"><span className="text-primary">动作：</span>{event.action}</div>}
            </div>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-loss" onClick={() => onDelete(event.id)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
