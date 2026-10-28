// The frame around every page: sidebar, top bar, the command palette and its shortcut.

import { useEffect, useState, type ReactNode } from "react";
import { APP_VERSION } from "../version";
import { CommandPalette } from "./CommandPalette";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function Shell({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div className="shell">
        <Sidebar />
        <div className="shell-body">
          <TopBar onSearch={() => setPaletteOpen(true)} />
          <main id="main" className="content">
            {children}
            <footer className="content-foot subtle">
              Version {APP_VERSION} · Everything stays in this browser.
            </footer>
          </main>
        </div>
      </div>
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </>
  );
}
