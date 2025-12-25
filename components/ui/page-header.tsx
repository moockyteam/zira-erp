"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

interface PageHeaderProps {
    title: string
    description?: string
    icon?: LucideIcon
    children?: React.ReactNode
    className?: string
}

export function PageHeader({
    title,
    description,
    icon: Icon,
    children,
    className,
}: PageHeaderProps) {
    return (
        <div className={cn("flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8", className)}>
            <div className="flex items-center gap-3">
                {Icon && (
                    <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                    </div>
                )}
                <div>
                    <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
                    {description && (
                        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
                    )}
                </div>
            </div>
            {children && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {children}
                </div>
            )}
        </div>
    )
}
