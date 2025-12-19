import * as React from "react"
import { Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export interface SearchInputProps extends React.ComponentProps<"input"> {
    onClear?: () => void
    wrapperClassName?: string
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(({ className, wrapperClassName, value, onChange, onClear, ...props }, ref) => {
    return (
        <div className={cn("relative flex items-center w-full", wrapperClassName)}>
            <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
                {...props}
                value={value}
                onChange={onChange}
                ref={ref}
                className={cn("pl-9 pr-9", className)}
            />
            {value && onClear && (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={onClear}
                >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Effacer la recherche</span>
                </Button>
            )}
        </div>
    )
})
SearchInput.displayName = "SearchInput"

export { SearchInput }
