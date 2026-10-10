"use client";

import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { money, shortDate } from "@/lib/format";
import type { PriceInsights } from "@/lib/models";

const LEVEL: Record<string, { label: string; variant: "success" | "secondary" | "destructive" }> = {
  low: { label: "Prices are low", variant: "success" },
  typical: { label: "Prices are typical", variant: "secondary" },
  high: { label: "Prices are high", variant: "destructive" },
};

/** Lowest fare over the last weeks, with Google's typical range as a band. One series, so no legend. */
export function PriceChart({ insights, currency, cabinName }: { insights: PriceInsights; currency: string; cabinName: string }) {
  const data = insights.history;
  const level = insights.level ? LEVEL[insights.level.toLowerCase()] : undefined;
  const last = data[data.length - 1];

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{cabinName} price history</p>
          <p className="text-xs text-muted-foreground">
            Lowest fare by day{insights.typicalLow != null && insights.typicalHigh != null && <> · shaded band is the usual {money(insights.typicalLow, currency)}–{money(insights.typicalHigh, currency)}</>}
          </p>
        </div>
        {level && <Badge variant={level.variant}>{level.label}</Badge>}
      </figcaption>
      {data.length > 1 ? (
        <div className="h-48" role="img" aria-label={`${cabinName} lowest fare over ${data.length} days, now ${money(last?.price, currency)}`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 12, right: 64, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
              {insights.typicalLow != null && insights.typicalHigh != null && (
                <ReferenceArea y1={insights.typicalLow} y2={insights.typicalHigh} fill="var(--muted-foreground)" fillOpacity={0.08} stroke="none" ifOverflow="extendDomain" />
              )}
              <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} minTickGap={36} />
              <YAxis
                width={56}
                tickFormatter={(v: number) => money(v, currency)}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                domain={["auto", "auto"]}
                tickCount={4}
              />
              <Tooltip
                cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
                content={({ active, payload }) => {
                  const p = payload?.[0]?.payload as { date: string; price: number } | undefined;
                  if (!active || !p) return null;
                  return (
                    <div className="rounded-md border bg-card px-2.5 py-1.5 text-xs shadow-md">
                      <p className="font-semibold tabular-nums">{money(p.price, currency)}</p>
                      <p className="text-muted-foreground">{shortDate(p.date)}</p>
                    </div>
                  );
                }}
              />
              <Area dataKey="price" type="monotone" stroke="none" fill="var(--flights)" fillOpacity={0.1} isAnimationActive={false} />
              <Line
                dataKey="price"
                type="monotone"
                stroke="var(--flights)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                isAnimationActive={false}
                dot={(props: { cx?: number; cy?: number; index?: number }) =>
                  props.index === data.length - 1 && props.cx != null && props.cy != null ? (
                    <g key="end">
                      <circle cx={props.cx} cy={props.cy} r={5} fill="var(--flights)" stroke="var(--card)" strokeWidth={2} />
                      <text x={props.cx + 9} y={props.cy + 4} fontSize={11} fontWeight={600} fill="var(--foreground)">
                        {money(last?.price, currency)}
                      </text>
                    </g>
                  ) : (
                    <g key={props.index} />
                  )
                }
                activeDot={{ r: 5, fill: "var(--flights)", stroke: "var(--card)", strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Google has no price history for this route yet.</p>
      )}
      {data.length > 1 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Show as table</summary>
          <table className="mt-2 w-full max-w-xs tabular-nums">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 font-medium">Date</th>
                <th className="py-1 text-right font-medium">Lowest fare</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.date} className="border-t">
                  <td className="py-1">{shortDate(d.date)}</td>
                  <td className="py-1 text-right">{money(d.price, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </figure>
  );
}
