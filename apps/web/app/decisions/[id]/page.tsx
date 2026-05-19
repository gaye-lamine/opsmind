import { notFound } from "next/navigation";
import { decisionsApi } from "@/services/api-client/decisions.api";
import { DecisionDetail } from "@/components/decisions/DecisionDetail";
import { PlaybookConsole } from "@/components/decisions/PlaybookConsole";
import { SimilarIncidents } from "@/components/decisions/SimilarIncidents";
import type { DecisionSummary } from "@opsmind/shared";

interface DecisionPageProps {
  params: Promise<{ id: string }>;
}

export default async function DecisionPage({ params }: DecisionPageProps) {
  const { id } = await params;

  let data = null;
  let similarData: { decisions: DecisionSummary[] } = { decisions: [] };
  
  try {
    const [decisionRes, similarRes] = await Promise.all([
      decisionsApi.getById(id),
      decisionsApi.getSimilar(id, 3).catch(() => ({ decisions: [] })),
    ]);
    data = decisionRes;
    similarData = similarRes;
  } catch {
    notFound();
  }

  if (!data) notFound();

  return (
    <div className="p-6 animate-fade-in space-y-8">
      <DecisionDetail decision={data.decision} />
      <PlaybookConsole decisionId={id} />
      <SimilarIncidents decisions={similarData.decisions} />
    </div>
  );
}
