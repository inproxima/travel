import { ExternalLink, MessagesSquare } from "lucide-react";
import type { ForumPost } from "@/lib/models";

export function ForumList({ posts }: { posts: ForumPost[] }) {
  return (
    <ul className="flex flex-col divide-y">
      {posts.map((p) => (
        <li key={p.link} className="py-3">
          <a href={p.link} target="_blank" rel="noreferrer" className="group flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MessagesSquare className="size-3.5" />
              {p.source ?? new URL(p.link).hostname}
              {p.meta && <span>· {p.meta}</span>}
            </span>
            <span className="flex items-start gap-1 text-sm font-medium group-hover:text-primary">
              {p.title}
              <ExternalLink className="mt-0.5 size-3 shrink-0 opacity-0 transition group-hover:opacity-100" />
            </span>
            {p.snippet && <span className="text-sm text-muted-foreground">{p.snippet}</span>}
          </a>
        </li>
      ))}
    </ul>
  );
}
