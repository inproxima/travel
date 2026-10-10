"use client";

import * as React from "react";
import { toast } from "sonner";
import { Coins, Plane, TicketsPlane } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAction } from "@/lib/use-action";
import type { Deal } from "@/lib/models";
import { CashResults } from "./cash-view";
import { DealsView } from "./deals-view";
import { defaultFlightForm, FlightSearchForm } from "./flight-search-form";
import { toQuery, type FlightForm, type FlightSearchResponse } from "./types";

export function FlightsView({ points }: { points?: (form: FlightForm) => React.ReactNode }) {
  const [tab, setTab] = React.useState("cash");
  const [form, setForm] = React.useState<FlightForm>(defaultFlightForm);
  const [formKey, setFormKey] = React.useState(0);
  const [searched, setSearched] = React.useState<{ query: Record<string, unknown>; form: FlightForm } | null>(null);
  const cash = useAction<FlightSearchResponse>();

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
        <CashResults data={cash.data} loading={cash.loading} error={cash.error} cabins={searched?.form.cabins ?? form.cabins} query={searched?.query ?? {}} roundTrip={searched?.form.roundTrip ?? false} />
      </TabsContent>
      <TabsContent value="points" className="flex flex-col gap-5" forceMount hidden={tab !== "points"}>
        {points?.(form)}
      </TabsContent>
      <TabsContent value="deals" forceMount hidden={tab !== "deals"}>
        <DealsView onPick={pickDeal} />
      </TabsContent>
    </Tabs>
  );
}
