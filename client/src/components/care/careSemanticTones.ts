import type { CasusPhase } from "../../lib/phaseEngine";

export type CareUrgencyTone = "urgent" | "warning" | "positive" | "normal";
export type CareValidationTone = "error" | "warning" | "info" | "success";
export type CareQuickFilterTone = "no-match" | "delayed" | "high-risk" | "ready-placement";
export type CareCaseStatusTone = "aanmelding" | "aanbiederreactie" | "matching" | "plaatsing" | "afgerond";
export type CareWorkflowStatusTone =
  | "intake"
  | "assessment"
  | "matching"
  | "placement"
  | "active"
  | "completed"
  | "blocked";
export type CareUrgencyLevelTone = "critical" | "high" | "medium" | "low";

export function urgencyToneClasses(level: CareUrgencyTone) {
  switch (level) {
    case "urgent":
      return {
        borderLeft: "border-l-destructive",
        bg: "bg-destructive/10",
        text: "text-destructive",
        chip: "border-destructive/40 bg-destructive/15 text-destructive",
      };
    case "warning":
      return {
        borderLeft: "border-care-warning-border",
        bg: "bg-care-warning-bg",
        text: "text-care-warning-text",
        chip: "border-care-warning-border bg-care-warning-bg text-care-warning-text",
      };
    case "positive":
      return {
        borderLeft: "border-care-success-border",
        bg: "bg-care-success-bg",
        text: "text-care-success-text",
        chip: "border-care-success-border bg-care-success-bg text-care-success-text",
      };
    default:
      return {
        borderLeft: "border-l-border",
        bg: "bg-transparent",
        text: "text-muted-foreground",
        chip: "border-border/70 bg-muted/30 text-muted-foreground",
      };
  }
}

export function caseStatusToneClass(status: CareCaseStatusTone): string {
  switch (status) {
    case "aanmelding":
      return "text-care-info-text";
    case "matching":
      return "text-care-warning-text";
    case "aanbiederreactie":
      return "text-care-brand-text";
    case "plaatsing":
      return "text-care-success-text";
    default:
      return "text-muted-foreground";
  }
}

export function workflowStatusChipClasses(status: CareWorkflowStatusTone): string {
  switch (status) {
    case "intake":
    case "assessment":
      return "text-care-info-text bg-care-info-bg border-care-info-border";
    case "matching":
      return "text-care-warning-text bg-care-warning-bg border-care-warning-border";
    case "placement":
      return "text-care-success-text bg-care-success-bg border-care-success-border";
    case "active":
    case "completed":
      return "text-care-success-text bg-care-success-bg border-care-success-border";
    default:
      return "text-destructive bg-destructive/10 border-destructive/30";
  }
}

export function urgencyLevelChipClasses(level: CareUrgencyLevelTone): string {
  switch (level) {
    case "critical":
      return "text-destructive bg-destructive/10 border-destructive/30";
    case "high":
      return "text-care-warning-text bg-care-warning-bg border-care-warning-border";
    case "medium":
      return "text-care-info-text bg-care-info-bg border-care-info-border";
    default:
      return "text-muted-foreground bg-muted/30 border-border/70";
  }
}

export function quickFilterToneClasses(filter: CareQuickFilterTone) {
  switch (filter) {
    case "no-match":
      return {
        color: "text-destructive",
        bg: "bg-destructive/10",
        border: "border-destructive/30",
        activeBg: "bg-destructive/15",
        activeBorder: "border-destructive/50",
      };
    case "ready-placement":
      return {
        color: "text-care-success-text",
        bg: "bg-care-success-bg",
        border: "border-care-success-border",
        activeBg: "bg-care-success-bg",
        activeBorder: "border-care-success-border",
      };
    default:
      return {
        color: "text-care-warning-text",
        bg: "bg-care-warning-bg",
        border: "border-care-warning-border",
        activeBg: "bg-care-warning-bg",
        activeBorder: "border-care-warning-border",
      };
  }
}

export function validationToneClasses(level: CareValidationTone) {
  switch (level) {
    case "error":
      return { text: "text-destructive", shell: "border-destructive/40 bg-destructive/15" };
    case "warning":
      return { text: "text-care-warning-text", shell: "border-care-warning-border bg-care-warning-bg" };
    case "info":
      return { text: "text-care-info-text", shell: "border-care-info-border bg-care-info-bg" };
    default:
      return { text: "text-care-success-text", shell: "border-care-success-border bg-care-success-bg" };
  }
}

export function phaseToneClass(phase: CasusPhase): string {
  switch (phase) {
    case "aanmelding":
      return "text-primary";
    case "matching":
      return "text-care-warning-text";
    case "aanbiederreactie":
      return "text-care-brand-text";
    case "plaatsing":
      return "text-care-success-text";
    case "intake":
      return "text-care-info-text";
    case "geblokkeerd":
      return "text-destructive";
    default:
      return "text-muted-foreground";
  }
}
