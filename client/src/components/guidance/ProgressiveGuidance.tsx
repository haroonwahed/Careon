import { cn } from "../ui/utils";
import { InlineHelpChip, type InlineHelpChipProps } from "./InlineHelpChip";
import { VideoHelpTrigger, type VideoHelpTriggerProps } from "./VideoHelpTrigger";

export type ProgressiveGuidanceProps = {
  chip: InlineHelpChipProps;
  video?: Omit<VideoHelpTriggerProps, "className">;
  className?: string;
  videoClassName?: string;
};

export function ProgressiveGuidance({
  chip,
  video,
  className,
  videoClassName,
}: ProgressiveGuidanceProps) {
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-2", className)}>
      <InlineHelpChip {...chip} />
      {video ? <VideoHelpTrigger {...video} className={videoClassName} /> : null}
    </span>
  );
}
