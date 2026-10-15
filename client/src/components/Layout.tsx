import { useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { MicroLabel } from "./wireframe-primitives";
import { useCart } from "../context/useCart";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import ChatWidget from "./ChatWidget";
import { CATEGORIES, CATEGORY_NAMES } from "../data/categories";
import SellerWallet from "./SellerWallet";
import TrustedVendorRequest from "./TrustedVendorRequest";
import MobileDrawer from "./MobileDrawer";

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeNav, setActiveNav] = useState("All");
  const { totalItems } = useCart();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");


  const HELP_LINKS = [
  { label: "Help Centre", to: "/help" },
  { label: "Contact Us", to: "/help#contact" },
  { label: "Track My Order", to: "/track-order" },
  { label: "Jomu Mart Return Policy", to: "/help" },
  { label: "FAQs", to: "/help#faqs" },
  { label: "Jomu Mart Outlets", to: "#", comingSoon: true },
  { label: "Sell on Jomu Mart", to: "/sell" },
];

  const handleLogout = () => {
    logout();
    setAccountOpen(false);
    navigate("/");
  };

  return (
    <div
      className="bg-white text-black min-h-screen"
      style={{ fontFamily: "'Barlow', 'Helvetica Neue', Arial, sans-serif" }}
    >
      {/* Announcement Bar */}
      <div className="bg-black text-white py-2 px-4 md:px-8">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
          <span className="text-[9px] md:text-[10px] tracking-[0.15em] md:tracking-[0.2em] uppercase font-semibold">
            Free delivery on orders above ₦50,000
          </span>
        </div>
      </div>

      {/* Header */}
      <header className="border-b-2 border-black px-4 md:px-8 py-4 md:py-5">
        {/* Mobile header row — WF-06: ☰ · logo · account · cart */}
        <div className="lg:hidden max-w-screen-2xl mx-auto flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="w-8 h-8 border-2 border-black flex flex-col items-center justify-center gap-1"
            aria-label="Menu"
          >
            <span className="w-4 h-0.5 bg-black" />
            <span className="w-4 h-0.5 bg-black" />
            <span className="w-4 h-0.5 bg-black" />
          </button>
          <Link
            to="/"
            className="font-black uppercase leading-none"
            style={{ fontSize: 18, letterSpacing: "-0.05em" }}
          >
            Jomu Mart
          </Link>
          <span className="flex-1" />
          <Link to={user ? "/my-orders" : "/login"} className="text-[13px] font-bold">
            {user ? "👤" : "👤 Login"}
          </Link>
          <Link to="/cart" className="text-[13px] font-bold">
            🛒 ({totalItems})
          </Link>
        </div>

        {/* Desktop row */}
        <div className="hidden lg:flex max-w-screen-2xl mx-auto items-center justify-between lg:justify-start gap-4 lg:gap-10">
          <Link to="/" className="shrink-0 flex flex-col">
            <span
              className="font-black uppercase leading-none"
              style={{ fontSize: 24, letterSpacing: "-0.05em" }}
            >
              Jomu Mart
            </span>
            <MicroLabel>Nigeria's Marketplace</MicroLabel>
          </Link>

          <Link
            to="/sell"
            className="hidden lg:block shrink-0 text-[11px] tracking-[0.15em] uppercase font-semibold hover:opacity-70"
          >
            🏷 Sell on Jomu Mart
          </Link>

          <span
            title="Coming soon"
            className="hidden lg:block shrink-0 text-[11px] tracking-[0.15em] uppercase font-semibold opacity-50 cursor-not-allowed select-none"
          >
            🏪 Jomu Mart Outlets
          </span>

          <form
            className="hidden lg:flex flex-1 border-2 border-black"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(
                searchTerm.trim() ? `/?q=${encodeURIComponent(searchTerm.trim())}` : "/"
              );
            }}
          >
         
            <input
              type="text"
              placeholder="Search products, brands and categories…"
              className="flex-1 px-4 py-2.5 text-sm outline-none bg-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button type="submit" className="px-6 py-2.5 bg-black text-white text-[10px] tracking-[0.2em] uppercase font-bold shrink-0">
              Search
            </button>
          </form>

            <div className="relative group hidden lg:block shrink-0">
              <span className="cursor-pointer text-[11px] tracking-[0.15em] uppercase font-semibold flex items-center gap-1.5">
                ▦ Download App ▾
              </span>
              <div className="absolute right-0 top-full pt-3 invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity z-50">
                <div className="bg-white border-2 border-black shadow-[6px_6px_0_rgba(0,0,0,0.15)] w-[250px] p-4">
                  <p className="text-[10px] tracking-[0.2em] uppercase font-bold mb-2">
                    Scan QR to download
                  </p>
                  <div className="h-28 border border-dashed border-neutral-300 flex items-center justify-center text-[10px] text-neutral-400 uppercase tracking-widest">
                    QR Code — soon
                  </div>
                  <p className="mt-3 text-[11px] font-bold">▶ Google Play <span className="text-neutral-400 font-medium">(coming soon)</span></p>
                  <p className="mt-1 text-[11px] font-bold">🍎 App Store <span className="text-neutral-400 font-medium">(coming soon)</span></p>
                </div>
              </div>
            </div>

            <div className="relative group hidden lg:block shrink-0">
  <span className="cursor-pointer text-[11px] tracking-[0.15em] uppercase font-semibold flex items-center gap-1.5">
    ( ? ) Help ▾
  </span>
  <div className="absolute right-0 top-full pt-3 invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity z-50">
    <div className="bg-white border-2 border-black shadow-[6px_6px_0_rgba(0,0,0,0.15)] min-w-[250px] py-1">
      {HELP_LINKS.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          className="block px-4 py-2 text-[11px] uppercase font-bold tracking-wide hover:bg-neutral-50 border-b border-black/10"
          onClick={() => setAccountOpen(false)}
        >
          {link.label}
        </Link>
      ))}
    </div>
  </div>
