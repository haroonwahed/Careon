import { useState } from "react";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { MoreHorizontal } from "lucide-react";
import { Language } from "../lib/i18n";

interface EmployeeSettingsPageProps {
  language: Language;
  onLogout: () => void;
  onBack?: () => void;
}

type SettingsTab = "profile" | "security" | "preferences" | "employee" | "subscription";

interface Employee {
  id: string;
  email: string;
  role: string;
  accessPages: number;
}

interface PagePermission {
  id: string;
  label: string;
  checked: boolean;
}

export function EmployeeSettingsPage({ language, onLogout, onBack }: EmployeeSettingsPageProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("employee");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  
  const [permissions, setPermissions] = useState<PagePermission[]>([
    { id: "dashboard", label: language === "fr" ? "Tableau de bord" : "Dashboard", checked: true },
    { id: "orders", label: language === "fr" ? "Mes commandes" : "My orders", checked: true },
    { id: "notifications", label: "Notifications", checked: true },
    { id: "messages", label: "Messages", checked: true },
    { id: "launcher", label: language === "fr" ? "Lanceur de comptes" : "Account launcher", checked: true },
    { id: "publisher", label: language === "fr" ? "Publication d'annonces" : "Publisher", checked: true },
    { id: "published", label: "published", checked: true },
    { id: "stock", label: language === "fr" ? "Gestion du stock" : "Stock manager", checked: true },
  ]);

  const [employees] = useState<Employee[]>([
    {
      id: "emp_001",
      email: "ravelosonfanou@gmail.com",
      role: "Employee",
      accessPages: 10,
    },
  ]);

  const togglePermission = (id: string) => {
    setPermissions((prev) =>
      prev.map((p) => (p.id === id ? { ...p, checked: !p.checked } : p))
    );
  };

  const allowAll = () => {
    setPermissions((prev) => prev.map((p) => ({ ...p, checked: true })));
  };

  const resetForm = () => {
    setEmployeeEmail("");
    setEmployeeName("");
    setPermissions((prev) => prev.map((p) => ({ ...p, checked: true })));
  };

  const handleCreateEmployee = () => {
    console.log("Creating employee:", {
      email: employeeEmail,
      name: employeeName,
      permissions: permissions.filter((p) => p.checked).map((p) => p.id),
    });
  };

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "profile", label: language === "fr" ? "Profil" : "Profile" },
    { id: "security", label: language === "fr" ? "Sécurité" : "Security" },
    { id: "preferences", label: language === "fr" ? "Préférences" : "Preferences" },
    { id: "employee", label: language === "fr" ? "Employé(e)" : "Employee" },
    { id: "subscription", label: "Abonnement" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Topbar with tabs */}
      <div className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Tabs */}
            <div className="flex items-center gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-xl text-sm transition-all ${
                    activeTab === tab.id
                      ? "bg-primary text-white shadow-[0_0_12px_rgba(139,92,246,0.4)]"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Logout button */}
            <Button
              onClick={onLogout}
              variant="outline"
              className="rounded-xl border-primary/30 text-primary hover:bg-primary/10"
            >
              {language === "fr" ? "Se déconnecter" : "Log out"}
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-[1100px] mx-auto px-6 py-8">
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-b from-card to-card/50 p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-foreground mb-2">
              {language === "fr" ? "Employé(e)" : "Employee"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {language === "fr"
                ? "Invitez un employé et choisissez les pages auxquelles il a accès."
                : "Invite an employee and choose which pages they can access."}
            </p>
          </div>

          {/* Employees section */}
          <div className="mb-8">
            <h2 className="text-foreground mb-4">
              {language === "fr" ? "Employés" : "Employees"}
            </h2>

            {/* Table */}
            <div className="rounded-xl border border-border overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[2fr,1fr,1fr,auto] gap-4 px-6 py-3 bg-muted/30 border-b border-border">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Email</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Role</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Access</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Actions</div>
              </div>

              {/* Rows */}
              {employees.map((employee) => (
                <div
                  key={employee.id}
                  className="grid grid-cols-[2fr,1fr,1fr,auto] gap-4 px-6 py-4 hover:bg-primary/5 transition-colors"
                >
                  <div className="text-sm text-foreground">{employee.email}</div>
                  <div className="text-sm text-muted-foreground">{employee.role}</div>
                  <div className="text-sm text-muted-foreground">
                    {employee.accessPages} {language === "fr" ? "pages" : "pages"}
                  </div>
                  <button className="w-8 h-8 rounded-full border border-primary/30 flex items-center justify-center hover:bg-primary/10 transition-colors">
                    <MoreHorizontal className="w-4 h-4 text-primary" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Invitation form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                {language === "fr" ? "Email de l'employé" : "Employee email"}
              </label>
              <Input
                type="email"
                value={employeeEmail}
                onChange={(e) => setEmployeeEmail(e.target.value)}
                placeholder="employee@email.com"
                className="rounded-xl bg-background border-primary/30 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                {language === "fr" ? "Nom et prénom" : "Full name"}
              </label>
              <Input
                type="text"
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                placeholder={language === "fr" ? "Ex. Marie Dupont" : "Ex. John Doe"}
                className="rounded-xl bg-background border-primary/30 focus:border-primary"
              />
            </div>
          </div>

          {/* Access restrictions */}
          <div className="mb-8">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-foreground mb-1">
                  {language === "fr" ? "Restrictions d'accès" : "Access restrictions"}
                </h2>
                <p className="text-xs text-muted-foreground mb-1">
                  {language === "fr"
                    ? "Cochez les pages autorisées pour cet employé."
                    : "Check the pages allowed for this employee."}
                </p>
                <p className="text-xs text-muted-foreground italic">
                  {language === "fr" ? "Paramètres — toujours autorisé" : "Settings — always allowed"}
                </p>
              </div>
              <button
                onClick={allowAll}
                className="text-sm text-primary hover:text-primary/80 transition-colors"
              >
                {language === "fr" ? "Tout autoriser" : "Allow all"}
              </button>
            </div>

            {/* Permission chips grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {permissions.map((permission) => (
                <button
                  key={permission.id}
                  onClick={() => togglePermission(permission.id)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-primary/30 bg-background hover:bg-primary/5 transition-colors text-left"
                >
                  <Checkbox
                    checked={permission.checked}
                    onCheckedChange={() => togglePermission(permission.id)}
                    className="border-primary data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <span className="text-sm text-foreground">{permission.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex items-center gap-4">
            <Button
              onClick={resetForm}
              variant="ghost"
              className="rounded-xl text-muted-foreground hover:text-foreground"
            >
              {language === "fr" ? "Réinitialiser" : "Reset"}
            </Button>
            <Button
              onClick={handleCreateEmployee}
              className="rounded-xl bg-primary hover:bg-primary/90 shadow-[0_0_16px_rgba(139,92,246,0.3)]"
            >
              {language === "fr" ? "Créer l'employé" : "Create employee"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
