import * as React from "react";
import { Slot } from "@radix-ui/react-slot@1.1.2";
import { cva, type VariantProps } from "class-variance-authority@0.7.1";

import { cn } from "./utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-all duration-200 overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-sm [a&]:hover:bg-primary/90 dark:shadow-[0_0_10px_rgba(139,92,246,0.2)]",
        secondary:
          "border-transparent bg-secondary/15 text-secondary-foreground border-secondary/20 [a&]:hover:bg-secondary/25",
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 dark:bg-destructive/80",
        outline:
          "text-foreground border-border dark:border-primary/30 [a&]:hover:bg-primary/10 [a&]:dark:hover:bg-[rgba(139,92,246,0.10)] [a&]:hover:text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };