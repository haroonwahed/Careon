interface TimestampDividerProps {
  text: string;
}

export function TimestampDivider({ text }: TimestampDividerProps) {
  return (
    <div className="flex items-center gap-4 py-2">
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs text-muted-foreground whitespace-nowrap">{text}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}
