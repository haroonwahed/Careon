import { useState } from "react";
import { Package, MapPin, CheckCircle2, ExternalLink } from "lucide-react";
import { Order } from "../lib/ordersData";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Language } from "../lib/i18n";

interface TrackingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: Language;
  order: Order;
  onSave: (tracking: { carrier: string; trackingNumber: string }) => void;
}

const CARRIERS = [
  { value: "colissimo", label: "Colissimo" },
  { value: "mondial_relay", label: "Mondial Relay" },
  { value: "chronopost", label: "Chronopost" },
  { value: "ups", label: "UPS" },
  { value: "dhl", label: "DHL" },
  { value: "other", label: "Autre" },
];

// Mock timeline data for Vinted tracking
const MOCK_VINTED_TIMELINE = [
  {
    status: "Colis pris en charge",
    timestamp: new Date("2024-01-15T10:30:00"),
    location: "Paris 75015",
  },
  {
    status: "En transit",
    timestamp: new Date("2024-01-15T14:20:00"),
    location: "Centre de tri Paris Nord",
  },
  {
    status: "En cours de livraison",
    timestamp: new Date("2024-01-16T08:00:00"),
    location: "Lyon 69001",
  },
];

export function TrackingModal({
  open,
  onOpenChange,
  language,
  order,
  onSave,
}: TrackingModalProps) {
  const isVinted = order.source === "vinted";
  const isManual = order.source === "manual";
  
  // For manual purchases
  const [carrier, setCarrier] = useState(order.trackingCarrier || "");
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber || "");

  const handleSave = () => {
    if (carrier && trackingNumber) {
      onSave({ carrier, trackingNumber });
      onOpenChange(false);
    }
  };

  const hasManualTracking = carrier && trackingNumber;

  // Vinted tracking view (read-only)
  if (isVinted) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-2xl rounded-2xl dark:bg-[#0E0E14] bg-card border dark:border-[rgba(168,85,247,0.25)] border-border overflow-hidden"
          style={{
            boxShadow:
              "0 0 0 1px rgba(168,85,247,0.25), 0 0 48px rgba(168,85,247,0.15)",
          }}
        >
          <DialogHeader className="border-b dark:border-[rgba(168,85,247,0.25)] border-border pb-4">
            <DialogTitle className="text-xl dark:text-[#E7E7F0] text-foreground">
              {language === "fr" ? "Suivi Vinted" : "Vinted Tracking"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {language === "fr"
                ? "Consultez le suivi de votre colis Vinted"
                : "View your Vinted package tracking"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-6">
            {/* Vinted tracking link */}
            {order.trackingUrl && (
              <div className="flex items-center gap-3 p-4 rounded-xl dark:bg-[rgba(139,92,246,0.05)] bg-gray-50 border dark:border-[rgba(168,85,247,0.15)] border-gray-200">
                <Package className="w-5 h-5 dark:text-[#8B5CF6] text-primary" />
                <div className="flex-1">
                  <div className="text-sm dark:text-[#E7E7F0] text-foreground">
                    {language === "fr"
                      ? "Suivi géré par Vinted"
                      : "Tracking managed by Vinted"}
                  </div>
                  <div className="text-xs dark:text-[#9CA3AF] text-muted-foreground mt-0.5">
                    {language === "fr"
                      ? "Suivez votre colis directement sur Vinted"
                      : "Track your package directly on Vinted"}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(order.trackingUrl, "_blank")}
                  className="rounded-xl dark:border-[rgba(168,85,247,0.30)] border-border dark:text-[#E7E7F0] text-foreground hover:dark:bg-[rgba(139,92,246,0.10)] hover:bg-gray-100"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {language === "fr" ? "Ouvrir" : "Open"}
                </Button>
              </div>
            )}

            {/* Timeline from order.timeline */}
            {order.timeline && order.timeline.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm dark:text-[#9CA3AF] text-muted-foreground">
                  {language === "fr" ? "Historique" : "Timeline"}
                </h3>
                <div className="space-y-3">
                  {order.timeline.map((event, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 rounded-xl dark:bg-[rgba(139,92,246,0.05)] bg-gray-50 border dark:border-[rgba(168,85,247,0.15)] border-gray-200"
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {idx === order.timeline.length - 1 ? (
                          <div className="w-2 h-2 rounded-full dark:bg-primary bg-primary" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 dark:text-[#2AF07A] text-green-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm dark:text-[#E7E7F0] text-foreground">
                          {event.status}
                        </div>
                        <div className="text-xs dark:text-[#9CA3AF] text-muted-foreground mt-1">
                          {event.timestamp.toLocaleDateString(
                            language === "fr" ? "fr-FR" : "en-US",
                            {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t dark:border-[rgba(168,85,247,0.25)] border-border pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full rounded-xl dark:border-[rgba(168,85,247,0.30)] border-border dark:text-[#E7E7F0] text-foreground hover:dark:bg-[rgba(139,92,246,0.10)] hover:bg-gray-100"
            >
              {language === "fr" ? "Fermer" : "Close"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Manual tracking view (editable)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl rounded-2xl dark:bg-[#0E0E14] bg-card border dark:border-[rgba(168,85,247,0.25)] border-border overflow-hidden"
        style={{
          boxShadow:
            "0 0 0 1px rgba(168,85,247,0.25), 0 0 48px rgba(168,85,247,0.15)",
        }}
      >
        <DialogHeader className="border-b dark:border-[rgba(168,85,247,0.25)] border-border pb-4">
          <DialogTitle className="text-xl dark:text-[#E7E7F0] text-foreground">
            {hasManualTracking
              ? language === "fr"
                ? "Suivi du colis"
                : "Package tracking"
              : language === "fr"
              ? "Configurer le suivi"
              : "Setup tracking"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {language === "fr"
              ? "Gérez le suivi de votre colis"
              : "Manage your package tracking"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-6">
          {/* No tracking message */}
          {!hasManualTracking && (
            <div className="p-4 rounded-xl dark:bg-[rgba(139,92,246,0.05)] bg-gray-50 border dark:border-[rgba(168,85,247,0.15)] border-gray-200">
              <div className="text-sm dark:text-[#9CA3AF] text-muted-foreground">
                {language === "fr"
                  ? "Aucun suivi renseigné. Ajoutez un numéro de suivi pour suivre votre colis."
                  : "No tracking information. Add a tracking number to track your package."}
              </div>
            </div>
          )}

          {/* Tracking form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label
                htmlFor="carrier"
                className="dark:text-[#E7E7F0] text-foreground"
              >
                {language === "fr" ? "Transporteur" : "Carrier"}
              </Label>
              <Select value={carrier} onValueChange={setCarrier}>
                <SelectTrigger
                  id="carrier"
                  className="rounded-xl dark:bg-[rgba(10,10,15,0.50)] bg-background dark:border-[rgba(168,85,247,0.20)] border-border"
                >
                  <SelectValue
                    placeholder={
                      language === "fr"
                        ? "Sélectionner un transporteur"
                        : "Select a carrier"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {CARRIERS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="trackingNumber"
                className="dark:text-[#E7E7F0] text-foreground"
              >
                {language === "fr" ? "Numéro de suivi" : "Tracking number"}
              </Label>
              <Input
                id="trackingNumber"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder={
                  language === "fr"
                    ? "Ex: 6A12345678901"
                    : "Ex: 6A12345678901"
                }
                className="rounded-xl dark:bg-[rgba(10,10,15,0.50)] bg-background dark:border-[rgba(168,85,247,0.20)] border-border"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t dark:border-[rgba(168,85,247,0.25)] border-border pt-4 flex gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 rounded-xl dark:border-[rgba(168,85,247,0.30)] border-border dark:text-[#E7E7F0] text-foreground hover:dark:bg-[rgba(139,92,246,0.10)] hover:bg-gray-100"
          >
            {language === "fr" ? "Annuler" : "Cancel"}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!carrier || !trackingNumber}
            className="flex-1 rounded-xl dark:bg-[#8B5CF6] bg-primary hover:dark:bg-[#7C3AED] hover:bg-primary/90 dark:text-white text-primary-foreground"
            style={{
              boxShadow: "0 0 20px rgba(139,92,246,0.4)",
            }}
          >
            {language === "fr" ? "Enregistrer" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}