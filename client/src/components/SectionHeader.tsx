interface SectionHeaderProps {
  title: string;
  subtitle: string;
}

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <div className="mb-6">
      <h2 className="text-xl text-foreground mb-1">
        {title}
      </h2>
      <p className="text-sm text-muted-foreground">
        {subtitle}
      </p>
    </div>
  );
}
