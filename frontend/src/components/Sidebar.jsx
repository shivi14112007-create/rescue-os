import { LayoutDashboard, Package, PlusCircle, Store, User } from "lucide-react";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "batches", label: "My Batches", icon: Package },
  { key: "add", label: "Add Batch", icon: PlusCircle },
  { key: "marketplace", label: "Marketplace", icon: Store },
];

export default function Sidebar({ active, onNavigate, sellerName }) {
  return (
    <aside className="w-60 shrink-0 bg-sidebar text-white flex flex-col min-h-screen">
      <div className="px-6 py-6 flex items-center gap-2.5 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center font-bold text-sm">
          RO
        </div>
        <div>
          <div className="font-semibold text-[15px] leading-tight">Rescue OS</div>
          <div className="text-[11px] text-white/50 leading-tight">Nourish Today, Waste Less</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onNavigate(key)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
              active === key
                ? "bg-brand text-white"
                : "text-white/70 hover:bg-sidebar-hover hover:text-white"
            }`}
          >
            <Icon size={18} strokeWidth={2} />
            {label}
          </button>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-white/10 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-brand/40 flex items-center justify-center">
          <User size={18} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{sellerName || "Seller"}</div>
          <div className="text-[11px] text-white/50">Mandi Trader</div>
        </div>
      </div>
    </aside>
  );
}
