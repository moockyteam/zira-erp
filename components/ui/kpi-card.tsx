"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

type KpiVariant = "default" | "success" | "warning" | "danger" | "info"

interface KpiCardProps {
    title: string
    value: string | number
    subtitle?: string
    icon?: LucideIcon
    variant?: KpiVariant
    trend?: {
        value: number
        label?: string
    }
    className?: string
}

const variantStyles: Record<KpiVariant, { container: string; icon: string; value: string }> = {
    default: {
        container: "bg-card border",
        icon: "bg-primary/10 text-primary",
        value: "text-foreground",
    },
    success: {
        container: "bg-emerald-50/50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30",
        icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400",
        value: "text-emerald-700 dark:text-emerald-400",
    },
    warning: {
        container: "bg-amber-50/50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30",
        icon: "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400",
        value: "text-amber-700 dark:text-amber-400",
    },
    danger: {
        container: "bg-rose-50/50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30",
        icon: "bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-400",
        value: "text-rose-700 dark:text-rose-400",
    },
    info: {
        container: "bg-sky-50/50 border-sky-100 dark:bg-sky-950/20 dark:border-sky-900/30",
        icon: "bg-sky-100 text-sky-600 dark:bg-sky-900/50 dark:text-sky-400",
        value: "text-sky-700 dark:text-sky-400",
    },
}

export function KpiCard({
    title,
    value,
    subtitle,
    icon: Icon,
    variant = "default",
    trend,
    className,
}: KpiCardProps) {
    const styles = variantStyles[variant]

    return (
        <div
            className={cn(
                "relative p-4 rounded-lg border shadow-sm transition-all hover:shadow-md",
                styles.container,
                className
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        {title}
                    </p>
                    <p className={cn("text-2xl font-semibold tracking-tight", styles.value)}>
                        {value}
                    </p>
                    {subtitle && (
                        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
                    )}
                    {trend && (
                        <div className={cn(
                            "text-xs font-medium mt-2 flex items-center gap-1",
                            trend.value >= 0 ? "text-emerald-600" : "text-rose-600"
                        )}>
                            <span>{trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}%</span>
                            {trend.label && <span className="text-muted-foreground">{trend.label}</span>}
                        </div>
                    )}
                </div>
                {Icon && (
                    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", styles.icon)}>
                        <Icon className="h-4 w-4" />
                    </div>
                )}
            </div>
        </div>
    )
}
