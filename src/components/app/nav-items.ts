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
export type NavGroup = { label: string; items: NavItem[] };

// Only modules that ship in this release appear here. Groups follow how a search actually goes: keep track, get ready, decide.
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Track",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/action-center", label: "Action Center", icon: ListChecks },
      { href: "/applications", label: "Applications", icon: BriefcaseBusiness },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/tasks", label: "Tasks", icon: CheckSquare },
      { href: "/contacts", label: "Contacts & Referrals", icon: Users },
    ],
  },
  {
    label: "Prepare",
    items: [
      { href: "/jobs", label: "Job Capture", icon: ScanSearch },
      { href: "/resume", label: "Resume Studio", icon: FileText },
      { href: "/cover-letter", label: "Cover Letter Studio", icon: FileSignature },
      { href: "/documents", label: "Document Vault", icon: FolderOpen },
      { href: "/evidence", label: "Evidence library", icon: Layers },
    ],
  },
  {
    label: "Decide",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/offers", label: "Offers", icon: HandCoins },
      { href: "/planner", label: "Career planner", icon: Compass },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = { href: "/settings", label: "Settings", icon: Settings };

/** Flat list, used by the search palette. */
export const NAV_ITEMS: NavItem[] = [...NAV_GROUPS.flatMap((g) => g.items), SETTINGS_ITEM];
