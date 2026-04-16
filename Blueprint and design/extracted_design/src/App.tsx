import { useState, useEffect } from "react";
import { Toaster } from "./components/ui/sonner";
import { ModernSidebar, Page } from "./components/ModernSidebar";
import { ModernTopbar } from "./components/ModernTopbar";
import { DashboardPage } from "./components/DashboardPage";
import { OrdersPageNew } from "./components/OrdersPageNew";
import { MyPurchasesPage } from "./components/MyPurchasesPage";
import { SettingsPage } from "./components/SettingsPage";
import { NotificationsPage } from "./components/NotificationsPage";
import { MessagesPageNew } from "./components/MessagesPageNew";
import { AccountLauncherPage } from "./components/AccountLauncherPage";
import { StockManagerPage } from "./components/StockManagerPage";
import { ListingsPublisherPage } from "./components/ListingsPublisherPage";
import { PublishedListingsPageNew } from "./components/PublishedListingsPageNew";
import { WalletPage } from "./components/WalletPage";
import { TrackingProductsPage } from "./components/tracking/TrackingProductsPage";
import { TrackingVendorsPage } from "./components/tracking/TrackingVendorsPage";
import { TrackingPublicPage } from "./components/tracking/TrackingPublicPage";
import { DateRange } from "./components/PageHeader";
import { Language } from "./lib/i18n";

export default function App() {
  // Load theme from localStorage or default to dark
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const savedTheme = localStorage.getItem("theme");
    return (savedTheme === "light" || savedTheme === "dark") ? savedTheme : "dark";
  });
  
  // Load language from localStorage or default to en
  const [language, setLanguage] = useState<Language>(() => {
    const savedLanguage = localStorage.getItem("language");
    return (savedLanguage === "en" || savedLanguage === "fr") ? savedLanguage : "en";
  });
  
  // Load sidebar collapsed state from localStorage or default to false (expanded)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    const savedState = localStorage.getItem("sidebarCollapsed");
    return savedState === "true";
  });
  
  const [activePage, setActivePage] = useState<Page>("dashboard");
  const [dateRange, setDateRange] = useState<DateRange>("7days");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([
    "Boutique Alice",
    "Frip Tim",
    "Margo Vintage",
  ]);
  const [settingsTab, setSettingsTab] = useState<"profile" | "security" | "preferences" | "employee" | "subscription">("profile");

  // Persist theme to localStorage and apply to document
  useEffect(() => {
    localStorage.setItem("theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);
  
  // Persist language to localStorage
  useEffect(() => {
    localStorage.setItem("language", language);
  }, [language]);
  
  // Persist sidebar collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", sidebarCollapsed.toString());
  }, [sidebarCollapsed]);

  const handleThemeToggle = (newTheme: "light" | "dark") => {
    setTheme(newTheme);
  };
  
  const handleGlobalRefresh = async () => {
    // Simulate refreshing all data across the app
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return Promise.resolve();
  };
  
  const handleToggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <div className="min-h-screen bg-background">
      <ModernSidebar 
        activePage={activePage} 
        onPageChange={setActivePage} 
        language={language}
        onGlobalRefresh={handleGlobalRefresh}
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />
      
      <ModernTopbar 
        theme={theme} 
        language={language}
        onThemeChange={handleThemeToggle}
        onLanguageChange={setLanguage}
        onNavigateToSettings={() => setActivePage("settings")}
        onNavigateToSubscription={() => {
          setSettingsTab("subscription");
          setActivePage("settings");
        }}
        sidebarCollapsed={sidebarCollapsed}
      />
      
      <Toaster theme={theme} position="top-right" richColors />
      
      <div 
        className={`transition-all duration-300 ${
          sidebarCollapsed ? "ml-[72px]" : "ml-[240px]"
        }`}
      >
        {/* Full-height pages with proper wrapper */}
        {(activePage === "launcher" || activePage === "published" || activePage === "messages") && (
          <>
            {activePage === "launcher" && (
              <div className="pt-16">
                <div className="max-w-[1400px] mx-auto px-6 py-8">
                  <AccountLauncherPage language={language} />
                </div>
              </div>
            )}
            
            {activePage === "published" && (
              <div className="pt-16">
                <div className="max-w-[1400px] mx-auto px-6 py-8">
                  <PublishedListingsPageNew language={language} />
                </div>
              </div>
            )}
            
            {activePage === "messages" && (
              <div className="pt-16 h-screen">
                <div className="h-[calc(100vh-4rem)] px-6">
                  <MessagesPageNew language={language} />
                </div>
              </div>
            )}
          </>
        )}
        
        {/* Regular pages with padding */}
        {activePage !== "launcher" && activePage !== "published" && activePage !== "messages" && (
          <main className="pt-16">
            <div className="max-w-[1400px] mx-auto px-6 py-8">
              {activePage === "dashboard" && (
                <DashboardPage
                  dateRange={dateRange}
                  onDateRangeChange={setDateRange}
                  selectedAccounts={selectedAccounts}
                  onAccountsChange={setSelectedAccounts}
                  language={language}
                />
              )}
              
              {activePage === "orders" && (
                <OrdersPageNew language={language} />
              )}
              
              {activePage === "notifications" && (
                <NotificationsPage language={language} />
              )}
              
              {activePage === "publisher" && (
                <ListingsPublisherPage language={language} />
              )}
              
              {activePage === "stock" && (
                <StockManagerPage language={language} />
              )}
              
              {activePage === "settings" && (
                <SettingsPage
                  language={language}
                  onLanguageChange={setLanguage}
                  theme={theme}
                  onThemeChange={setTheme}
                  initialTab={settingsTab}
                />
              )}
              
              {activePage === "wallet" && (
                <WalletPage 
                  language={language} 
                  onNavigateToMessages={() => setActivePage("messages")}
                />
              )}
              
              {activePage === "purchases" && (
                <MyPurchasesPage language={language} />
              )}
              
              {activePage === "tracking-products" && (
                <TrackingProductsPage language={language} />
              )}
              
              {activePage === "tracking-vendors" && (
                <TrackingVendorsPage language={language} />
              )}
              
              {activePage === "tracking-public" && (
                <TrackingPublicPage language={language} />
              )}
            </div>
          </main>
        )}
      </div>
    </div>
  );
}