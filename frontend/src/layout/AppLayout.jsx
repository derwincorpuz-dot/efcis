import React, { useEffect, useState } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  ChevronLeft, ChevronRight, FileText, Wallet, ClipboardList,
  CalendarClock, FolderKanban, Settings, LogOut, ShieldCheck, Menu
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ROLES, api } from "@/lib/api";

const NAV = [
  { to: "/loan-application", label: "Loan Application", icon: FileText, testid: "sidebar-loan-application" },
  { to: "/loan-management", label: "Loan Management", icon: FolderKanban, testid: "sidebar-loan-management" },
  { to: "/payments", label: "Payments", icon: Wallet, testid: "sidebar-payments" },
  { to: "/forms", label: "Forms", icon: ClipboardList, testid: "sidebar-forms" },
  { to: "/attendance", label: "Attendance", icon: CalendarClock, testid: "sidebar-attendance" },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [now, setNow] = useState(new Date());
  const [logo, setLogo] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    api.get("/settings").then((r) => setLogo(r.data?.logo_data_url || null)).catch(() => {});
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const pageTitle = (() => {
    const item = NAV.find((n) => location.pathname.startsWith(n.to));
    if (item) return item.label;
    if (location.pathname.startsWith("/settings")) return "Settings";
    return "Dashboard";
  })();

  const onLogout = () => { logout(); navigate("/login"); };

  const initials = (user?.name || "U").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  const sidebarWidth = collapsed ? "w-20" : "w-64";

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        data-testid="sidebar"
        className={`${sidebarWidth} ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} fixed lg:sticky top-0 h-screen bg-white border-r border-slate-200 z-50 transition-all duration-300 ease-in-out flex flex-col`}
      >
        <div className="h-16 flex items-center gap-3 px-4 border-b border-slate-100">
          <div className="w-9 h-9 rounded-lg efcis-gradient flex items-center justify-center shadow-md shadow-green-500/20 shrink-0 overflow-hidden">
            {logo ? <img src={logo} alt="Logo" className="w-full h-full object-cover" /> : <ShieldCheck className="w-5 h-5 text-white" />}
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-extrabold text-slate-900 font-heading">EFCIS LMS</span>
              <span className="text-[10px] uppercase tracking-wider text-slate-400">Loan System</span>
            </div>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              data-testid={item.testid}
              className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
            >
              <item.icon className="w-5 h-5 shrink-0" strokeWidth={2} />
              {!collapsed && <span className="text-sm">{item.label}</span>}
            </NavLink>
          ))}
          {user?.role === "admin" && (
            <NavLink
              to="/settings"
              data-testid="sidebar-settings"
              className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
            >
              <Settings className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="text-sm">Settings</span>}
            </NavLink>
          )}
        </nav>

        <div className="p-3 border-t border-slate-100 hidden lg:block">
          <button
            onClick={() => setCollapsed((v) => !v)}
            data-testid="sidebar-collapse-toggle"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-all duration-200"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : (<><ChevronLeft className="w-4 h-4" /><span className="text-xs">Collapse</span></>)}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200">
          <div className="h-16 flex items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setMobileOpen(true)}
                className="lg:hidden p-2 rounded-lg hover:bg-slate-100"
                data-testid="header-mobile-menu"
              >
                <Menu className="w-5 h-5 text-slate-700" />
              </button>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 font-heading truncate" data-testid="page-title">
                {pageTitle}
              </h2>
            </div>

            <div className="flex items-center gap-3 sm:gap-5">
              <div className="hidden sm:flex flex-col items-end leading-tight" data-testid="header-datetime">
                <span className="text-sm font-mono font-semibold text-slate-800">
                  {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <span className="text-[11px] text-slate-500">
                  {now.toLocaleDateString([], { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
                </span>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button data-testid="header-user-menu" className="flex items-center gap-2 px-2 py-1.5 rounded-full hover:bg-slate-100 transition-all">
                    <Avatar className="w-9 h-9 ring-2 ring-green-100">
                      <AvatarFallback className="efcis-gradient text-white font-semibold text-sm">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="hidden md:flex flex-col items-start leading-tight">
                      <span className="text-sm font-semibold text-slate-800">{user?.name}</span>
                      <span className="text-[10px] uppercase tracking-wider text-green-700 font-bold">{ROLES[user?.role] || user?.role}</span>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">{user?.name}</span>
                      <span className="text-xs text-slate-500">{user?.email}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onLogout} data-testid="header-logout-button" className="text-red-600 focus:text-red-700">
                    <LogOut className="w-4 h-4 mr-2" /> Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8" data-testid="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
