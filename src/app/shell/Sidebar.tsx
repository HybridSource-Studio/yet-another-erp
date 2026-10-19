import { Link, useLocation } from "wouter";
import { APP_NAME } from "../../config";
import { Icon } from "../components/Icon";
import { findNav, NAV } from "./nav";
import { useCollapsed } from "./sidebar-state";

export function Sidebar() {
  const [path] = useLocation();
  const [collapsed, setCollapsed] = useCollapsed();
  const active = findNav(path)?.item.href;

  return (
    <nav className="sidebar" aria-label="Main" data-collapsed={collapsed || undefined}>
      <div className="sidebar-top">
        <Link href="/" className="brand" title={APP_NAME}>
          <span className="brand-mark" aria-hidden="true">
            <Icon name="list" size={16} />
          </span>
          <span className="brand-name">{APP_NAME}</span>
        </Link>
        <button
          type="button"
          className="icon-button"
          onClick={() => setCollapsed(!collapsed)}
          aria-pressed={collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Icon name="panel-left" />
        </button>
      </div>
      <div className="sidebar-scroll">
        {NAV.map((section) => (
          <div key={section.heading} className="nav-section">
            <h2 className="nav-heading">{section.heading}</h2>
            <ul>
              {section.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="nav-link"
                    aria-current={active === item.href ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon name={item.icon} />
                    <span className="nav-label">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="sidebar-foot">
        <span className="pill pill-neutral" title="Stored in this browser, on this device">
          <Icon name="shield-check" size={14} />
          <span className="nav-label">On this device</span>
        </span>
      </div>
    </nav>
  );
}
