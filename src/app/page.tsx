import Link from "next/link";
import { ArrowRight, BedDouble, Plane, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const MODES = [
  {
    href: "/flights",
    title: "Flights",
    icon: Plane,
    accent: "text-flights bg-flights/12",
    body: "Cheapest fares in Economy, Premium Economy, Business and First, plus award seats you can book with your points.",
    points: ["Cash fares from Google Flights", "Award seats by program", "Cheap destinations from your airport"],
  },
  {
    href: "/hotels",
    title: "Hotels",
    icon: BedDouble,
    accent: "text-hotels bg-hotels/15",
    body: "Hotels for your dates with prices from every booking site, Google and Tripadvisor reviews, and travel times to your places.",
    points: ["Prices by booking site", "Google + Tripadvisor reviews", "Directions and forum chatter"],
  },
  {
    href: "/ai",
    title: "AI Planner",
    icon: Sparkles,
    accent: "text-ai bg-ai/12",
    body: "Describe your stay in plain words. The planner searches, reads the reviews and ranks the best options for you.",
    points: ["“30 nights in Lisbon near my office”", "Ranked shortlist with reasons", "Quotes from real reviews"],
  },
];

export default function Home() {
  return (
    <div className="flex flex-col gap-8">
      <section className="pt-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Plan your trip</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Choose a mode. Every search shows its SerpApi credit cost before it runs, and repeat searches within the hour are free.
        </p>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {MODES.map(({ href, title, icon: Icon, accent, body, points }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className={cn("flex size-11 items-center justify-center rounded-xl", accent)}>
              <Icon className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
            <ul className="flex flex-col gap-1.5 text-sm">
              {points.map((p) => (
                <li key={p} className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-muted-foreground/50" />
                  {p}
                </li>
              ))}
            </ul>
            <span className="mt-auto flex items-center gap-1 text-sm font-medium text-primary">
              Open {title}
              <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
