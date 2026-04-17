import { Download, Package as PackageIcon, XCircle, AlertCircle, Info } from "lucide-react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import { Language, t } from "../lib/i18n";
import { toast } from "sonner@2.0.3";

interface ConversationInfoMenuProps {
  hasLabel: boolean;
  isShipped: boolean;
  language: Language;
}

export function ConversationInfoMenu({ hasLabel, isShipped, language }: ConversationInfoMenuProps) {
  const handleDownloadLabel = () => {
    toast.success(
      language === "fr" ? "Bordereau téléchargé" : "Label downloaded"
    );
  };

  const handleTrackParcel = () => {
    toast.info(
      language === "fr" ? "Ouverture du suivi..." : "Opening tracking..."
    );
  };

  const handleCancelOrder = () => {
    toast.info(
      language === "fr" ? "Ouverture de l'annulation..." : "Opening cancellation..."
    );
  };

  const handleReportProblem = () => {
    toast.info(
      language === "fr" ? "Ouverture du formulaire de signalement..." : "Opening report form..."
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl dark:text-[#9CA3AF] text-muted-foreground hover:dark:text-[#A78BFA] hover:text-primary transition-all duration-200 dark:hover:bg-primary/10 hover:bg-primary/5"
        >
          <Info className="w-5 h-5" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent 
        align="end" 
        className="w-56 rounded-xl dark:bg-[#0E0E14] bg-popover border dark:border-[rgba(168,85,247,0.25)] border-border"
      >
        {hasLabel && (
          <>
            <DropdownMenuItem
              onClick={handleDownloadLabel}
              className="rounded-lg cursor-pointer"
            >
              <Download className="w-4 h-4 mr-3 dark:text-[#A78BFA] text-primary" />
              <span>{t(language, "messages.actions.downloadLabel")}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="dark:bg-[rgba(168,85,247,0.15)] bg-border" />
          </>
        )}

        {isShipped && (
          <>
            <DropdownMenuItem
              onClick={handleTrackParcel}
              className="rounded-lg cursor-pointer"
            >
              <PackageIcon className="w-4 h-4 mr-3 dark:text-[#9CA3AF] text-muted-foreground" />
              <span>{t(language, "messages.actions.trackParcel")}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="dark:bg-[rgba(168,85,247,0.15)] bg-border" />
          </>
        )}

        <DropdownMenuItem
          onClick={handleCancelOrder}
          className="rounded-lg cursor-pointer dark:text-[#FF5C8A] text-destructive"
        >
          <XCircle className="w-4 h-4 mr-3" />
          <span>{t(language, "messages.actions.cancelOrder")}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="dark:bg-[rgba(168,85,247,0.15)] bg-border" />

        <DropdownMenuItem
          onClick={handleReportProblem}
          className="rounded-lg cursor-pointer"
        >
          <AlertCircle className="w-4 h-4 mr-3 dark:text-[#9CA3AF] text-muted-foreground" />
          <span>{t(language, "messages.actions.reportProblem")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}