import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { 
  HomeIcon, 
  ArrowLeftRightIcon, 
  FileTextIcon,
  PieChartIcon 
} from "lucide-react";
import { UserButton } from "./user-button";

const navigationItems = [
  {
    href: "/",
    label: "Dashboard",
    icon: HomeIcon,
  },
  {
    href: "/movimentacoes",
    label: "Movimentações",
    icon: ArrowLeftRightIcon,
  },
  {
    href: "/relatorios",
    label: "Relatórios",
    icon: FileTextIcon,
  },
];

export function Navigation() {
  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-6">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <PieChartIcon className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg">Tesouraria DeMolay</span>
            </div>
            
            <div className="hidden md:flex items-center gap-1">
              {navigationItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    "hover:bg-muted hover:text-foreground",
                    "text-muted-foreground"
                  )}
                  activeProps={{
                    className: "bg-muted text-foreground"
                  }}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <UserButton />
        </div>
      </div>
    </nav>
  );
}
