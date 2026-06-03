interface SectionHeaderProps {
  title: string;
}

export function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <div className="mb-6">
      <h2 className="text-xl text-foreground mb-1">
        {title}
      </h2>
    </div>
  );
}
