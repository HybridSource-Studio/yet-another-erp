import { Link } from "wouter";
import { EmptyState } from "../components/EmptyState";

export function NotFound() {
  return (
    <>
      <h1 className="visually-hidden">Page not found</h1>
      <EmptyState
        icon="alert-circle"
        title="Page not found"
        description="Nothing lives at this address. It may have been deleted, or the link is wrong."
        action={
          <Link href="/" className="button button-secondary">
            Go to the dashboard
          </Link>
        }
      />
    </>
  );
}
