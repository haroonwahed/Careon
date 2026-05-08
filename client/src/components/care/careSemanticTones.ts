import type { CasusPhase } from "../../lib/phaseEngine";

export type CareUrgencyTone = "urgent" | "warning" | "positive" | "normal";
export type CareValidationTone = "error" | "warning" | "info" | "success";
export type CareQuickFilterTone = "no-match" | "delayed" | "high-risk" | "ready-placement";
export type CareCaseStatusTone = "intake" | "beoordeling" | "matching" | "plaatsing" | "afgerond";
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
        borderLeft: "border-l-amber-500",
        bg: "bg-amber-500/10",
        text: "text-amber-300",
        chip: "border-amber-500/40 bg-amber-500/15 text-amber-300",
      };
    case "positive":
      return {
        borderLeft: "border-l-emerald-500",
        bg: "bg-emerald-500/10",
        text: "text-emerald-300",
        chip: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
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
    case "intake":
      return "text-blue-300";
    case "beoordeling":
      return "text-primary";
    case "matching":
      return "text-amber-300";
    case "plaatsing":
      return "text-emerald-300";
    default:
      return "text-muted-foreground";
  }
}

export function workflowStatusChipClasses(status: CareWorkflowStatusTone): string {
  switch (status) {
    case "intake":
      return "text-primary bg-primary/10 border-primary/30";
    case "assessment":
      return "text-blue-300 bg-blue-500/10 border-blue-500/30";
    case "matching":
      return "text-amber-300 bg-amber-500/10 border-amber-500/30";
    case "placement":
      return "text-cyan-300 bg-cyan-500/10 border-cyan-500/30";
    case "active":
    case "completed":
      return "text-emerald-300 bg-emerald-500/10 border-emerald-500/30";
    default:
      return "text-destructive bg-destructive/10 border-destructive/30";
  }
}

export function urgencyLevelChipClasses(level: CareUrgencyLevelTone): string {
  switch (level) {
    case "critical":
      return "text-destructive bg-destructive/10 border-destructive/30";
    case "high":
      return "text-amber-300 bg-amber-500/10 border-amber-500/30";
    case "medium":
      return "text-blue-300 bg-blue-500/10 border-blue-500/30";
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
        color: "text-emerald-300",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/30",
        activeBg: "bg-emerald-500/15",
        activeBorder: "border-emerald-500/50",
      };
    default:
      return {
        color: "text-amber-300",
        bg: "bg-amber-500/10",
        border: "border-amber-500/30",
        activeBg: "bg-amber-500/15",
        activeBorder: "border-amber-500/50",
      };
  }
}

export function validationToneClasses(level: CareValidationTone) {
  switch (level) {
    case "error":
      return { text: "text-destructive", shell: "border-destructive/40 bg-destructive/15" };
    case "warning":
      return { text: "text-amber-300", shell: "border-amber-500/40 bg-amber-500/15" };
    case "info":
      return { text: "text-cyan-300", shell: "border-cyan-500/40 bg-cyan-500/15" };
    default:
      return { text: "text-emerald-300", shell: "border-emerald-500/40 bg-emerald-500/15" };
  }
}

export function phaseToneClass(phase: CasusPhase): string {
  switch (phase) {
    case "intake_initial":
      return "text-primary";
    case "beoordeling":
      return "text-blue-300";
    case "matching":
      return "text-amber-300";
    case "plaatsing":
      return "text-cyan-300";
    case "intake_provider":
      return "text-emerald-300";
    case "geblokkeerd":
      return "text-destructive";
    default:
      return "text-muted-foreground";
  }
}
