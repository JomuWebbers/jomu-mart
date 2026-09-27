
import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboardIcon, PackageIcon, ShoppingBagIcon, TruckIcon, MessageCircleIcon, UsersIcon, LogOutIcon, ShieldIcon, ClipboardCheckIcon, RotateCcwIcon } from 'lucide-react'


const ADMIN_LINKS = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboardIcon, end: true },
  { to: '/admin/products', label: 'Products', icon: PackageIcon, end: false },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingBagIcon, end: false },
  { to: '/admin/delivery-partners', label: 'Delivery Partners', icon: TruckIcon, end: false },
  { to: '/admin/users', label: 'Users', icon: UsersIcon, end: false },
  { to: '/admin/support', label: 'Support Chat', icon: MessageCircleIcon, end: false },
  { to: "/admin/listings", label: "Listing Review", icon: ClipboardCheckIcon, end: false },
  { to: "/admin/returns", label: "Returns & Refunds", icon: RotateCcwIcon, end: false },
]

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col lg:flex-row">
      <aside className="w-full lg:w-64 shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-zinc-200 p-4">
        <div className="pb-4 mb-4 border-b border-zinc-100">
          <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2 px-2">
            <ShieldIcon className="size-5 text-indigo-600" /> Admin Panel
          </h2>
        </div>
        <nav className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible">
          {ADMIN_LINKS.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive ? 'bg-indigo-600 text-white' : 'text-zinc-600 hover:bg-zinc-100'
                }`
              }
            >
              <link.icon className="size-4" /> {link.label}
            </NavLink>
          ))}
          <NavLink
            to="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-600 hover:bg-zinc-100 whitespace-nowrap"
          >
            <LogOutIcon className="size-4" /> Exit to Store
          </NavLink>
        </nav>
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  )
}


