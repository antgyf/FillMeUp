export function StatusPill({
  label,
  tone = "warning"
}: {
  label: string;
  tone?: "success" | "warning" | "danger";
}) {
  return (
    <span className="status-pill" data-tone={tone}>
      {label}
    </span>
  );
}
