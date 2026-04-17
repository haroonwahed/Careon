interface SectionHeaderProps {
  title: string;
  subtitle: string;
}

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <div className="mb-6">
      <h2 className="text-xl dark:text-[#E7E7F0] text-foreground mb-1">
        {title}
      </h2>
      <p className="text-sm dark:text-[#9CA3AF] text-muted-foreground">
        {subtitle}
      </p>
    </div>
  );
}
