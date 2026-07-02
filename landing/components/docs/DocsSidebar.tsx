"use client";

import { useEffect, useState } from "react";

type Item = { id: string; label: string };
type Group = { label: string; items: Item[] };

// Ported from arca/dashboard: grouped, sticky, active-section highlight (scroll-spy).
// Same-page links smooth-scroll via Lenis; preventDefault runs FIRST so a `#` can
// never reach the URL, even if the target isn't found.
export function DocsSidebar({ groups }: { groups: Group[] }) {
  const [active, setActive] = useState("");
  const idKey = groups.flatMap((g) => g.items.map((i) => i.id)).join(",");

  useEffect(() => {
    const ids = idKey.split(",").filter(Boolean);
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-110px 0px -65% 0px", threshold: 0 },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [idKey]);

  const go = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const lenis = window.__lenis;
    if (lenis) lenis.scrollTo(el, { offset: -100, duration: 1.1 });
    else el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <aside className="mb-10 lg:mb-0">
      <nav className="lg:sticky lg:top-24">
        {groups.map((g) => (
          <div key={g.label} className="mb-6">
            <p className="kicker mb-2 !text-[10px]">{g.label}</p>
            <ul className="space-y-1">
              {g.items.map((it) => (
                <li key={it.id}>
                  <a
                    href={`#${it.id}`}
                    onClick={(e) => go(e, it.id)}
                    className={`block rounded-md px-2 py-1 text-[13px] transition-colors ${active === it.id ? "bg-night-3 text-gold" : "text-fog-2 hover:text-fog"}`}
                  >
                    {it.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
