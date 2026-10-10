import { BedDouble } from "lucide-react";
import { HotelsView } from "@/components/hotels/hotels-view";
import { PageHeader } from "@/components/shell/page-header";

export const metadata = { title: "Hotels · Waypoint" };

export default function HotelsPage() {
  return (
    <>
      <PageHeader icon={<BedDouble />} accent="hotels" title="Hotels" description="Prices from every booking site, reviews, and location for your dates." />
      <HotelsView />
    </>
  );
}
