import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "info" | "danger" | "neutral";

const toneClasses: Record<StatusTone, string> = {
  success: "bg-success/12 text-success border-success/30",
  warning: "bg-warning/15 text-warning-foreground border-warning/40 dark:text-warning",
  info: "bg-info/12 text-info border-info/30",
  danger: "bg-destructive/12 text-destructive border-destructive/30",
  neutral: "bg-muted text-muted-foreground border-border",
};

/** Tüm sistemde tutarlı durum göstergesi. */
export function StatusBadge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <StatusBadge tone={active ? "success" : "neutral"}>{active ? "Aktif" : "Pasif"}</StatusBadge>
  );
}
