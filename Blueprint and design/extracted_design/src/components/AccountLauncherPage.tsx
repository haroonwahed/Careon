import { useState } from "react";
import { Play, Square, ExternalLink, Trash2, Plus, Lightbulb, Eye, EyeOff, Link } from "lucide-react";
import { mockProfiles, VintedProfile } from "../lib/accountsData";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
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
import { toast } from "sonner@2.0.3";

interface AccountLauncherPageProps {
  language: Language;
}

export function AccountLauncherPage({ language }: AccountLauncherPageProps) {
  const [profiles, setProfiles] = useState<VintedProfile[]>(mockProfiles);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<VintedProfile | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<VintedProfile | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    proxyHost: "",
    proxyPort: "",
    proxyUser: "",
    proxyPassword: "",
    vncPassword: "",
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showProxyPassword, setShowProxyPassword] = useState(false);
  const [showVncPassword, setShowVncPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleCreateProfile = () => {
    setEditingProfile(null);
    setFormData({
      name: "",
      email: "",
      password: "",
      proxyHost: "",
      proxyPort: "",
      proxyUser: "",
      proxyPassword: "",
      vncPassword: "",
    });
    setModalOpen(true);
  };

  const handleEditProfile = (profile: VintedProfile) => {
    setEditingProfile(profile);
    setFormData({
      name: profile.name,
      email: profile.email,
      password: profile.password,
      proxyHost: profile.proxy?.host || "",
      proxyPort: profile.proxy?.port || "",
      proxyUser: profile.proxy?.user || "",
      proxyPassword: profile.proxy?.password || "",
      vncPassword: profile.vncPassword || "",
    });
    setModalOpen(true);
  };

  const handleSaveProfile = () => {
    setIsSaving(true);
    
    setTimeout(() => {
      if (editingProfile) {
        // Update existing profile
        setProfiles(profiles.map(p => 
          p.id === editingProfile.id
            ? {
                ...p,
                name: formData.name,
                email: formData.email,
                password: formData.password,
                proxy: formData.proxyHost ? {
                  host: formData.proxyHost,
                  port: formData.proxyPort,
                  user: formData.proxyUser || undefined,
                  password: formData.proxyPassword || undefined,
                } : undefined,
                vncPassword: formData.vncPassword || undefined,
              }
            : p
        ));
        toast.success(t(language, "accountLauncher.toast.profileUpdated"));
      } else {
        // Create new profile
        const newProfile: VintedProfile = {
          id: `profile_${Date.now()}`,
          name: formData.name,
          username: formData.email.split("@")[0],
          email: formData.email,
          password: formData.password,
          avatar: formData.name.charAt(0).toUpperCase(),
          isConnected: false,
          isRunning: false,
          proxy: formData.proxyHost ? {
            host: formData.proxyHost,
            port: formData.proxyPort,
            user: formData.proxyUser || undefined,
            password: formData.proxyPassword || undefined,
          } : undefined,
          vncPassword: formData.vncPassword || undefined,
          createdAt: new Date(),
        };
        
        setProfiles([...profiles, newProfile]);
        toast.success(t(language, "accountLauncher.toast.profileCreated"));
      }
      
      setIsSaving(false);
      setModalOpen(false);
    }, 800);
  };

  const handleStartSession = (profile: VintedProfile) => {
    setProfiles(profiles.map(p => 
      p.id === profile.id
        ? { ...p, isRunning: true, lastSessionStart: new Date() }
        : p
    ));
    toast.success(t(language, "accountLauncher.toast.sessionStarted"));
  };

  const handleStopSession = (profile: VintedProfile) => {
    setProfiles(profiles.map(p => 
      p.id === profile.id
        ? { ...p, isRunning: false }
        : p
    ));
    toast.success(t(language, "accountLauncher.toast.sessionStopped"));
  };

  const handleConnect = (profile: VintedProfile) => {
    setProfiles(profiles.map(p => 
      p.id === profile.id
        ? { ...p, isConnected: true }
        : p
    ));
    toast.success(t(language, "accountLauncher.toast.connected"));
  };

  const handleDisconnect = (profile: VintedProfile) => {
    setProfiles(profiles.map(p => 
      p.id === profile.id
        ? { ...p, isConnected: false, isRunning: false }
        : p
    ));
    toast.success(t(language, "accountLauncher.toast.disconnected"));
  };

  const handleDeleteProfile = (profile: VintedProfile) => {
    setProfileToDelete(profile);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (profileToDelete) {
      setProfiles(profiles.filter(p => p.id !== profileToDelete.id));
      toast.success(t(language, "accountLauncher.toast.profileDeleted"));
    }
    setDeleteDialogOpen(false);
    setProfileToDelete(null);
  };

  const handleOpenVinted = (profile: VintedProfile) => {
    // In real app, this would open a new window with the Vinted session
    window.open("https://vinted.fr", "_blank");
  };

  return (
    <div className="h-screen flex flex-col dark:bg-[#0A0A0E] bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background px-6 pb-6 pt-6">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h1 className="text-foreground mb-2">{t(language, "accountLauncher.title")}</h1>
            <p className="text-sm dark:text-muted-foreground text-muted-foreground">
              {t(language, "accountLauncher.subtitle")}
            </p>
          </div>
        </div>
        
        {/* Primary CTA */}
        <Button
          onClick={handleCreateProfile}
          className="mt-4 rounded-xl gap-2 dark:bg-[#8B5CF6] bg-primary hover:dark:bg-[#7C3AED] hover:bg-primary/90"
          style={{
            boxShadow: "0 0 16px rgba(139,92,246,0.3)"
          }}
        >
          <Plus className="w-4 h-4" />
          {t(language, "accountLauncher.createProfile")}
        </Button>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Profile cards */}
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className="rounded-2xl border dark:border-[rgba(168,85,247,0.25)] border-border dark:bg-[#0E0E14] bg-card p-6 transition-all hover:shadow-[0_0_20px_rgba(139,92,246,0.2)]"
            >
              <div className="flex items-center gap-6">
                {/* Left: Identity */}
                <div className="flex items-center gap-4 min-w-[240px]">
                  {/* Avatar */}
                  <div className="w-14 h-14 rounded-full dark:bg-[rgba(139,92,246,0.20)] bg-primary/20 dark:text-[#A78BFA] text-primary flex items-center justify-center text-xl font-semibold border-2 dark:border-[rgba(168,85,247,0.40)] border-primary/40">
                    {profile.avatar}
                  </div>
                  
                  {/* Name + Email */}
                  <div className="flex-1 min-w-0">
                    <div className="dark:text-[#E7E7F0] text-foreground font-medium mb-0.5">
                      {profile.username}
                    </div>
                    <div className="text-sm dark:text-[#6B7280] text-muted-foreground">
                      {profile.name}
                    </div>
                  </div>
                </div>

                {/* Middle: Actions - ORDRE EXACT SELON LA PHOTO */}
                <div className="flex-1 flex items-center gap-2 flex-wrap">
                  {/* 1. Ouvrir interface Vinted (secondaire, icône external) */}
                  <Button
                    onClick={() => handleOpenVinted(profile)}
                    size="sm"
                    variant="outline"
                    className="rounded-lg gap-2 dark:border-[rgba(168,85,247,0.30)] border-border dark:text-[#E7E7F0] text-foreground hover:dark:bg-[rgba(168,85,247,0.10)] hover:bg-muted"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {t(language, "accountLauncher.profile.openVinted")}
                  </Button>

                  {/* 2. Connecter le profil (secondaire) */}
                  <Button
                    onClick={() => handleConnect(profile)}
                    disabled={profile.isConnected}
                    size="sm"
                    variant="outline"
                    className="rounded-lg gap-2 dark:border-[rgba(168,85,247,0.30)] border-border dark:text-[#E7E7F0] text-foreground hover:dark:bg-[rgba(168,85,247,0.10)] hover:bg-muted disabled:opacity-50"
                  >
                    <Link className="w-3.5 h-3.5" />
                    {t(language, "accountLauncher.profile.connect")}
                  </Button>

                  {/* 3. Arrêter Vinted (secondaire, désactivé si non running) */}
                  <Button
                    onClick={() => handleStopSession(profile)}
                    disabled={!profile.isRunning}
                    size="sm"
                    variant="outline"
                    className="rounded-lg gap-2 dark:border-[rgba(168,85,247,0.30)] border-border dark:text-[#E7E7F0] text-foreground hover:dark:bg-[rgba(168,85,247,0.10)] hover:bg-muted disabled:opacity-50"
                  >
                    <Square className="w-3.5 h-3.5" />
                    {t(language, "accountLauncher.profile.stopVinted")}
                  </Button>

                  {/* 4. Démarrer Vinted (primaire violet, icône play) */}
                  <Button
                    onClick={() => handleStartSession(profile)}
                    disabled={!profile.isConnected || profile.isRunning}
                    size="sm"
                    className="rounded-lg gap-2 dark:bg-[#8B5CF6] bg-primary dark:text-white text-white hover:dark:bg-[#7C3AED] hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={profile.isConnected && !profile.isRunning ? {
                      boxShadow: "0 0 12px rgba(139,92,246,0.4)"
                    } : undefined}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    {t(language, "accountLauncher.profile.startVinted")}
                  </Button>

                  {/* 5. Supprimer le profil (destructif rouge) */}
                  <Button
                    onClick={() => handleDeleteProfile(profile)}
                    size="sm"
                    className="rounded-lg gap-2 dark:bg-[rgba(220,38,38,0.90)] bg-red-500 dark:text-white text-white hover:dark:bg-[rgba(220,38,38,1)] hover:bg-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {t(language, "accountLauncher.profile.deleteProfile")}
                  </Button>
                </div>

                {/* Right: Status + Proxy info */}
                <div className="min-w-[200px] flex flex-col items-end gap-2">
                  {/* Status chips */}
                  <div className="flex flex-col items-end gap-1.5">
                    {/* Running/Stopped status */}
                    {profile.isRunning ? (
                      <Badge className="text-[10px] px-3 py-1 dark:bg-[rgba(42,240,122,0.20)] bg-green-500/20 dark:text-[#2AF07A] text-green-300 border dark:border-[#2AF07A] border-green-400">
                        {t(language, "accountLauncher.profile.statusRunning")}
                      </Badge>
                    ) : (
                      <Badge className="text-[10px] px-3 py-1 dark:bg-[rgba(251,191,36,0.20)] bg-orange-500/20 dark:text-[#FDE68A] text-orange-300 border dark:border-[#FBBF24] border-orange-400">
                        {t(language, "accountLauncher.profile.statusStopped")}
                      </Badge>
                    )}
                    
                    {/* Connection status */}
                    {profile.isConnected ? (
                      <Badge className="text-[10px] px-3 py-1 dark:bg-[rgba(42,240,122,0.20)] bg-green-500/20 dark:text-[#2AF07A] text-green-300 border dark:border-[#2AF07A] border-green-400">
                        {t(language, "accountLauncher.profile.statusConnected")}
                      </Badge>
                    ) : (
                      <Badge className="text-[10px] px-3 py-1 dark:bg-[rgba(251,113,133,0.20)] bg-red-500/20 dark:text-[#FCA5A5] text-red-300 border dark:border-[#FB7185] border-red-400">
                        {t(language, "accountLauncher.profile.statusDisconnected")}
                      </Badge>
                    )}
                  </div>

                  {/* Proxy info */}
                  <div className="text-xs dark:text-[#6B7280] text-muted-foreground text-right">
                    {profile.proxy ? (
                      <>
                        {t(language, "accountLauncher.profile.proxyHost")}: {profile.proxy.host} · {t(language, "accountLauncher.profile.proxyPort")}: {profile.proxy.port}
                      </>
                    ) : (
                      <>{t(language, "accountLauncher.profile.noProxy")}</>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Tip callout */}
          <div className="rounded-2xl border dark:border-[rgba(168,85,247,0.20)] border-border dark:bg-[rgba(139,92,246,0.05)] bg-primary/5 p-5 mt-8">
            <div className="flex gap-3">
              <Lightbulb className="w-5 h-5 dark:text-[#A78BFA] text-primary flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm dark:text-[#E7E7F0] text-foreground font-medium mb-1">
                  {t(language, "accountLauncher.tip.title")}
                </div>
                <div className="text-sm dark:text-[#9CA3AF] text-muted-foreground">
                  {t(language, "accountLauncher.tip.text")}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create/Edit Profile Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl rounded-2xl dark:bg-[#0E0E14] bg-card border dark:border-[rgba(168,85,247,0.25)] border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="dark:text-[#E7E7F0] text-foreground">
              {editingProfile
                ? t(language, "accountLauncher.modal.editTitle")
                : t(language, "accountLauncher.modal.createTitle")
              }
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Section 1: Credentials */}
            <div>
              <h3 className="text-sm dark:text-[#E7E7F0] text-foreground font-medium mb-4">
                {t(language, "accountLauncher.modal.sectionCredentials")}
              </h3>
              
              {/* Email */}
              <div className="mb-4">
                <label className="block text-sm dark:text-[#9CA3AF] text-muted-foreground mb-2">
                  {t(language, "accountLauncher.modal.email")}
                </label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder={t(language, "accountLauncher.modal.emailPlaceholder")}
                  className="rounded-xl dark:bg-[rgba(139,92,246,0.05)] bg-background dark:border-[rgba(168,85,247,0.25)] border-border"
                />
              </div>

              {/* Password */}
              <div className="mb-4">
                <label className="block text-sm dark:text-[#9CA3AF] text-muted-foreground mb-2">
                  {t(language, "accountLauncher.modal.password")}
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={t(language, "accountLauncher.modal.passwordPlaceholder")}
                    className="rounded-xl dark:bg-[rgba(139,92,246,0.05)] bg-background dark:border-[rgba(168,85,247,0.25)] border-border pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 dark:text-[#9CA3AF] text-muted-foreground hover:dark:text-[#E7E7F0] hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Security notes */}
              <div className="space-y-1">
                <p className="text-xs dark:text-[#6B7280] text-muted-foreground">
                  {t(language, "accountLauncher.modal.securityNote")}
                </p>
                <p className="text-xs dark:text-[#6B7280] text-muted-foreground">
                  {t(language, "accountLauncher.modal.encryptionNote")}
                </p>
                <button className="text-xs dark:text-[#A78BFA] text-primary hover:underline">
                  {t(language, "accountLauncher.modal.appPasswordLink")}
                </button>
              </div>
            </div>

            {/* Section 2: Proxy */}
            <div>
              <h3 className="text-sm dark:text-[#E7E7F0] text-foreground font-medium mb-4">
                {t(language, "accountLauncher.modal.sectionProxy")}
              </h3>

              <div className="grid grid-cols-2 gap-4">
                {/* Proxy host */}
                <div>
                  <label className="block text-sm dark:text-[#9CA3AF] text-muted-foreground mb-2">
                    {t(language, "accountLauncher.modal.proxyHost")}
                  </label>
                  <Input
                    value={formData.proxyHost}
                    onChange={(e) => setFormData({ ...formData, proxyHost: e.target.value })}
                    placeholder={t(language, "accountLauncher.modal.proxyHostPlaceholder")}
                    className="rounded-xl dark:bg-[rgba(139,92,246,0.05)] bg-background dark:border-[rgba(168,85,247,0.25)] border-border"
                  />
                </div>

                {/* Proxy port */}
                <div>
                  <label className="block text-sm dark:text-[#9CA3AF] text-muted-foreground mb-2">
                    {t(language, "accountLauncher.modal.proxyPort")}
                  </label>
                  <Input
                    value={formData.proxyPort}
                    onChange={(e) => setFormData({ ...formData, proxyPort: e.target.value })}
                    placeholder={t(language, "accountLauncher.modal.proxyPortPlaceholder")}
                    className="rounded-xl dark:bg-[rgba(139,92,246,0.05)] bg-background dark:border-[rgba(168,85,247,0.25)] border-border"
                  />
                </div>

                {/* Proxy user */}
                <div>
                  <label className="block text-sm dark:text-[#9CA3AF] text-muted-foreground mb-2">
                    {t(language, "accountLauncher.modal.proxyUser")}
                  </label>
                  <Input
                    value={formData.proxyUser}
                    onChange={(e) => setFormData({ ...formData, proxyUser: e.target.value })}
                    placeholder={t(language, "accountLauncher.modal.proxyUserPlaceholder")}
                    className="rounded-xl dark:bg-[rgba(139,92,246,0.05)] bg-background dark:border-[rgba(168,85,247,0.25)] border-border"
                  />
                </div>

                {/* Proxy password */}
                <div>
                  <label className="block text-sm dark:text-[#9CA3AF] text-muted-foreground mb-2">
                    {t(language, "accountLauncher.modal.proxyPassword")}
                  </label>
                  <div className="relative">
                    <Input
                      type={showProxyPassword ? "text" : "password"}
                      value={formData.proxyPassword}
                      onChange={(e) => setFormData({ ...formData, proxyPassword: e.target.value })}
                      placeholder={t(language, "accountLauncher.modal.proxyPasswordPlaceholder")}
                      className="rounded-xl dark:bg-[rgba(139,92,246,0.05)] bg-background dark:border-[rgba(168,85,247,0.25)] border-border pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowProxyPassword(!showProxyPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 dark:text-[#9CA3AF] text-muted-foreground hover:dark:text-[#E7E7F0] hover:text-foreground"
                    >
                      {showProxyPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Interface (ex-VNC) */}
            <div>
              <h3 className="text-sm dark:text-[#E7E7F0] text-foreground font-medium mb-2">
                {t(language, "accountLauncher.modal.sectionInterface")}
              </h3>
              <p className="text-xs dark:text-[#6B7280] text-muted-foreground mb-4">
                {t(language, "accountLauncher.modal.interfaceHelperText")}
              </p>

              <div>
                <label className="block text-sm dark:text-[#9CA3AF] text-muted-foreground mb-2">
                  {t(language, "accountLauncher.modal.interfacePassword")}
                </label>
                <div className="relative">
                  <Input
                    type={showVncPassword ? "text" : "password"}
                    value={formData.vncPassword}
                    onChange={(e) => setFormData({ ...formData, vncPassword: e.target.value })}
                    placeholder={t(language, "accountLauncher.modal.interfacePasswordPlaceholder")}
                    className="rounded-xl dark:bg-[rgba(139,92,246,0.05)] bg-background dark:border-[rgba(168,85,247,0.25)] border-border pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowVncPassword(!showVncPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 dark:text-[#9CA3AF] text-muted-foreground hover:dark:text-[#E7E7F0] hover:text-foreground"
                  >
                    {showVncPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Section 4: Profile name */}
            <div>
              <h3 className="text-sm dark:text-[#E7E7F0] text-foreground font-medium mb-4">
                {t(language, "accountLauncher.modal.sectionProfileName")}
              </h3>
              
              <div>
                <label className="block text-sm dark:text-[#9CA3AF] text-muted-foreground mb-2">
                  {t(language, "accountLauncher.modal.profileName")}
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t(language, "accountLauncher.modal.profileNamePlaceholder")}
                  className="rounded-xl dark:bg-[rgba(139,92,246,0.05)] bg-background dark:border-[rgba(168,85,247,0.25)] border-border"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t dark:border-[rgba(168,85,247,0.25)] border-border">
            <Button
              onClick={() => setModalOpen(false)}
              variant="outline"
              className="rounded-xl"
            >
              {t(language, "accountLauncher.modal.cancel")}
            </Button>
            <Button
              onClick={handleSaveProfile}
              disabled={isSaving || !formData.email || !formData.password || !formData.name}
              className="rounded-xl dark:bg-[#8B5CF6] bg-primary hover:dark:bg-[#7C3AED] hover:bg-primary/90"
              style={{
                boxShadow: "0 0 16px rgba(139,92,246,0.3)"
              }}
            >
              {isSaving
                ? t(language, "accountLauncher.modal.saving")
                : t(language, "accountLauncher.modal.save")
              }
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl dark:bg-[#0E0E14] bg-card border dark:border-[rgba(168,85,247,0.25)] border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-[#E7E7F0] text-foreground">
              {t(language, "accountLauncher.deleteConfirm.title")}
            </AlertDialogTitle>
            <AlertDialogDescription className="dark:text-[#9CA3AF] text-muted-foreground">
              {t(language, "accountLauncher.deleteConfirm.message")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">
              {t(language, "accountLauncher.deleteConfirm.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="rounded-xl dark:bg-[rgba(251,113,133,0.90)] bg-red-500 hover:dark:bg-[rgba(251,113,133,1)] hover:bg-red-600"
            >
              {t(language, "accountLauncher.deleteConfirm.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}