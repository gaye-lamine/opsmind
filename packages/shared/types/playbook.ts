export interface PlaybookStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  status: "pending" | "completed" | "skipped";
  autoRemediationAvailable: boolean;
  actionType?: string;
  system?: string;
  details?: Record<string, any>;
}

export interface Playbook {
  id: string; // matches decisionId
  decisionId: string;
  title: string;
  description: string;
  status: "draft" | "active" | "completed" | "failed";
  steps: PlaybookStep[];
  createdAt: string;
  updatedAt: string;
}