</div>




          <div className="hidden lg:flex items-center gap-8 shrink-0">
            <div className="relative">
              <button
                onClick={() => setAccountOpen((o) => !o)}
                className="flex flex-col items-start"
              >
                <MicroLabel>Account</MicroLabel>
                <span className="text-[13px] font-bold mt-0.5">
                  {user ? user.name.split(" ")[0] : "Login / Sign Up"} ▾
                </span>
              </button>
              {accountOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white border-2 border-black z-50">
                  {user ? (
                    <>
                      <div className="px-4 py-3 border-b border-black/10">
                        <p className="text-[12px] font-bold">{user.name}</p>
                        <p className="text-[10px] text-neutral-400">
                          {user.email}
                        </p>
                      </div>
                      {user.role !== "admin" && (
                        <>
                          <SellerWallet />
                          <TrustedVendorRequest />
                        </>
                      )}

                      {user.role === "admin" && (
                        <Link
                          to="/admin"
                          onClick={() => setAccountOpen(false)}
                          className="block px-4 py-3 text-[11px] uppercase font-bold tracking-wide hover:bg-neutral-50 border-b border-black/10"
                        >
                          Admin Dashboard
                        </Link>
                      )}
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-3 text-[11px] uppercase font-bold tracking-wide hover:bg-neutral-50 text-red-600"
                      >
                        Sign Out
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        to="/login"
                        onClick={() => setAccountOpen(false)}
                        className="block px-4 py-3 text-[11px] uppercase font-bold tracking-wide hover:bg-neutral-50 border-b border-black/10"
                      >
                        Login / Signup
                      </Link>
                      <Link
                        to="/login"
                        onClick={() => setAccountOpen(false)}
                        className="block px-4 py-3 text-[11px] uppercase font-bold tracking-wide hover:bg-neutral-50"
                      >
                        My Account
                      </Link>
                      <Link
                        to="/my-orders"
                        onClick={() => setAccountOpen(false)}
                        className="block px-4 py-3 text-[11px] uppercase font-bold tracking-wide hover:bg-neutral-50 border-b border-black/10"
                      >
                        My Orders
                      </Link>
                      <Link
                        to="#"
                        onClick={() => setAccountOpen(false)}
                        className="block px-4 py-3 text-[11px] uppercase font-bold tracking-wide hover:bg-neutral-50 border-b border-black/10"
                      >
                        Saved Items
                      </Link>
                      <Link 
                        to="/track-order"
                        onClick={() => setAccountOpen(false)}
                        className="block px-4 py-3 text-[11px] uppercase font-bold tracking-wide hover:bg-neutral-50"
                      >
                        Track My Order
                      </Link>
                    </>
                  )}
                </div>
              )}
            </div>
             <Link to="/my-orders" className="flex flex-col items-start">
              <MicroLabel>Returns</MicroLabel>
              <span className="text-[13px] font-bold mt-0.5">& Orders</span>
            </Link>

            <Link to="/cart" className="flex flex-col items-start relative">
              <MicroLabel>Shopping</MicroLabel>
              <span className="text-[13px] font-bold mt-0.5">
                Cart ({totalItems})
              </span>
            </Link>
          </div>

        </div>

        <div className="lg:hidden max-w-screen-2xl mx-auto mt-3 flex border-2 border-black">
            <form
              className="flex flex-1"
              onSubmit={(e) => {
                e.preventDefault();
                navigate(searchTerm.trim() ? `/?q=${encodeURIComponent(searchTerm.trim())}` : "/");
              }}
            >
          <input
            type="text"
            placeholder="Search products…"
            className="flex-1 px-3 py-2 text-sm outline-none bg-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button type="submit" className="px-4 py-2 bg-black text-white text-[10px] tracking-[0.2em] uppercase font-bold shrink-0">
            Go
          </button>
          </form>
        </div>

        {/* Old mobile panel removed — replaced by MobileDrawer */}
      </header>

      {/* Category Nav — desktop: mega menu + quick links · mobile: Home + tabs */}
      <nav className="border-b border-black/15 bg-neutral-50 px-4 md:px-8">
        <div className="max-w-screen-2xl mx-auto flex items-center">
          {/* All Categories mega menu (desktop only) */}
          <div className="relative group/cat-trigger hidden lg:block shrink-0">
            <button className="px-4 py-3 text-[10px] tracking-[0.18em] uppercase font-semibold border-r border-black/10">
              ☰ All Categories ▾
            </button>
            <div className="absolute left-0 top-full invisible opacity-0 group-hover/cat-trigger:visible group-hover/cat-trigger:opacity-100 z-50">
              <div className="w-[260px] bg-white border-2 border-black shadow-[6px_6px_0_rgba(0,0,0,0.15)] py-2">
                {CATEGORY_NAMES.map((cat) => (
                  <div
                    key={cat}
                    className="group/cat relative flex justify-between px-4 py-2.5 text-[12px] font-semibold cursor-pointer hover:bg-neutral-50"
                  >
                    {cat} <span>▸</span>
                    <div className="hidden group-hover/cat:block absolute left-full top-[-8px] bg-white border-2 border-black shadow-[6px_6px_0_rgba(0,0,0,0.15)] w-[280px] p-4 z-50">
                      {CATEGORIES[cat].map((sub) => (
                        <button
                          key={sub}
                          onClick={() => setActiveNav(cat)}
                          className="block w-full text-left py-2 text-[12px] font-medium hover:font-bold"
                        >
                          {sub}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile: Home tab resets the filter */}
          <button
            onClick={() => setActiveNav("All")}
            className={`lg:hidden shrink-0 px-4 py-3 text-[10px] tracking-[0.18em] uppercase font-semibold border-b-2 ${
              activeNav === "All"
                ? "border-black text-black"
                : "border-transparent text-neutral-500"
            }`}
          >
            Home
          </button>

          {/* Quick links — the category filter buttons */}
          <div className="flex items-center overflow-x-auto">
            {CATEGORY_NAMES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveNav(cat)}
                className={`shrink-0 px-4 py-3 text-[10px] tracking-[0.18em] uppercase font-semibold border-b-2 whitespace-nowrap ${
                  activeNav === cat
                    ? "border-black text-black"
                    : "border-transparent text-neutral-500 hover:text-black"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </nav>
      <MobileDrawer open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)}
  onCategory={setActiveNav} onSignOut={handleLogout} user={user} />

      <Outlet context={{ activeNav, setActiveNav }} />
      <ChatWidget />
    </div>
  );
}


