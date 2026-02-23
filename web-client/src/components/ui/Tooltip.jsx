import * as React from "react"
import { cn } from "@/lib/utils"

const TooltipProvider = ({ children }) => <>{children}</>

const Tooltip = ({ children }) => {
    return <div className="relative group inline-block">{children}</div>
}

const TooltipTrigger = React.forwardRef(({ children, asChild, ...props }, ref) => {
    if (asChild) {
        return React.Children.only(children)
    }
    return <button ref={ref} {...props}>{children}</button>
})
TooltipTrigger.displayName = "TooltipTrigger"

const TooltipContent = React.forwardRef(({ className, sideOffset = 4, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 overflow-hidden rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-950 shadow-md",
            "invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200",
            className
        )}
        {...props}
    />
))
TooltipContent.displayName = "TooltipContent"

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
