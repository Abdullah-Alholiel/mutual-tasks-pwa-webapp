import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

const TabsContext = React.createContext<{ activeTab: string; setActiveTab: (value: string) => void }>({
    activeTab: "",
    setActiveTab: () => { },
})

const AnimatedTabs = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ children, onValueChange, defaultValue, value, ...props }, ref) => {
    const [activeTab, setActiveTab] = React.useState(value || defaultValue || "")

    React.useEffect(() => {
        if (value !== undefined) {
            setActiveTab(value)
        }
    }, [value])

    const handleValueChange = (newValue: string) => {
        setActiveTab(newValue)
        onValueChange?.(newValue)
    }

    return (
        <TabsContext.Provider value={{ activeTab, setActiveTab: handleValueChange }}>
            <TabsPrimitive.Root
                ref={ref}
                value={activeTab}
                onValueChange={handleValueChange}
                {...props}
            >
                {children}
            </TabsPrimitive.Root>
        </TabsContext.Provider>
    )
})
AnimatedTabs.displayName = TabsPrimitive.Root.displayName

const AnimatedTabsList = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.List>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.List
        ref={ref}
        className={cn(
            "inline-flex h-12 items-center justify-center rounded-xl bg-muted p-1 text-muted-foreground gap-1",
            className
        )}
        {...props}
    />
))
AnimatedTabsList.displayName = TabsPrimitive.List.displayName

const AnimatedTabsTrigger = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.Trigger>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, value, ...props }, ref) => {
    const { activeTab } = React.useContext(TabsContext)
    const isActive = activeTab === value

    return (
        <TabsPrimitive.Trigger
            ref={ref}
            value={value}
            className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ring-offset-background transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 z-10 relative data-[state=active]:text-foreground bg-transparent data-[state=active]:shadow-none h-full",
                className
            )}
            {...props}
        >
            {isActive && (
                <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-background rounded-lg shadow-sm"
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
            )}
            <span className="relative z-20">{children}</span>
        </TabsPrimitive.Trigger>
    )
})
AnimatedTabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const AnimatedTabsContent = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.Content
        ref={ref}
        className={cn(
            "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            className
        )}
        {...props}
    />
))
AnimatedTabsContent.displayName = TabsPrimitive.Content.displayName

export { AnimatedTabs, AnimatedTabsList, AnimatedTabsTrigger, AnimatedTabsContent }
