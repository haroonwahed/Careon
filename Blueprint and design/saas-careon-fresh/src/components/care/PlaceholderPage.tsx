import { Button } from "../ui/button";
import { ArrowLeft } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  onBack?: () => void;
}

export function PlaceholderPage({ title, description, icon, onBack }: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      {onBack && (
        <Button 
          variant="ghost" 
          onClick={onBack}
          className="gap-2 hover:bg-primary/10 hover:text-primary"
        >
          <ArrowLeft size={16} />
          Terug
        </Button>
      )}
      
      <div className="premium-card p-12 text-center">
        {icon && <div className="flex justify-center mb-6">{icon}</div>}
        <h1 className="text-3xl font-semibold mb-3">{title}</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          {description}
        </p>
      </div>
    </div>
  );
}
