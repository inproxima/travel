import { Plane } from "lucide-react";
import { FlightsView } from "@/components/flights/flights-view";
import { PageHeader } from "@/components/shell/page-header";

export const metadata = { title: "Flights · Waypoint" };

export default function FlightsPage() {
  return (
    <>
      <PageHeader icon={<Plane />} accent="flights" title="Flights" description="The cheapest fares in Economy, Premium Economy, Business and First, plus award seats and deals." />
      <FlightsView />
    </>
  );
}
