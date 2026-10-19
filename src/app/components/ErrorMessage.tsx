import { Icon } from "./Icon";

export function ErrorMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="error" role="alert">
      <Icon name="alert-circle" size={18} />
      <span>{message}</span>
    </p>
  );
}
