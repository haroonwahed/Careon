import { ReactNode, useState } from "react";
import { Menu, X } from "lucide-react";
import { Language } from "../../lib/i18n";

interface TrackingLayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
  language: Language;
}

export function TrackingLayout({ sidebar, children, language }: TrackingLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Left Panel */}
      <div
        className={`
          fixed lg:relative inset-y-0 left-0 z-50
          w-[320px] lg:w-[360px]
          dark:bg-[#0A0A10] bg-background
          border-r dark:border-[rgba(168,85,247,0.15)] border-border
          transform transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Mobile close button */}
        <button
          onClick={() => setIsSidebarOpen(false)}
          className="absolute top-4 right-4 lg:hidden p-2 rounded-lg dark:text-[#9CA3AF] text-muted-foreground hover:dark:bg-[#1A1A24] hover:bg-muted/50"
        >
          <X className="w-5 h-5" />
        </button>

        {sidebar}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        {/* Mobile hamburger button */}
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="lg:hidden fixed bottom-6 left-6 z-30 p-3 rounded-full dark:bg-primary bg-primary dark:text-white text-white shadow-lg"
          style={{
            boxShadow: "0 0 24px rgba(139,92,246,0.4)",
          }}
        >
          <Menu className="w-6 h-6" />
        </button>

        {children}
      </div>
    </div>
  );
}
