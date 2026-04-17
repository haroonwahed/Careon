import * as React from "react";
import { Slot } from "@radix-ui/react-slot@1.1.2";
import { cva, type VariantProps } from "class-variance-authority@0.7.1";

import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        default: "bg-primary text-white shadow-lg hover:bg-primary/90 dark:shadow-[0_4px_20px_rgba(124,58,237,0.3)] hover:shadow-xl dark:hover:shadow-[0_6px_25px_rgba(124,58,237,0.4)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 shadow-lg hover:shadow-xl dark:bg-destructive/90 dark:hover:bg-destructive/80 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]",
        outline:
          "border-[1.5px] border-border bg-transparent dark:hover:bg-[rgba(139,92,246,0.10)] hover:bg-primary/10 dark:hover:text-foreground hover:text-foreground dark:border-muted-foreground/40 dark:bg-muted-foreground/5 dark:text-foreground/95 dark:hover:border-muted-foreground/60 hover:shadow-sm dark:hover:shadow-[0_0_12px_rgba(139,92,246,0.2)] transition-all",
        secondary:
          "bg-secondary/10 text-secondary-foreground border border-secondary/20 hover:bg-secondary/20 dark:bg-secondary/15 dark:hover:bg-secondary/25",
        ghost:
          "dark:hover:bg-[rgba(139,92,246,0.10)] hover:bg-primary/10 dark:hover:text-foreground hover:text-foreground dark:text-foreground/90",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-lg gap-1.5 px-3 has-[>svg]:px-2.5 text-xs",
        lg: "h-11 rounded-xl px-6 has-[>svg]:px-5 text-base",
        icon: "size-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean;
    }
>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      ref={ref}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
});

Button.displayName = "Button";

export { Button, buttonVariants };