import { Plane } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/misc";

export default function FlightsPage() {
  return (
    <>
      <PageHeader icon={<Plane />} accent="flights" title="Flights" description="Cash fares in every cabin, award seats, and deals." />
      <EmptyState title="Flights is being built" />
    </>
  );
}
