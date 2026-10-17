import {
  BriefcaseBusiness,
  CheckSquare,
  FileText,
  FolderOpen,
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
  { href: "/applications", label: "Applications", icon: BriefcaseBusiness },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/contacts", label: "Contacts & Referrals", icon: Users },
  { href: "/jobs", label: "Job Capture", icon: ScanSearch },
  { href: "/resume", label: "Resume Studio", icon: FileText },
  { href: "/documents", label: "Document Vault", icon: FolderOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];
