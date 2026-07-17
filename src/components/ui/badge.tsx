import type { ProspectStatus } from "@/types";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "danger" | "warning" | "muted" | "info";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-gray-100 text-gray-700",
  success: "bg-green-100 text-green-700",
  danger: "bg-red-100 text-red-700",
  warning: "bg-amber-100 text-amber-700",
  muted: "bg-gray-100 text-gray-400",
  info: "bg-blue-100 text-blue-700",
};

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

const STATUS_CONFIG: Record<
  ProspectStatus,
  { label: string; variant: BadgeVariant; icon: string }
> = {
  ACTIVE: { label: "Actif", variant: "success", icon: "✅" },
  EXCLUDED: { label: "Exclu", variant: "danger", icon: "🚫" },
};

export function StatusBadge({ status }: { status: ProspectStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant={config.variant}>
      {config.icon} {config.label}
    </Badge>
  );
}
