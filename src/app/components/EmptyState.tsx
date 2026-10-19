import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/** What a list shows when there is nothing in it yet: what this is for, and the first step. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: IconName;
  title: string;
  description: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={24} />
      </span>
      <h2>{title}</h2>
      <p className="muted">{description}</p>
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}
