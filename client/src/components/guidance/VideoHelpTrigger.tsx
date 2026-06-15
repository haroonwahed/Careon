import { useState } from "react";
import { Play } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { cn } from "../ui/utils";

export type VideoHelpTriggerProps = {
  title: string;
  description?: string;
  script: string;
  videoSrc?: string;
  triggerLabel?: string;
  testId?: string;
  className?: string;
};

export function VideoHelpTrigger({
  title,
  description,
  script,
  videoSrc,
  triggerLabel = "Bekijk uitleg",
  testId,
  className,
}: VideoHelpTriggerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        data-testid={testId}
        data-component="video-help-trigger"
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-transparent px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground underline-offset-2 transition-colors hover:border-border/60 hover:bg-muted/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          className,
        )}
        onClick={() => setOpen(true)}
      >
        <Play className="size-3 shrink-0 opacity-90" aria-hidden />
        {triggerLabel}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-lg border-border/60 bg-card"
          data-testid={testId ? `${testId}-dialog` : undefined}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? (
              <DialogDescription>{description}</DialogDescription>
            ) : (
              <DialogDescription className="sr-only">Video-uitleg voor {title}</DialogDescription>
            )}
          </DialogHeader>
          <div className="aspect-video overflow-hidden rounded-xl border border-border/70 bg-muted/20">
            {videoSrc ? (
              <iframe
                src={videoSrc}
                title={title}
                className="size-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="flex size-full items-center justify-center">
                <Play className="size-10 text-muted-foreground/60" aria-hidden />
              </div>
            )}
          </div>
          <div className="space-y-2 rounded-xl border border-border/50 bg-muted/10 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Samenvatting
            </p>
            <p className="text-[13px] leading-relaxed text-foreground/90">{script}</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
