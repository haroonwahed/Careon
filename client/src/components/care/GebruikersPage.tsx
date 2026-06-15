import { useState, useEffect, useCallback } from "react";
import { UserPlus, ShieldCheck, Shield, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import {
  CareSection,
  CareSectionHeader,
  CareSectionBody,
  CareBadge,
  LoadingState,
  ErrorState,
  EmptyState,
} from "./CareDesignPrimitives";
import { apiClient } from "../../lib/apiClient";

type Role = "OWNER" | "ADMIN" | "MEMBER";

interface Member {
  id: number;
  userId: number;
  username: string;
  fullName: string;
  email: string;
  role: Role;
  isActive: boolean;
  joinedAt: string;
}

interface Invitation {
  id: number;
  email: string;
  role: Role;
  status: string;
  invitedBy: string;
  expiresAt: string | null;
  createdAt: string;
}

const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Eigenaar",
  ADMIN: "Beheerder",
  MEMBER: "Lid",
};

const ROLE_ICON: Record<Role, typeof User> = {
  OWNER: ShieldCheck,
  ADMIN: Shield,
  MEMBER: User,
};

function RoleBadge({ role }: { role: Role }) {
  const tone = role === "OWNER" ? "purple" : role === "ADMIN" ? "blue" : "muted";
  return <CareBadge tone={tone}>{ROLE_LABELS[role]}</CareBadge>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}

