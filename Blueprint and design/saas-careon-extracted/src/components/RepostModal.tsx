import { RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Language, t } from "../lib/i18n";

interface RepostModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  language: Language;
}

export function RepostModal({ open, onClose, onConfirm, language }: RepostModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent className="rounded-2xl dark:bg-[#0E0E14] bg-card border dark:border-[rgba(168,85,247,0.25)] border-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="dark:text-[#E7E7F0] text-foreground flex items-center gap-2">
            <RefreshCw className="w-5 h-5 dark:text-[#A78BFA] text-primary" />
            {t(language, "published.modal.repost.title")}
          </AlertDialogTitle>
          <AlertDialogDescription className="dark:text-[#9CA3AF] text-muted-foreground">
            {t(language, "published.modal.repost.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            onClick={onClose}
            className="rounded-xl"
          >
            {t(language, "published.modal.repost.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="rounded-xl dark:bg-[#8B5CF6] bg-primary hover:dark:bg-[#7C3AED] hover:bg-primary/90"
            style={{
              boxShadow: "0 0 16px rgba(139,92,246,0.3)"
            }}
          >
            {t(language, "published.modal.repost.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
