import { Calendar, Phone, Mail, User, Building2 } from "lucide-react";
import { Button } from "../ui/button";
import { CarePanel } from "./CareDesignPrimitives";

interface ContactInfo {
  municipality: {
    name: string;
    contactPerson: string;
    email: string;
    phone: string;
  };
  caseOwner: {
    name: string;
    role: string;
    email: string;
    phone: string;
  };
}

interface ActionPanelProps {
  contactInfo: ContactInfo;
  onPlanIntake?: () => void;
  onStartIntake?: () => void;
  onContactClient?: () => void;
  onMarkStarted?: () => void;
}

export function ActionPanel({ 
  contactInfo,
  onPlanIntake,
  onStartIntake,
  onContactClient,
  onMarkStarted
}: ActionPanelProps) {
  return (
    <div className="space-y-4">
      {/* Next Actions */}
      <CarePanel className="p-4">
        <h3 className="text-base font-semibold text-foreground mb-4">
          Volgende acties
        </h3>

        <div className="space-y-2">
          {onPlanIntake && (
            <Button
              onClick={onPlanIntake}
              className="w-full bg-primary hover:bg-primary/90 justify-start"
            >
              <Calendar size={16} className="mr-2" />
              Plan intake afspraak
            </Button>
          )}

          {onStartIntake && (
            <Button
              onClick={onStartIntake}
              className="w-full justify-start"
            >
              <Calendar size={16} className="mr-2" />
              Start intake proces
            </Button>
          )}

          {onContactClient && (
            <Button
              onClick={onContactClient}
              variant="outline"
              className="w-full justify-start"
            >
              <Phone size={16} className="mr-2" />
              Contact gezin
            </Button>
          )}

          {onMarkStarted && (
            <Button
              onClick={onMarkStarted}
              variant="outline"
              className="w-full justify-start"
            >
              <Calendar size={16} className="mr-2" />
              Markeer als gestart
            </Button>
          )}
        </div>
      </CarePanel>

      {/* Contact Information */}
      <CarePanel className="p-4">
        <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
          <Phone size={16} className="text-muted-foreground" />
          Contact informatie
        </h3>

        <div className="space-y-4">
          {/* Municipality Contact */}
          <div className="p-4 rounded-lg bg-muted/20 border border-muted-foreground/20">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center flex-shrink-0 border border-cyan-500/30">
                <Building2 size={16} className="text-cyan-200" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground mb-1">
                  {contactInfo.municipality.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Gemeente
                </p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <User size={14} className="text-muted-foreground" />
                <span className="text-muted-foreground">
                  {contactInfo.municipality.contactPerson}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-muted-foreground" />
                <a 
                  href={`mailto:${contactInfo.municipality.email}`}
                  className="text-primary hover:underline"
                >
                  {contactInfo.municipality.email}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone size={14} className="text-muted-foreground" />
                <a 
                  href={`tel:${contactInfo.municipality.phone}`}
                  className="text-primary hover:underline"
                >
                  {contactInfo.municipality.phone}
                </a>
              </div>
            </div>
          </div>

          {/* Case Owner Contact */}
          <div className="p-4 rounded-lg bg-muted/20 border border-muted-foreground/20">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 border border-primary/20">
                <User size={16} className="text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground mb-1">
                  {contactInfo.caseOwner.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {contactInfo.caseOwner.role}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-muted-foreground" />
                <a 
                  href={`mailto:${contactInfo.caseOwner.email}`}
                  className="text-primary hover:underline"
                >
                  {contactInfo.caseOwner.email}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone size={14} className="text-muted-foreground" />
                <a 
                  href={`tel:${contactInfo.caseOwner.phone}`}
                  className="text-primary hover:underline"
                >
                  {contactInfo.caseOwner.phone}
                </a>
              </div>
            </div>
          </div>
        </div>
      </CarePanel>

      {/* Quick Tips */}
      <CarePanel className="p-4 border border-cyan-500/30 bg-cyan-500/10">
        <h3 className="text-sm font-semibold text-cyan-200 mb-3">
          Tips voor intake
        </h3>
        <ul className="space-y-2 text-xs text-cyan-200">
          <li className="flex items-start gap-2">
            <span className="text-cyan-200 mt-0.5">•</span>
            <span>Neem zo snel mogelijk contact op na plaatsing</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-200 mt-0.5">•</span>
            <span>Beoordeel alle documenten voor de intake</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-200 mt-0.5">•</span>
            <span>Stem intakeplanning af op urgentie en capaciteit</span>
          </li>
        </ul>
      </CarePanel>
    </div>
  );
}
