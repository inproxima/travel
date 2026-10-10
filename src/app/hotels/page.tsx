import { BedDouble } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/misc";

export default function HotelsPage() {
  return (
    <>
      <PageHeader icon={<BedDouble />} accent="hotels" title="Hotels" description="Prices, reviews and location for your dates." />
      <EmptyState title="Hotels is being built" />
    </>
  );
}
