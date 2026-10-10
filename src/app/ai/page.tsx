import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/misc";

export default function AiPage() {
  return (
    <>
      <PageHeader icon={<Sparkles />} accent="ai" title="AI Planner" description="Describe your stay; get a ranked shortlist." />
      <EmptyState title="AI Planner is being built" />
    </>
  );
}
