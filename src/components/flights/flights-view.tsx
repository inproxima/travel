"use client";

import * as React from "react";
import { toast } from "sonner";
import { Coins, Plane, TicketsPlane } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, notifyCreditsChanged } from "@/lib/client";
import { compactPoints, estimatePoints, programName, type Holdings } from "@/lib/points";
import { useAction } from "@/lib/use-action";
import { useApiData } from "@/lib/use-api";
import type { Features } from "@/lib/env";
import type { Cabin, Deal } from "@/lib/models";
import { CashResults } from "./cash-view";
import { DealsView } from "./deals-view";
import { defaultFlightForm, FlightSearchForm } from "./flight-search-form";
import { PointsView, type CashCompare } from "./points-view";
import { toQuery, type FlightForm, type FlightSearchResponse } from "./types";

export function FlightsView() {
  const [tab, setTab] = React.useState("cash");
  const [form, setForm] = React.useState<FlightForm>(defaultFlightForm);
  const [formKey, setFormKey] = React.useState(0);
  const [searched, setSearched] = React.useState<{ query: ReturnType<typeof toQuery>; form: FlightForm } | null>(null);
  const [extraCompare, setExtraCompare] = React.useState<CashCompare>(null);
  const [comparing, setComparing] = React.useState(false);
  const cash = useAction<FlightSearchResponse>();
  const features = useApiData<Features>("/api/status").data;
  const holdings = useApiData<{ settings: { programs: Holdings; currency: string } }>("/api/settings").data?.settings ?? null;

  function search() {
    const query = toQuery(form);
    setSearched({ query, form });
    void cash.run("/api/flights/search", { query, cabins: form.cabins });
  }

  function pickDeal(d: Deal, from: { codes: string; label: string }) {
    setForm({
      ...form,
      from,
      to: { codes: d.to!, label: `${d.destination} (${d.to})` },
      date: d.outboundDate ?? form.date,
      roundTrip: Boolean(d.returnDate),
      returnDate: d.returnDate ?? form.returnDate,
    });
    setFormKey((k) => k + 1);
    setTab("cash");
    toast.info(`${d.destination} filled in. Press Search fares to compare every cabin.`);
  }

  // What awards can be compared against: a points-tab lookup, else the last cash search.
  const cashCompare: CashCompare =
    extraCompare ??
    (searched && cash.data ? { from: searched.query.from, to: searched.query.to, date: searched.query.date, oneWay: !searched.form.roundTrip, data: cash.data } : null);

  async function compareCash(date: string, cabin: Cabin) {
    if (!form.from || !form.to) return;
    setComparing(true);
    try {
      const query = { from: form.from.codes, to: form.to.codes, date, returnDate: null, adults: 1 };
      const res = await api<FlightSearchResponse>("/api/flights/search", { method: "POST", json: { query, cabins: [cabin] } });
      setExtraCompare((prev) =>
        prev && prev.from === query.from && prev.to === query.to && prev.date === date
          ? { ...prev, data: { ...prev.data, cabins: { ...prev.data.cabins, ...res.cabins } } }
          : { from: query.from, to: query.to, date, oneWay: true, data: res },
      );
      notifyCreditsChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setComparing(false);
    }
  }

  const held = holdings && Object.values(holdings.programs).some((h) => h.held);
  const pointsLine = (_: Cabin, price: number | null) => {
    if (!held || price == null) return null;
    const best = estimatePoints(price, holdings!.programs)[0];
    return best ? (
      <p className="text-[11px] text-muted-foreground" title={`At ${best.cpp}¢ per point (Settings)`}>
        ≈ {compactPoints(best.points)} {programName(best.program)} pts
      </p>
    ) : null;
  };

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="cash">
          <Plane /> Cash fares
        </TabsTrigger>
        <TabsTrigger value="points">
          <Coins /> Points
        </TabsTrigger>
        <TabsTrigger value="deals">
          <TicketsPlane /> Deals
        </TabsTrigger>
      </TabsList>
      <TabsContent value="cash" className="flex flex-col gap-5" forceMount hidden={tab !== "cash"}>
        <FlightSearchForm key={formKey} form={form} setForm={setForm} loading={cash.loading} onSearch={search} />
        <CashResults
          data={cash.data}
          loading={cash.loading}
          error={cash.error}
          cabins={searched?.form.cabins ?? form.cabins}
          query={searched?.query ?? {}}
          roundTrip={searched?.form.roundTrip ?? false}
          priceExtra={pointsLine}
        />
      </TabsContent>
      <TabsContent value="points" className="flex flex-col gap-5" forceMount hidden={tab !== "points"}>
        <PointsView
          key={`points-${formKey}`}
          form={form}
          setForm={setForm}
          holdings={holdings?.programs ?? null}
          seatsAero={features ? features.seatsAero : null}
          compare={cashCompare}
          currency={cash.data?.currency ?? holdings?.currency ?? "USD"}
          onCompare={compareCash}
          comparing={comparing}
          onGoCash={() => setTab("cash")}
        />
      </TabsContent>
      <TabsContent value="deals" forceMount hidden={tab !== "deals"}>
        <DealsView onPick={pickDeal} />
      </TabsContent>
    </Tabs>
  );
}
