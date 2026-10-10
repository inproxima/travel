"use client";

import * as React from "react";
import { Building2, Plane } from "lucide-react";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client";
import type { AirportOption } from "@/lib/airports";
import { cn } from "@/lib/utils";

export type AirportValue = { codes: string; label: string };

/** Type a city, airport or code; picks one airport or every airport in a city. */
export function AirportInput({ id, value, onChange, placeholder }: { id: string; value: AirportValue | null; onChange: (v: AirportValue | null) => void; placeholder: string }) {
  const [text, setText] = React.useState(value?.label ?? "");
  const [options, setOptions] = React.useState<AirportOption[]>([]);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const listId = `${id}-list`;

  React.useEffect(() => {
    const q = text.trim();
    if (!open || q.length < 2 || q === value?.label) return;
    let alive = true;
    const t = setTimeout(() => {
      api<{ options: AirportOption[] }>(`/api/airports?q=${encodeURIComponent(q)}`)
        .then((r) => {
          if (!alive) return;
          setOptions(r.options);
          setActive(0);
        })
        .catch(() => alive && setOptions([]));
    }, 120);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [text, open, value?.label]);

  function choose(o: AirportOption) {
    onChange({ codes: o.value, label: o.label });
    setText(o.label);
    setOpen(false);
  }

  const shown = open && text.trim().length >= 2 && text !== value?.label ? options : [];

  return (
    <div className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={shown.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          // Typing a bare code like "lis" works without picking from the list.
          const raw = e.target.value.trim().toUpperCase();
          onChange(/^[A-Z]{3}(,[A-Z]{3})*$/.test(raw) ? { codes: raw, label: raw } : null);
        }}
        onKeyDown={(e) => {
          if (!shown.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(shown.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            choose(shown[active]!);
          } else if (e.key === "Escape") setOpen(false);
        }}
      />
      {shown.length > 0 && (
        <ul id={listId} role="listbox" className="absolute top-full z-20 mt-1 max-h-80 w-full min-w-72 overflow-auto rounded-lg border bg-card p-1 shadow-lg">
          {shown.map((o, i) => (
            <li
              key={o.value}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(o);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm", i === active && "bg-accent")}
            >
              {o.kind === "metro" ? <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> : <Plane className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
              <span className="min-w-0">
                <span className="block font-medium">{o.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{o.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
