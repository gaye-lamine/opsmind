import { notFound } from "next/navigation";
import { decisionsApi } from "@/services/api-client/decisions.api";
import { DecisionDetail } from "@/components/decisions/DecisionDetail";

interface DecisionPageProps {
  params: Promise<{ id: string }>;
}

export default async function DecisionPage({ params }: DecisionPageProps) {
  const { id } = await params;

  let data = null;
  try {
    data = await decisionsApi.getById(id);
  } catch {
    notFound();
  }

  if (!data) notFound();

  return (
    <div className="p-6 animate-fade-in">
      <DecisionDetail decision={data.decision} />
    </div>
  );
}
