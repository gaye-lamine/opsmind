"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { DecisionSummary } from "@opsmind/shared";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ConfidenceGauge } from "@/components/ui/ConfidenceGauge";
import { formatRelativeTime, cn } from "@/lib/utils";
import { decisionsApi } from "@/services/api-client/decisions.api";

interface SearchableMemoryProps {
  initialDecisions: DecisionSummary[];
}

const categoryLabel: Record<string, { label: string; variant: "success" | "warning" | "danger" | "muted" }> = {
  anomaly_resolution: { label: "Anomaly", variant: "warning" },
  strategic_recommendation: { label: "Strategy", variant: "success" },
  operational_action: { label: "Operations", variant: "muted" },
  risk_mitigation: { label: "Risk", variant: "danger" },
  performance_optimization: { label: "Performance", variant: "success" },
  monitoring_alert: { label: "Alert", variant: "warning" },
};

export function SearchableMemory({ initialDecisions }: SearchableMemoryProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DecisionSummary[]>(initialDecisions);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMethod, setSearchMethod] = useState<"hybrid" | "vector" | "text">("hybrid");
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults(initialDecisions);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await decisionsApi.search(searchQuery, 10);
      // Map returned decisions
      setResults(response.decisions || []);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (query.trim() === "") {
      setResults(initialDecisions);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceTimer.current = setTimeout(() => {
      performSearch(query);
    }, 400);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query, initialDecisions]);

  return (
    <Card padding="none" variant="glass" className="relative overflow-hidden group">
      {/* Background glow when searching */}
      {isSearching && (
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-accent via-success to-accent animate-pulse" />
      )}

      {/* Header with search inputs */}
      <div className="p-5 border-b border-white/[0.05] bg-white/[0.01]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">
              Decision Memory Timeline
            </h3>
            <p className="text-3xs text-text-muted mt-0.5 uppercase tracking-widest font-mono flex items-center gap-1">
              Powered by MongoDB Atlas Hybrid Search & Voyage AI Rerank-2
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            </p>
          </div>

          {/* Search controls */}
          <div className="flex-1 max-w-md w-full relative">
            <div className="relative">
              <input
                type="text"
                placeholder="Search memory sémantiquement ou par mots-clés..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full text-xs bg-surface-3 border border-white/[0.08] focus:border-accent/40 rounded-lg py-2 pl-8 pr-10 text-text-primary placeholder:text-text-disabled outline-none transition-all duration-300 shadow-inner"
              />
              <div className="absolute left-2.5 top-2.5 text-text-disabled">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-2.5 text-text-disabled hover:text-text-primary transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Results timeline */}
      <div className="divide-y divide-white/[0.04]">
        {results.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-text-secondary">Aucun résultat trouvé pour "{query}"</p>
            <p className="text-3xs text-text-disabled mt-1 uppercase tracking-widest">
              Essayez des termes différents comme "anomaly", "memory" ou "gitlab"
            </p>
          </div>
        ) : (
          results.map((d, i) => {
            const config = categoryLabel[d.category] || { label: d.category, variant: "muted" };
            
            // Format search type badge
            let searchBadge = null;
            if (d.searchType) {
              if (d.searchType === "vector") {
                searchBadge = (
                  <Badge className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5">
                    Vector Match
                  </Badge>
                );
              } else if (d.searchType === "text") {
                searchBadge = (
                  <Badge className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5">
                    Keyword Match
                  </Badge>
                );
              } else if (d.searchType === "hybrid") {
                searchBadge = (
                  <Badge className="bg-purple-500/10 border border-purple-500/30 text-purple-400 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5">
                    Hybrid Match
                  </Badge>
                );
              }
            }

            return (
              <Link key={d.id} href={`/decisions/${d.id}`}>
                <div className="flex items-stretch hover:bg-white/[0.02] transition-colors cursor-pointer group/item">
                  {/* Left colored border indicating confidence */}
                  <div className={cn(
                    "w-1 transition-all duration-300 group-hover/item:w-1.5",
                    d.confidenceScore >= 0.8 ? "bg-success" : d.confidenceScore >= 0.6 ? "bg-warning" : "bg-danger"
                  )} />

                  <div className="flex-1 p-4 flex items-start gap-4">
                    {/* Confidence gauge */}
                    <div className="flex-shrink-0 pt-0.5">
                      <ConfidenceGauge value={d.confidenceScore} size="sm" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Badge variant={config.variant} className="px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider">
                          {config.label}
                        </Badge>

                        {/* Search details */}
                        {searchBadge}
                        {d.rerankedByVoyage && (
                          <Badge className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                            Voyage Reranked
                          </Badge>
                        )}
                        {d.searchScore !== undefined && d.searchScore > 0 && (
                          <span className="text-[9px] font-mono font-semibold text-text-disabled">
                            Score: {Math.round(d.searchScore * 100)}%
                          </span>
                        )}
                      </div>

                      {/* Display Highlighted title if available, otherwise fallback to goal */}
                      {d.highlightText ? (
                        <p
                          className="text-xs font-bold text-text-primary tracking-tight truncate group-hover/item:text-accent transition-colors"
                          dangerouslySetInnerHTML={{ __html: d.highlightText }}
                        />
                      ) : (
                        <p className="text-xs font-bold text-text-primary tracking-tight truncate group-hover/item:text-accent transition-colors">
                          {d.goal}
                        </p>
                      )}

                      <p className="text-2xs text-text-secondary mt-0.5 line-clamp-1">
                        {d.summary}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0 self-center">
                      <span className="text-3xs text-text-disabled font-mono uppercase tracking-wider">
                        {formatRelativeTime(d.createdAt)}
                      </span>
                      <svg className="w-3.5 h-3.5 text-text-disabled group-hover/item:text-accent transform group-hover/item:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </Card>
  );
}