export function GebruikersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("MEMBER");
  const [inviting, setInviting] = useState(false);

  const [actionInFlight, setActionInFlight] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.get<{ members: Member[]; invitations: Invitation[] }>("/care/api/members/");
      setMembers(data.members);
      setInvitations(data.invitations);
    } catch {
      setError("Kon gebruikerslijst niet laden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email) return;
    setInviting(true);
    try {
      const data = await apiClient.post<{ invitation: Invitation }>("/care/api/members/", { email, role: inviteRole });
      setInvitations(prev => [data.invitation, ...prev]);
      setInviteEmail("");
      toast.success(`Uitnodiging verstuurd naar ${email}.`);
    } catch (err: any) {
      const msg = err?.responseBody?.error || "Uitnodiging mislukt.";
      toast.error(msg);
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (member: Member, newRole: Role) => {
    if (newRole === member.role) return;
    setActionInFlight(member.id);
    try {
      const data = await apiClient.patch<{ member: Member }>(`/care/api/members/${member.id}/role/`, { role: newRole });
      setMembers(prev => prev.map(m => m.id === member.id ? data.member : m));
      toast.success(`Rol van ${member.fullName} gewijzigd naar ${ROLE_LABELS[newRole]}.`);
    } catch (err: any) {
      const msg = err?.responseBody?.error || "Rolwijziging mislukt.";
      toast.error(msg);
    } finally {
      setActionInFlight(null);
    }
  };

  const handleToggleActive = async (member: Member) => {
    setActionInFlight(member.id);
    try {
      const data = await apiClient.post<{ member: Member }>(`/care/api/members/${member.id}/activation/`, {
        activate: !member.isActive,
      });
      setMembers(prev => prev.map(m => m.id === member.id ? data.member : m));
      toast.success(data.member.isActive ? `${member.fullName} geactiveerd.` : `${member.fullName} gedeactiveerd.`);
    } catch (err: any) {
      const msg = err?.responseBody?.error || "Actie mislukt.";
      toast.error(msg);
    } finally {
      setActionInFlight(null);
    }
  };

  const handleInvitationAction = async (inv: Invitation, action: "revoke" | "resend") => {
    setActionInFlight(inv.id);
    try {
      await apiClient.post(`/care/api/invitations/${inv.id}/action/`, { action });
      if (action === "revoke") {
        setInvitations(prev => prev.filter(i => i.id !== inv.id));
        toast.success(`Uitnodiging voor ${inv.email} ingetrokken.`);
      } else {
        toast.success(`Uitnodiging opnieuw verstuurd naar ${inv.email}.`);
        load();
      }
    } catch (err: any) {
      const msg = err?.responseBody?.error || "Actie mislukt.";
      toast.error(msg);
    } finally {
      setActionInFlight(null);
    }
  };

  if (loading) return <LoadingState title="Gebruikers laden…" />;
  if (error) return (
    <ErrorState
      title={error}
      action={<Button size="sm" onClick={load}>Opnieuw proberen</Button>}
    />
  );

  const activeMembers = members.filter(m => m.isActive);
  const inactiveMembers = members.filter(m => !m.isActive);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-1">Gebruikers</h1>
        <p className="text-sm text-muted-foreground">Beheer leden, rollen en uitnodigingen van je organisatie.</p>
      </div>

      {/* Invite form */}
      <CareSection>
        <CareSectionHeader title="Nieuw lid uitnodigen" />
        <CareSectionBody>
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1">E-mailadres</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="naam@organisatie.nl"
                required
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="w-40">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Rol</label>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as Role)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="MEMBER">Lid</option>
                <option value="ADMIN">Beheerder</option>
                <option value="OWNER">Eigenaar</option>
              </select>
            </div>
            <Button type="submit" disabled={inviting} className="gap-2 shrink-0">
              <UserPlus className="h-4 w-4" />
              {inviting ? "Versturen…" : "Uitnodigen"}
            </Button>
          </form>
        </CareSectionBody>
      </CareSection>

      {/* Active members */}
      <CareSection>
        <CareSectionHeader
          title="Actieve leden"
          action={<CareBadge tone="emerald">{activeMembers.length}</CareBadge>}
        />
        <CareSectionBody>
          {activeMembers.length === 0 ? (
            <EmptyState title="Geen actieve leden" copy="Er zijn nog geen actieve leden in deze organisatie." />
          ) : (
            <div className="divide-y divide-border">
              {activeMembers.map(member => {
                const RoleIcon = ROLE_ICON[member.role];
                const busy = actionInFlight === member.id;
                return (
                  <div key={member.id} className="flex items-center gap-4 py-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                      <RoleIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{member.fullName}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <select
                        value={member.role}
                        onChange={e => handleRoleChange(member, e.target.value as Role)}
                        disabled={busy}
                        className="rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                      >
                        <option value="MEMBER">Lid</option>
                        <option value="ADMIN">Beheerder</option>
                        <option value="OWNER">Eigenaar</option>
                      </select>
                      <span className="hidden sm:block text-xs text-muted-foreground">
                        Lid sinds {formatDate(member.joinedAt)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => handleToggleActive(member)}
                        className="text-xs text-destructive hover:text-destructive"
                      >
                        Deactiveren
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CareSectionBody>
      </CareSection>

      {/* Inactive members */}
      {inactiveMembers.length > 0 && (
        <CareSection>
          <CareSectionHeader
            title="Gedeactiveerde leden"
            action={<CareBadge tone="muted">{inactiveMembers.length}</CareBadge>}
          />
          <CareSectionBody>
            <div className="divide-y divide-border">
              {inactiveMembers.map(member => {
                const busy = actionInFlight === member.id;
                return (
                  <div key={member.id} className="flex items-center gap-4 py-3 opacity-60">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{member.fullName}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <RoleBadge role={member.role} />
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => handleToggleActive(member)}
                        className="text-xs"
                      >
                        Heractiveren
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CareSectionBody>
        </CareSection>
      )}

      {/* Pending invitations */}
      <CareSection>
        <CareSectionHeader
          title="Openstaande uitnodigingen"
          action={invitations.length > 0 ? <CareBadge tone="amber">{invitations.length}</CareBadge> : undefined}
        />
        <CareSectionBody>
          {invitations.length === 0 ? (
            <EmptyState title="Geen openstaande uitnodigingen" copy="Alle uitnodigingen zijn geaccepteerd of ingetrokken." />
          ) : (
            <div className="divide-y divide-border">
              {invitations.map(inv => {
                const busy = actionInFlight === inv.id;
                return (
                  <div key={inv.id} className="flex items-center gap-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{inv.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Uitgenodigd door {inv.invitedBy}
                        {inv.expiresAt && ` · verloopt ${formatDate(inv.expiresAt)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <RoleBadge role={inv.role} />
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => handleInvitationAction(inv, "resend")}
                        className="text-xs"
                      >
                        Opnieuw sturen
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => handleInvitationAction(inv, "revoke")}
                        className="text-xs text-destructive hover:text-destructive"
                      >
                        Intrekken
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CareSectionBody>
      </CareSection>
    </div>
  );
}
