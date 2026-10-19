// A placeholder for a module that has a place in the app but isn't built yet. Each one names the
// issue label where its work is tracked, so contributors can find it.

export interface NotBuiltProps {
  title: string;
  summary: string;
  label: string;
}

export function NotBuilt({ title, summary, label }: NotBuiltProps) {
  return (
    <section>
      <h1>{title}</h1>
      <p>{summary}</p>
      <p className="muted">
        Not built yet. The work is tracked in the project&rsquo;s issues labelled{" "}
        <code>{label}</code>.
      </p>
    </section>
  );
}
