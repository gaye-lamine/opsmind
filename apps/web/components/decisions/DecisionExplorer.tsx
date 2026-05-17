"use client";

import { useState, useCallback } from "react";
import { SearchBar } from "./SearchBar";
import { DecisionTable } from "./DecisionTable";
import { decisionsApi, type DecisionListData } from "@/services/api-client/decisions.api";

interface DecisionExplorerProps {
  initialData: DecisionListData;
}

export function DecisionExplorer({ initialData }: DecisionExplorerProps) {
  const [data, setData] = useState(initialData);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchResult, setIsSearchResult] = useState(false);

  const handleSearch = useCallback(async (query: string) => {
    if (!query) {
      setData(initialData);
      setIsSearchResult(false);
      return;
    }

    setIsSearching(true);
    try {
      const result = await decisionsApi.search(query);
      setData({
        decisions: result.decisions,
        pagination: {
          total: result.total,
          page: 1,
          pageSize: result.decisions.length,
          totalPages: 1
        }
      });
      setIsSearchResult(true);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  }, [initialData]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <SearchBar onSearch={handleSearch} isLoading={isSearching} />
        
        {isSearchResult && (
          <button 
            onClick={() => handleSearch("")}
            className="text-xs font-bold text-accent uppercase tracking-widest hover:text-accent-light transition-colors"
          >
            Clear Results
          </button>
        )}
      </div>

      <div className="glass-card overflow-hidden transition-all duration-500">
        <DecisionTable
          decisions={data.decisions}
          pagination={data.pagination}
          isLoading={isSearching}
        />
      </div>
      
      {isSearchResult && data.decisions.length === 0 && (
        <div className="text-center py-20 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-4">
            <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-text-primary">No decisions found</h3>
          <p className="text-sm text-text-muted mt-1">Try a different query or keywords.</p>
        </div>
      )}
    </div>
  );
}
