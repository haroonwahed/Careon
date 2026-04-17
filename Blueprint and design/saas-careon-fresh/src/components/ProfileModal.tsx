import { useState } from "react";
import { User, Mail, Lock, CreditCard, Globe, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Language, t } from "../lib/i18n";
import { toast } from "sonner@2.0.3";

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: Language;
  onLanguageChange?: (language: Language) => void;
  onNavigateToSubscription?: () => void;
}

export function ProfileModal({
  open,
  onOpenChange,
  language,
  onLanguageChange,
  onNavigateToSubscription,
}: ProfileModalProps) {
  const [name, setName] = useState("Vintsy User");
  const [email, setEmail] = useState("user@vintsy.app");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSave = () => {
    // Validate passwords if they're being changed
    if (newPassword || confirmPassword) {
      if (newPassword !== confirmPassword) {
        toast.error(
          language === "fr"
            ? "Les mots de passe ne correspondent pas"
            : "Passwords do not match"
        );
        return;
      }
      if (!currentPassword) {
        toast.error(
          language === "fr"
            ? "Le mot de passe actuel est requis"
            : "Current password is required"
        );
        return;
      }
    }

    toast.success(
      language === "fr" ? "Profil enregistré" : "Profile saved"
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] dark:bg-card bg-card dark:border-primary/40 border-border rounded-2xl p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b dark:border-border border-border">
          <DialogTitle className="text-2xl font-semibold dark:text-foreground text-foreground">
            {language === "fr" ? "Profil" : "Profile"}
          </DialogTitle>
          <DialogDescription className="dark:text-muted-foreground text-muted-foreground">
            {language === "fr"
              ? "Gérez vos informations personnelles et vos préférences"
              : "Manage your personal information and preferences"}
          </DialogDescription>
        </DialogHeader>

        {/* Content */}
        <div className="px-6 py-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider dark:text-muted-foreground text-muted-foreground">
              {language === "fr" ? "Informations personnelles" : "Personal Information"}
            </h3>
            
            <div className="space-y-2">
              <Label htmlFor="name" className="dark:text-foreground text-foreground">
                <User className="h-4 w-4 inline mr-2" />
                {language === "fr" ? "Nom" : "Name"}
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="dark:bg-background bg-background dark:border-input border-input dark:text-foreground text-foreground rounded-xl h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="dark:text-foreground text-foreground">
                <Mail className="h-4 w-4 inline mr-2" />
                {language === "fr" ? "Email" : "Email"}
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="dark:bg-background bg-background dark:border-input border-input dark:text-foreground text-foreground rounded-xl h-10"
              />
            </div>
          </div>

          {/* Password Change */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider dark:text-muted-foreground text-muted-foreground">
              {language === "fr" ? "Changer le mot de passe" : "Change Password"}
            </h3>
            
            <div className="space-y-2">
              <Label htmlFor="current-password" className="dark:text-foreground text-foreground">
                <Lock className="h-4 w-4 inline mr-2" />
                {language === "fr" ? "Mot de passe actuel" : "Current Password"}
              </Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="dark:bg-background bg-background dark:border-input border-input dark:text-foreground text-foreground rounded-xl h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password" className="dark:text-foreground text-foreground">
                {language === "fr" ? "Nouveau mot de passe" : "New Password"}
              </Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="dark:bg-background bg-background dark:border-input border-input dark:text-foreground text-foreground rounded-xl h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="dark:text-foreground text-foreground">
                {language === "fr" ? "Confirmer le mot de passe" : "Confirm Password"}
              </Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="dark:bg-background bg-background dark:border-input border-input dark:text-foreground text-foreground rounded-xl h-10"
              />
            </div>
          </div>

          {/* Subscription */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider dark:text-muted-foreground text-muted-foreground">
              {language === "fr" ? "Abonnement" : "Subscription"}
            </h3>
            
            <div className="rounded-xl dark:bg-background bg-background dark:border-input border-input p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium dark:text-foreground text-foreground">
                    {language === "fr" ? "Plan Pro" : "Pro Plan"}
                  </p>
                  <p className="text-sm dark:text-muted-foreground text-muted-foreground">
                    {language === "fr" ? "49€/mois" : "€49/month"}
                  </p>
                </div>
                <CreditCard className="h-5 w-5 dark:text-primary text-primary" />
              </div>
              
              {onNavigateToSubscription && (
                <Button
                  variant="outline"
                  onClick={() => {
                    onNavigateToSubscription();
                    onOpenChange(false);
                  }}
                  className="w-full rounded-xl h-10 dark:border-primary/40 border-primary/40 dark:text-primary text-primary dark:hover:bg-primary/10 hover:bg-primary/10"
                >
                  {language === "fr" ? "Gérer mon abonnement" : "Manage my subscription"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t dark:border-border border-border flex items-center justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl h-10 dark:border-input border-input"
          >
            {language === "fr" ? "Fermer" : "Close"}
          </Button>
          <Button
            onClick={handleSave}
            className="rounded-xl h-10 dark:bg-primary bg-primary dark:text-white text-white hover:dark:bg-primary/90 hover:bg-primary/90"
          >
            {language === "fr" ? "Enregistrer" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}