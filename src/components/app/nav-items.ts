import {
  BarChart3,
  ListChecks,
  BriefcaseBusiness,
  CalendarDays,
  CheckSquare,
  FileText,
  FileSignature,
  FolderOpen,
  Layers,
  HandCoins,
  Compass,
  LayoutDashboard,
  ScanSearch,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

// Only modules that ship in this release appear here.
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/action-center", label: "Action Center", icon: ListChecks },
  { href: "/applications", label: "Applications", icon: BriefcaseBusiness },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/contacts", label: "Contacts & Referrals", icon: Users },
  { href: "/jobs", label: "Job Capture", icon: ScanSearch },
  { href: "/resume", label: "Resume Studio", icon: FileText },
  { href: "/cover-letter", label: "Cover Letter Studio", icon: FileSignature },
  { href: "/documents", label: "Document Vault", icon: FolderOpen },
  { href: "/evidence", label: "Evidence library", icon: Layers },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/offers", label: "Offers", icon: HandCoins },
  { href: "/planner", label: "Career planner", icon: Compass },
  { href: "/settings", label: "Settings", icon: Settings },
];
