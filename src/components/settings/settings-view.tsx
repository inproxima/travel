"use client";

import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, CircleSlash, MapPin, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Cost, Notice, Skeleton, Spinner } from "@/components/ui/misc";
import { Switch } from "@/components/ui/switch";
import { api, notifyCreditsChanged } from "@/lib/client";
import type { Features } from "@/lib/env";
import type { SavedPlace } from "@/lib/models";
import type { Holding, ProgramDef, Settings } from "@/lib/settings";
import { useApiData } from "@/lib/use-api";

type SettingsPayload = { settings: Settings; airlines: ProgramDef[]; banks: ProgramDef[] };

function StatusRow({ ok, name, detail }: { ok: boolean; name: string; detail: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2">
      {ok ? <CheckCircle2 className="mt-0.5 size-4 text-success" /> : <CircleSlash className="mt-0.5 size-4 text-muted-foreground" />}
      <div className="text-sm">
        <p className="font-medium">{name}</p>
        <p className="text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function ApiStatus() {
  const f = useApiData<Features>("/api/status").data;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Connections</CardTitle>
        <CardDescription>
          Keys live in the <code className="font-mono">.env</code> file next to <code className="font-mono">run.sh</code>. Restart the app after editing it.
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        {!f ? (
          <Skeleton className="h-28" />
        ) : (
          <>
            {f.mock && (
              <Notice tone="warning" title="Sample-data mode" className="mb-2">
                Started with <code className="font-mono">./run.sh mock</code>: every result is sample data and no credits are used.
              </Notice>
            )}
            <StatusRow ok={f.serpapi} name="SerpApi" detail={f.serpapi ? "Flights, hotels, reviews, maps and forums are on." : "Add SERPAPI_API_KEY to search."} />
            <StatusRow
              ok={f.openai}
              name="OpenAI"
              detail={f.openai ? `AI Planner uses ${f.model} at ${f.reasoningEffort} reasoning.` : "Add OPENAI_API_KEY to use the AI Planner."}
            />
            <StatusRow
              ok={f.seatsAero}
              name="seats.aero"
              detail={f.seatsAero ? "Real award seats are on." : "Optional. Without it, points shows estimates from cash fares."}
            />
            <StatusRow
              ok={Boolean(f.googleMaps)}
              name="Google Maps"
              detail={
                f.googleMaps
                  ? `Google map view is on${f.googleMaps.mapId === "DEMO_MAP_ID" ? " (using Google's demo map ID)" : ""}.`
                  : "Optional. Add GOOGLE_MAPS_API_KEY for Google's map; OpenStreetMap is used meanwhile."
              }
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Places({ places, onChange }: { places: SavedPlace[]; onChange: (p: SavedPlace[]) => void }) {
  const [label, setLabel] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { place } = await api<{ place: SavedPlace }>("/api/places", { method: "POST", json: { label, address } });
      onChange([...places, place]);
      setLabel("");
      setAddress("");
      notifyCreditsChanged();
      toast.success(`Saved ${place.label}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await api(`/api/places/${id}`, { method: "DELETE" });
    onChange(places.filter((p) => p.id !== id));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My places</CardTitle>
        <CardDescription>Your office, a venue, family. Hotels and the AI Planner show travel times to these.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {places.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {places.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                <MapPin className="size-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{p.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.address}</p>
                </div>
                <Button variant="ghost" size="icon" aria-label={`Remove ${p.label}`} onClick={() => remove(p.id)}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
          <Field label="Name" htmlFor="place-label">
            <Input id="place-label" placeholder="Work" value={label} onChange={(e) => setLabel(e.target.value)} required maxLength={40} />
          </Field>
          <Field label="Address" htmlFor="place-address">
            <Input
              id="place-address"
              placeholder="Av. da Liberdade 110, Lisbon"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
              minLength={3}
            />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? <Spinner /> : <Plus />}
            Add place <Cost credits={1} />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ProgramRow({ def, h, onChange }: { def: ProgramDef; h: Holding; onChange: (h: Holding) => void }) {
  const id = `program-${def.id}`;
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 py-2.5 sm:grid-cols-[auto_1fr_8rem_6rem]">
      <Switch id={id} checked={h.held} onCheckedChange={(held) => onChange({ ...h, held })} aria-label={`I have ${def.name}`} />
      <label htmlFor={id} className="text-sm font-medium">
        {def.name}
      </label>
      <Input
        type="number"
        min={0}
        inputMode="numeric"
        placeholder="Balance"
        aria-label={`${def.name} balance`}
        className="col-start-2 sm:col-start-auto"
        value={h.balance ?? ""}
        disabled={!h.held}
        onChange={(e) => onChange({ ...h, balance: e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value))) })}
      />
      <div className="col-start-2 flex items-center gap-1 sm:col-start-auto">
        <Input
          type="number"
          min={0.1}
          max={20}
          step={0.05}
          aria-label={`${def.name} value in cents per point`}
          value={h.cpp}
          onChange={(e) => onChange({ ...h, cpp: Number(e.target.value) || def.cpp })}
        />
        <span className="text-xs text-muted-foreground">¢</span>
      </div>
    </div>
  );
}

function Programs({
  title,
  description,
  defs,
  settings,
  setSettings,
}: {
  title: string;
  description: string;
  defs: ProgramDef[];
  settings: Settings;
  setSettings: (s: Settings) => void;
}) {
  const held = defs.filter((d) => settings.programs[d.id]?.held).length;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{title}</CardTitle>
          {held > 0 && <Badge>{held} selected</Badge>}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="hidden grid-cols-[auto_1fr_8rem_6rem] gap-3 pb-1 text-xs text-muted-foreground sm:grid">
          <span className="w-9" />
          <span>Program</span>
          <span>Balance</span>
          <span>Value / pt</span>
        </div>
        <div className="divide-y">
          {defs.map((d) => (
            <ProgramRow
              key={d.id}
              def={d}
              h={settings.programs[d.id] ?? { held: false, balance: null, cpp: d.cpp }}
              onChange={(h) => setSettings({ ...settings, programs: { ...settings.programs, [d.id]: h } })}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function SettingsView() {
  const settings = useApiData<SettingsPayload>("/api/settings");
  const places = useApiData<{ places: SavedPlace[] }>("/api/places");
  const error = settings.error ?? places.error;

  if (error) return <Notice tone="error" title="Couldn't load settings">{error}</Notice>;
  if (!settings.data || !places.data) return <Skeleton className="h-96" />;
  return <SettingsEditor payload={settings.data} initialPlaces={places.data.places} />;
}

function SettingsEditor({ payload, initialPlaces }: { payload: SettingsPayload; initialPlaces: SavedPlace[] }) {
  const [draft, setDraft] = React.useState<Settings>(payload.settings);
  const [places, setPlaces] = React.useState(initialPlaces);
  const [saving, setSaving] = React.useState(false);

  async function save() {
    setSaving(true);
    try {
      const { settings } = await api<{ settings: Settings }>("/api/settings", { method: "PUT", json: draft });
      setDraft(settings);
      toast.success("Settings saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex flex-col gap-6">
        <Places places={places} onChange={setPlaces} />
        <Programs
          title="Bank & card points"
          description="Transferable points. The value is what one point is worth to you when paying for travel."
          defs={payload.banks}
          settings={draft}
          setSettings={setDraft}
        />
        <Programs
          title="Airline programs"
          description="Programs you hold miles in. Award searches can be limited to these, plus the ones your card points transfer to."
          defs={payload.airlines}
          settings={draft}
          setSettings={setDraft}
        />
      </div>
      <div className="flex flex-col gap-6 lg:sticky lg:top-20 lg:self-start">
        <ApiStatus />
        <Card>
          <CardHeader>
            <CardTitle>Defaults</CardTitle>
            <CardDescription>Used for prices and Google results.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3">
            <Field label="Currency" htmlFor="currency">
              <Input id="currency" value={draft.currency} maxLength={3} onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Country" htmlFor="country">
              <Input id="country" value={draft.country} maxLength={2} onChange={(e) => setDraft({ ...draft, country: e.target.value.toLowerCase() })} />
            </Field>
            <Field label="Language" htmlFor="language">
              <Input id="language" value={draft.language} maxLength={8} onChange={(e) => setDraft({ ...draft, language: e.target.value })} />
            </Field>
          </CardContent>
        </Card>
        <Button size="lg" onClick={save} disabled={saving}>
          {saving && <Spinner />}
          Save settings
        </Button>
      </div>
    </div>
  );
}
