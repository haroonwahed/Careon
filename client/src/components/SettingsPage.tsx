import { useState } from "react";
import { Eye, EyeOff, Check, X, CreditCard, Download, AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { toast } from "sonner@2.0.3";
import { Language, t } from "../lib/i18n";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";

interface SettingsPageProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  theme: "light" | "dark";
  onThemeChange: (theme: "light" | "dark") => void;
  initialTab?: "profile" | "security" | "preferences" | "employee" | "subscription";
}

export function SettingsPage({ language, onLanguageChange, theme, onThemeChange, initialTab = "profile" }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  
  // Profile state
  const [username, setUsername] = useState("alice_paris");
  const [email, setEmail] = useState("alice@example.com");
  const [profileChanged, setProfileChanged] = useState(false);
  
  // Security state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Preferences state
  const [themePreference, setThemePreference] = useState<"light" | "dark" | "system">(theme);
  
  // Employee state
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [permissions, setPermissions] = useState([
    { id: "dashboard", label: language === "fr" ? "Tableau de bord" : "Dashboard", checked: true },
    { id: "orders", label: language === "fr" ? "Mes commandes" : "My orders", checked: true },
    { id: "notifications", label: "Notifications", checked: true },
    { id: "messages", label: "Messages", checked: true },
    { id: "launcher", label: language === "fr" ? "Lanceur de comptes" : "Account launcher", checked: true },
    { id: "publisher", label: language === "fr" ? "Publication d'annonces" : "Publisher", checked: true },
    { id: "published", label: "published", checked: true },
    { id: "stock", label: language === "fr" ? "Gestion du stock" : "Stock manager", checked: true },
  ]);
  const [employees] = useState([
    {
      id: "emp_001",
      email: "ravelosonfanou@gmail.com",
      role: "Employee",
      accessPages: 10,
    },
  ]);
  const [editEmployeeModalOpen, setEditEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<typeof employees[0] | null>(null);
  const [editPermissions, setEditPermissions] = useState(permissions);
  
  // Subscription state
  const [currentPlan, setCurrentPlan] = useState("pro");
  const [selectedPlan, setSelectedPlan] = useState("pro");
  const [subscriptionStatus, setSubscriptionStatus] = useState<"active" | "trial" | "pastDue" | "canceled">("active");
  
  // Mock billing history
  const billingHistory = [
    { id: "INV-2025-001", date: "2025-10-01", amount: "€49.00", status: "paid" },
    { id: "INV-2025-002", date: "2025-09-01", amount: "€49.00", status: "paid" },
    { id: "INV-2025-003", date: "2025-08-01", amount: "€49.00", status: "paid" },
  ];
  
  const plans = [
    {
      id: "starter",
      name: t(language, "subscription.starter"),
      price: "€19.90",
      features: [
        t(language, "subscription.upToAccounts", { count: "2" }),
        t(language, "subscription.performanceDashboard"),
        t(language, "subscription.messagesNotifications"),
        t(language, "subscription.ordersManagement"),
        t(language, "subscription.stockManager"),
        t(language, "subscription.support247"),
      ],
    },
    {
      id: "pro",
      name: t(language, "subscription.pro"),
      price: "€44.90",
      popular: true,
      features: [
        t(language, "subscription.upToAccounts", { count: "5" }),
        t(language, "subscription.responseRate"),
        t(language, "subscription.messagesNotifications"),
        t(language, "subscription.ordersManagement"),
        t(language, "subscription.stockManager"),
        t(language, "subscription.autoPublishingLimit", { count: "200" }),
        t(language, "subscription.autoOffersLimit", { count: "500" }),
        t(language, "subscription.support247"),
      ],
    },
    {
      id: "scale",
      name: t(language, "subscription.scale"),
      price: "€79.90",
      features: [
        t(language, "subscription.upToAccounts", { count: "20" }),
        t(language, "subscription.responseRate"),
        t(language, "subscription.messagesNotifications"),
        t(language, "subscription.ordersManagement"),
        t(language, "subscription.stockManager"),
        t(language, "subscription.autoPublishingUnlimited"),
        t(language, "subscription.autoOffersUnlimited"),
        t(language, "subscription.support247"),
      ],
    },
  ];

  const handleProfileSave = () => {
    // Simulate save
    setTimeout(() => {
      toast.success("Profile updated successfully");
      setProfileChanged(false);
    }, 500);
  };

  const handlePasswordUpdate = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields");
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    
    // Simulate password update
    setTimeout(() => {
      toast.success("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }, 500);
  };

  const getPasswordStrength = (password: string): { strength: number; label: string; color: string } => {
    if (!password) return { strength: 0, label: "", color: "" };
    
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    
    if (strength <= 2) return { strength, label: "Weak", color: "bg-red-500" };
    if (strength <= 3) return { strength, label: "Fair", color: "bg-amber-500" };
    if (strength <= 4) return { strength, label: "Good", color: "bg-emerald-500" };
    return { strength, label: "Strong", color: "bg-emerald-600" };
  };

  const passwordStrength = getPasswordStrength(newPassword);
  
  const handlePlanUpdate = () => {
    setTimeout(() => {
      setCurrentPlan(selectedPlan);
      toast.success(
        language === "fr"
          ? "Forfait mis à jour avec succès"
          : "Plan updated successfully"
      );
    }, 500);
  };
  
  const handleCancelSubscription = () => {
    setTimeout(() => {
      setSubscriptionStatus("canceled");
      toast.success(
        language === "fr"
          ? "Abonnement annulé. Renouvellement désactivé."
          : "Subscription canceled. Renewal turned off."
      );
    }, 500);
  };
  
  const getStatusBadge = () => {
    const variants: Record<typeof subscriptionStatus, { label: string; className: string }> = {
      active: {
        label: t(language, "subscription.active"),
        className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      },
      trial: {
        label: t(language, "subscription.trial"),
        className: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
      },
      pastDue: {
        label: t(language, "subscription.pastDue"),
        className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      },
      canceled: {
        label: t(language, "subscription.canceled"),
        className: "bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/20",
      },
    };
    
    return variants[subscriptionStatus];
  };

  return (
    <div>
      {/* Header */}
      <div className="border-b border-border bg-background pb-6 mb-6">
        <div className="flex items-start justify-between">
          <h1 className="text-foreground mb-2">{t(language, "nav.settings")}</h1>
          <Button
            variant="outline"
            className="gap-2 rounded-full px-5 h-10 border-[1.5px] dark:border-primary/30 border-primary/40 dark:bg-transparent bg-white/50 dark:text-foreground/90 text-foreground dark:hover:bg-primary/10 hover:bg-primary/5 dark:hover:border-primary/50 hover:border-primary/60 dark:hover:shadow-[0_0_15px_rgba(124,58,237,0.2)] hover:shadow-[0_0_12px_rgba(124,58,237,0.15)] transition-all duration-200"
            onClick={() => {
              toast.success(
                language === "fr"
                  ? "Retour à la page précédente"
                  : "Returning to previous page"
              );
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            {language === "fr" ? "Quitter les paramètres" : "Exit settings"}
          </Button>
        </div>
      </div>

      <div className="max-w-4xl">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="rounded-2xl mb-6">
            <TabsTrigger value="profile" className="rounded-xl">
              {t(language, "settings.profile")}
            </TabsTrigger>
            <TabsTrigger value="security" className="rounded-xl">
              {t(language, "settings.security")}
            </TabsTrigger>
            <TabsTrigger value="preferences" className="rounded-xl">
              {t(language, "settings.preferences")}
            </TabsTrigger>
            <TabsTrigger value="employee" className="rounded-xl">
              {language === "fr" ? "Employé(e)" : "Employee"}
            </TabsTrigger>
            <TabsTrigger value="subscription" className="rounded-xl">
              {t(language, "settings.subscription")}
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="text-foreground mb-6">{t(language, "settings.profile")}</h2>
              
              <div className="space-y-6">
                {/* Username */}
                <div className="space-y-2">
                  <Label htmlFor="username">{t(language, "settings.username")}</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setProfileChanged(true);
                    }}
                    className="rounded-xl"
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">{t(language, "settings.email")}</Label>
                  <div className="flex gap-3">
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setProfileChanged(true);
                      }}
                      className="rounded-xl flex-1"
                    />
                    <Button variant="outline" className="rounded-xl">
                      Verify
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    We'll send you a verification email
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handleProfileSave}
                    disabled={!profileChanged}
                    className="rounded-xl"
                  >
                    {t(language, "settings.save")}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setUsername("alice_paris");
                      setEmail("alice@example.com");
                      setProfileChanged(false);
                    }}
                    disabled={!profileChanged}
                    className="rounded-xl"
                  >
                    {t(language, "settings.cancel")}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="text-foreground mb-6">{t(language, "settings.security")}</h2>
              
              <div className="space-y-6">
                {/* Current Password */}
                <div className="space-y-2">
                  <Label htmlFor="current-password">
                    {t(language, "settings.currentPassword")}
                  </Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="rounded-xl pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div className="space-y-2">
                  <Label htmlFor="new-password">
                    {t(language, "settings.newPassword")}
                  </Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="rounded-xl pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  
                  {/* Password Strength Meter */}
                  {newPassword && (
                    <div className="space-y-2">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <div
                            key={level}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              level <= passwordStrength.strength
                                ? passwordStrength.color
                                : "bg-muted"
                            }`}
                          />
                        ))}
                      </div>
                      <p className={`text-xs ${
                        passwordStrength.strength <= 2 ? "text-red-500" :
                        passwordStrength.strength <= 3 ? "text-amber-500" :
                        "text-emerald-500"
                      }`}>
                        {passwordStrength.label}
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">
                    {t(language, "settings.confirmPassword")}
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="rounded-xl pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {confirmPassword && (
                    <div className="flex items-center gap-2 text-xs">
                      {newPassword === confirmPassword ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span className="text-emerald-500">Passwords match</span>
                        </>
                      ) : (
                        <>
                          <X className="w-3 h-3 text-red-500" />
                          <span className="text-red-500">Passwords do not match</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-4">
                  <Button onClick={handlePasswordUpdate} className="rounded-xl">
                    {t(language, "settings.updatePassword")}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences" className="space-y-6">
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="text-foreground mb-6">{t(language, "settings.preferences")}</h2>
              
              <div className="space-y-6">
                {/* Language */}
                <div className="space-y-2">
                  <Label htmlFor="language">{t(language, "settings.language")}</Label>
                  <Select
                    value={language}
                    onValueChange={(val) => {
                      onLanguageChange(val as Language);
                      toast.success(
                        val === "fr" 
                          ? "Langue changée en Français" 
                          : "Language changed to English"
                      );
                    }}
                  >
                    <SelectTrigger id="language" className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="en">{t(language, "settings.english")}</SelectItem>
                      <SelectItem value="fr">{t(language, "settings.french")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Theme */}
                <div className="space-y-2">
                  <Label htmlFor="theme">{t(language, "settings.theme")}</Label>
                  <Select
                    value={themePreference}
                    onValueChange={(val) => {
                      const newTheme = val as "light" | "dark" | "system";
                      setThemePreference(newTheme);
                      
                      if (newTheme !== "system") {
                        onThemeChange(newTheme);
                        toast.success(
                          language === "fr"
                            ? `Thème changé en ${newTheme === "dark" ? "sombre" : "clair"}`
                            : `Theme changed to ${newTheme}`
                        );
                      } else {
                        // For system, we'll use the current theme
                        toast.success(
                          language === "fr"
                            ? "Thème défini sur système"
                            : "Theme set to system preference"
                        );
                      }
                    }}
                  >
                    <SelectTrigger id="theme" className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="light">{t(language, "settings.light")}</SelectItem>
                      <SelectItem value="dark">{t(language, "settings.dark")}</SelectItem>
                      <SelectItem value="system">{t(language, "settings.system")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Employee Tab */}
          <TabsContent value="employee" className="space-y-6">
            <div className="bg-card border border-primary/30 rounded-2xl p-8">
              {/* Header */}
              <div className="mb-8">
                <h2 className="text-foreground mb-2">{language === "fr" ? "Employé(e)" : "Employee"}</h2>
                <p className="text-sm text-muted-foreground">
                  {language === "fr"
                    ? "Invitez un employé et choisissez les pages auxquelles il a accès."
                    : "Invite an employee and choose which pages they can access."}
                </p>
              </div>

              {/* Invitation form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <Label className="text-sm text-muted-foreground mb-2">
                    {language === "fr" ? "Email de l'employé" : "Employee email"}
                  </Label>
                  <Input
                    type="email"
                    value={employeeEmail}
                    onChange={(e) => setEmployeeEmail(e.target.value)}
                    placeholder="employee@email.com"
                    className="rounded-xl bg-background border-primary/30 focus:border-primary"
                  />
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground mb-2">
                    {language === "fr" ? "Nom et prénom" : "Full name"}
                  </Label>
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
                    <h3 className="text-foreground mb-1">
                      {language === "fr" ? "Restrictions d'accès" : "Access restrictions"}
                    </h3>
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
                    onClick={() => setPermissions(prev => prev.map(p => ({ ...p, checked: true })))}
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
                      onClick={() => setPermissions(prev => prev.map(p => p.id === permission.id ? { ...p, checked: !p.checked } : p))}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-primary/30 bg-background hover:bg-primary/5 transition-colors text-left"
                    >
                      <Checkbox
                        checked={permission.checked}
                        onCheckedChange={() => setPermissions(prev => prev.map(p => p.id === permission.id ? { ...p, checked: !p.checked } : p))}
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
                  onClick={() => {
                    setEmployeeEmail("");
                    setEmployeeName("");
                    setPermissions(prev => prev.map(p => ({ ...p, checked: true })));
                  }}
                  variant="ghost"
                  className="rounded-xl text-muted-foreground hover:text-foreground"
                >
                  {language === "fr" ? "Réinitialiser" : "Reset"}
                </Button>
                <Button
                  onClick={() => {
                    toast.success(language === "fr" ? "Employé créé avec succès" : "Employee created successfully");
                  }}
                  className="rounded-xl bg-primary hover:bg-primary/90 shadow-[0_0_16px_rgba(139,92,246,0.3)]"
                >
                  {language === "fr" ? "Créer l'employé" : "Create employee"}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Subscription Tab */}
          <TabsContent value="subscription" className="space-y-6">
            {/* Current Plan Card */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="text-foreground mb-6">{t(language, "subscription.currentPlan")}</h2>
              
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-foreground mb-1">
                      {plans.find(p => p.id === currentPlan)?.name}
                    </p>
                    <p className="text-muted-foreground">
                      {plans.find(p => p.id === currentPlan)?.price}{t(language, "subscription.perMonth")}
                    </p>
                  </div>
                  <Badge className={`${getStatusBadge().className} border`}>
                    {getStatusBadge().label}
                  </Badge>
                </div>
                
                <div className="pt-3 border-t border-border">
                  <p className="text-muted-foreground text-sm mb-2">
                    {t(language, "subscription.nextBilling")}
                  </p>
                  <p className="text-foreground">November 1, 2025</p>
                </div>
                
                <div className="pt-3 border-t border-border">
                  <p className="text-muted-foreground text-sm mb-3">
                    {t(language, "subscription.features")}
                  </p>
                  <ul className="space-y-2">
                    {plans.find(p => p.id === currentPlan)?.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm text-foreground">
                        <Check className="w-4 h-4 text-emerald-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Change Plan Card */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="text-foreground mb-6">{t(language, "subscription.changePlan")}</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`relative border-2 rounded-2xl p-6 transition-all ${
                      selectedPlan === plan.id
                        ? "border-primary bg-primary/5 shadow-lg shadow-primary/20"
                        : "border-border hover:border-primary/50"
                    } ${
                      plan.id === currentPlan ? "ring-2 ring-emerald-500/50" : ""
                    }`}
                  >
                    {/* Popular badge */}
                    {(plan as any).popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-primary text-primary-foreground px-3 py-1 border-0">
                          {t(language, "subscription.mostPopular")}
                        </Badge>
                      </div>
                    )}
                    
                    {/* Current plan badge */}
                    {plan.id === currentPlan && (
                      <div className="absolute -top-3 right-4">
                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                          {t(language, "subscription.currentPlanBadge")}
                        </Badge>
                      </div>
                    )}
                    
                    <div className="space-y-4">
                      {/* Plan header */}
                      <div>
                        <h3 className="text-foreground mb-2">{plan.name}</h3>
                        <div className="flex items-baseline gap-1">
                          <span className="text-[#C8A9FF] text-2xl">{plan.price}</span>
                          <span className="text-muted-foreground text-sm">
                            {t(language, "subscription.perMonth")}
                          </span>
                        </div>
                      </div>
                      
                      {/* Features */}
                      <ul className="space-y-3">
                        {plan.features.map((feature, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      
                      {/* Action button */}
                      <Button
                        onClick={() => {
                          setSelectedPlan(plan.id);
                          if (plan.id !== currentPlan) {
                            handlePlanUpdate();
                          }
                        }}
                        disabled={plan.id === currentPlan}
                        className="w-full rounded-xl"
                        variant={selectedPlan === plan.id ? "default" : "outline"}
                      >
                        {plan.id === currentPlan
                          ? t(language, "subscription.currentPlanBadge")
                          : t(language, "subscription.choosePlan")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              <p className="text-xs text-muted-foreground mt-6 text-center">
                {t(language, "subscription.planChangeImmediate")}
              </p>
            </div>

            {/* Payment Method Card */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="text-foreground mb-6">{t(language, "subscription.paymentMethod")}</h2>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 border border-border rounded-xl">
                  <CreditCard className="w-6 h-6 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-foreground">Visa •••• 4242</p>
                    <p className="text-muted-foreground text-sm">Expires 12/2026</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <Button variant="outline" className="rounded-xl">
                    {t(language, "subscription.updatePaymentMethod")}
                  </Button>
                  
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="outline" className="rounded-xl gap-2">
                        <Download className="w-4 h-4" />
                        {t(language, "subscription.billingHistory")}
                      </Button>
                    </SheetTrigger>
                    <SheetContent className="w-full sm:max-w-2xl">
                      <SheetHeader>
                        <SheetTitle>{t(language, "subscription.billingHistory")}</SheetTitle>
                      </SheetHeader>
                      <div className="mt-6">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t(language, "subscription.invoiceNumber")}</TableHead>
                              <TableHead>{t(language, "subscription.date")}</TableHead>
                              <TableHead>{t(language, "subscription.amount")}</TableHead>
                              <TableHead>{t(language, "subscription.status")}</TableHead>
                              <TableHead></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {billingHistory.map((invoice) => (
                              <TableRow key={invoice.id}>
                                <TableCell>{invoice.id}</TableCell>
                                <TableCell>{invoice.date}</TableCell>
                                <TableCell>{invoice.amount}</TableCell>
                                <TableCell>
                                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                                    {t(language, "subscription.paid")}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="sm" className="rounded-lg gap-2">
                                    <Download className="w-3 h-3" />
                                    {t(language, "subscription.download")}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              </div>
            </div>

            {/* Cancel Subscription Card */}
            {subscriptionStatus !== "canceled" && (
              <div className="bg-card border border-border rounded-2xl p-6">
                <h2 className="text-foreground mb-6">{t(language, "subscription.cancelSubscription")}</h2>
                
                <p className="text-muted-foreground mb-6">
                  {t(language, "subscription.cancelAnytime")}
                </p>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="rounded-xl border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/10">
                      {t(language, "subscription.cancelSubscription")}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                      <div className="flex items-center gap-3 mb-2">
                        <AlertCircle className="w-6 h-6 text-amber-500" />
                        <AlertDialogTitle>{t(language, "subscription.confirmCancel")}</AlertDialogTitle>
                      </div>
                      <AlertDialogDescription>
                        {language === "fr"
                          ? "Votre abonnement restera actif jusqu'à la fin de votre période de facturation actuelle. Vous ne serez plus facturé après cette date."
                          : "Your subscription will remain active until the end of your current billing period. You won't be charged after that date."}
                      </AlertDialogDescription>
                      
                      <div className="pt-4">
                        <Label htmlFor="cancel-reason" className="text-sm">
                          {t(language, "subscription.cancelReason")}
                        </Label>
                        <Select>
                          <SelectTrigger id="cancel-reason" className="rounded-xl mt-2">
                            <SelectValue placeholder={language === "fr" ? "Sélectionner une raison" : "Select a reason"} />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="expensive">{language === "fr" ? "Trop cher" : "Too expensive"}</SelectItem>
                            <SelectItem value="not-needed">{language === "fr" ? "N'en ai plus besoin" : "No longer needed"}</SelectItem>
                            <SelectItem value="missing-features">{language === "fr" ? "Fonctionnalités manquantes" : "Missing features"}</SelectItem>
                            <SelectItem value="other">{language === "fr" ? "Autre" : "Other"}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-xl">
                        {t(language, "subscription.keepSubscription")}
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleCancelSubscription}
                        className="rounded-xl bg-red-600 hover:bg-red-700"
                      >
                        {t(language, "subscription.confirmCancellation")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}