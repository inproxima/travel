"use client";

import * as React from "react";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Hotel photo, or a calm gradient tile with initials when there is none. */
export function HotelImage({ src, name, className }: { src?: string | null; name: string; className?: string }) {
  const [failed, setFailed] = React.useState(false);
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  if (src && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={cn("object-cover", className)} onError={() => setFailed(true)} loading="lazy" />;
  }
  return (
    <div
      aria-hidden
      className={cn("flex items-center justify-center text-lg font-semibold text-white/90", className)}
      style={{ background: `linear-gradient(135deg, oklch(0.62 0.09 ${hue}), oklch(0.45 0.1 ${(hue + 40) % 360}))` }}
    >
      {initials(name)}
    </div>
  );
}
