import { Link } from "wouter";
import { Icon, type IconName } from "./Icon";

/** A headline number with a label, linking to where it comes from. */
export function StatCard({
  label,
  value,
  hint,
  icon,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: IconName;
  href: string;
}) {
  return (
    <Link href={href} className="stat">
      <span className="stat-icon">
        <Icon name={icon} />
      </span>
      <span className="stat-body">
        <span className="stat-label">{label}</span>
        <span className="stat-value">{value}</span>
        {hint && <span className="stat-hint">{hint}</span>}
      </span>
    </Link>
  );
}
