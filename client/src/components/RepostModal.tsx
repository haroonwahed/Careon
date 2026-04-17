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
      <AlertDialogContent className="rounded-2xl border border-border bg-card shadow-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-foreground">
            <RefreshCw className="h-5 w-5 text-primary" />
            {t(language, "published.modal.repost.title")}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
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
            className="rounded-xl bg-primary hover:bg-primary/90"
          >
            {t(language, "published.modal.repost.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
