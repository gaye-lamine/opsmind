import Link from "next/link";
import type { DecisionSummary } from "@opsmind/shared";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatRelativeTime } from "@/lib/utils";

interface SimilarIncidentsProps {
  decisions: DecisionSummary[];
}

export function SimilarIncidents({ decisions }: SimilarIncidentsProps) {
  if (!decisions || decisions.length === 0) return null;

  return (
    <div className="max-w-5xl mx-auto mt-8 space-y-4">
      <div className="flex items-center gap-2 mb-4 px-1">
        <h2 className="text-xs font-black text-text-muted uppercase tracking-[0.2em]">Similar Past Incidents</h2>
        <div className="flex-1 h-px bg-gradient-to-r from-accent/20 to-transparent" />
        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider font-mono">
          Retrieved via Atlas Vector Search
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {decisions.map((d) => (
          <Link key={d.id} href={`/decisions/${d.id}`} className="block">
            <Card variant="glass" hover className="h-full flex flex-col justify-between p-4 group">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <Badge variant="muted" className="px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider">
                    {d.category.replace(/_/g, " ")}
                  </Badge>
                  {d.searchScore !== undefined && (
                    <span className="text-[9px] font-mono text-indigo-400 font-bold">
                      {Math.round(d.searchScore * 100)}% Match
                    </span>
                  )}
                </div>
                <h4 className="text-xs font-bold text-text-primary group-hover:text-accent transition-colors line-clamp-2 mb-1.5">
                  {d.goal}
                </h4>
                <p className="text-[11px] text-text-secondary line-clamp-3">
                  {d.summary}
                </p>
              </div>
              
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/[0.04] text-[9px] text-text-disabled">
                <span className="font-mono">{formatRelativeTime(d.createdAt)}</span>
                <span className="flex items-center gap-1">
                  View Case
                  <svg className="w-2.5 h-2.5 transform group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
