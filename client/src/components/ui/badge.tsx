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
          "border border-border/70 bg-muted/35 text-foreground [a&]:hover:bg-muted/50",
        secondary:
          "border border-border bg-bg-subtle text-foreground [a&]:hover:bg-bg-subtle/80",
        destructive:
          "careon-badge-red",
        red:
          "careon-badge-red",
        yellow:
          "careon-badge-yellow",
        blue:
          "careon-badge-blue",
        purple:
          "careon-badge-purple",
        outline:
          "text-foreground border-border bg-transparent [a&]:hover:bg-bg-subtle [a&]:hover:text-foreground",
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