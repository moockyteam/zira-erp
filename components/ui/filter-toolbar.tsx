"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { SearchInput } from "./search-input"
import { Button } from "./button"
import { X } from "lucide-react"

interface FilterToolbarProps {
    children?: React.ReactNode
    searchValue?: string
    searchPlaceholder?: string
    onSearchChange?: (value: string) => void
    resultCount?: number
    resultLabel?: string
    onReset?: () => void
    showReset?: boolean
    className?: string
}

export function FilterToolbar({
    children,
    searchValue,
    searchPlaceholder = "Rechercher...",
    onSearchChange,
    resultCount,
    resultLabel = "résultats",
    onReset,
    showReset = false,
    className,
}: FilterToolbarProps) {
    return (
        <div
            className={cn(
                "flex flex-col sm:flex-row gap-3 items-stretch sm:items-center p-4 rounded-lg bg-muted/30 border",
                className
            )}
        >
            {onSearchChange && (
                <div className="flex-1 min-w-0 sm:max-w-sm">
                    <SearchInput
                        placeholder={searchPlaceholder}
                        value={searchValue}
                        onChange={(e) => onSearchChange(e.target.value)}
                        onClear={() => onSearchChange("")}
                        className="w-full h-9 bg-background"
                    />
                </div>
            )}

            {children && (
                <div className="flex flex-wrap items-center gap-2">
                    {children}
                </div>
            )}

            <div className="flex items-center gap-3 sm:ml-auto">
                {showReset && onReset && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onReset}
                        className="h-8 px-2 text-muted-foreground hover:text-foreground"
                    >
                        <X className="h-3.5 w-3.5 mr-1" />
                        Réinitialiser
                    </Button>
                )}

                {resultCount !== undefined && (
                    <div className="text-sm text-muted-foreground whitespace-nowrap border-l pl-3">
                        <strong className="font-semibold text-foreground">{resultCount}</strong> {resultLabel}
                    </div>
                )}
            </div>
        </div>
    )
}
