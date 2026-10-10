import { Sparkles } from "lucide-react";
import { AiView } from "@/components/ai/ai-view";
import { PageHeader } from "@/components/shell/page-header";

export const metadata = { title: "AI Planner · Waypoint" };

export default function AiPage() {
  return (
    <>
      <PageHeader icon={<Sparkles />} accent="ai" title="AI Planner" description="Describe your stay. I search, read the reviews and rank the best options." />
      <AiView />
    </>
  );
}
