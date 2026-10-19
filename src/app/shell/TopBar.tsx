import { useLocation } from "wouter";
import { Icon } from "../components/Icon";
import { findNav } from "./nav";
import { useTheme, type Theme } from "./theme";

const THEMES: { value: Theme; label: string; icon: "sun" | "moon" | "monitor" }[] = [
  { value: "light", label: "Light theme", icon: "sun" },
  { value: "dark", label: "Dark theme", icon: "moon" },
  { value: "system", label: "Follow the system theme", icon: "monitor" },
];

export function TopBar({ onSearch }: { onSearch: () => void }) {
  const [path] = useLocation();
  const [theme, setTheme] = useTheme();
  const here = findNav(path);
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <header className="topbar">
      <nav className="crumbs" aria-label="You are here">
        {here && here.item.href !== "/" ? (
          <>
            <span className="crumb">{here.section.heading}</span>
            <Icon name="chevron-right" size={14} />
            <span className="crumb crumb-current" aria-current="page">
              {here.item.label}
            </span>
          </>
        ) : (
          <span className="crumb crumb-current">Dashboard</span>
        )}
      </nav>
      <div className="topbar-actions">
        <button type="button" className="search-button" onClick={onSearch}>
          <Icon name="search" size={16} />
          <span>Jump to…</span>
          <kbd>{isMac ? "⌘" : "Ctrl"} K</kbd>
        </button>
        <div className="segmented" role="group" aria-label="Theme">
          {THEMES.map((t) => (
            <button
              key={t.value}
              type="button"
              className="icon-button"
              aria-pressed={theme === t.value}
              aria-label={t.label}
              title={t.label}
              onClick={() => setTheme(t.value)}
            >
              <Icon name={t.icon} size={16} />
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
