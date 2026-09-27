import { useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { MicroLabel } from "./wireframe-primitives";
import { useCart } from "../context/useCart";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import ChatWidget from "./ChatWidget";
import { CATEGORY_NAMES } from "../data/categories";
import SellerWallet from "./SellerWallet";
import TrustedVendorRequest from "./TrustedVendorRequest";

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeNav, setActiveNav] = useState("All");
  const { totalItems } = useCart();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setAccountOpen(false);
    navigate("/");
  };

  return (
    <div
      className="bg-white text-black min-h-screen overflow-x-hidden"
      style={{ fontFamily: "'Barlow', 'Helvetica Neue', Arial, sans-serif" }}
    >
      {/* Announcement Bar */}
      <div className="bg-black text-white py-2 px-4 md:px-8">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
          <span className="text-[9px] md:text-[10px] tracking-[0.15em] md:tracking-[0.2em] uppercase font-semibold">
            Free delivery on orders above ₦50,000
          </span>
          <div className="hidden md:flex items-center gap-6">
            <Link
              to="/sell"
              className="text-[10px] tracking-[0.18em] uppercase font-semibold text-neutral-400 hover:text-white transition-colors"
            >
              Sell on Naija Mart
            </Link>
            <Link
              to="/track-order"
              className="text-[10px] tracking-[0.18em] uppercase font-semibold text-neutral-400 hover:text-white transition-colors"
            >
              Track Order
            </Link>
            <Link
              to="/help"
              className="text-[10px] tracking-[0.18em] uppercase font-semibold text-neutral-400 hover:text-white transition-colors"
            >
              Help Center
            </Link>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="border-b-2 border-black px-4 md:px-8 py-4 md:py-5">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between lg:justify-start gap-4 lg:gap-10">
          <Link to="/" className="shrink-0 flex flex-col">
            <span
              className="font-black uppercase leading-none"
              style={{ fontSize: 24, letterSpacing: "-0.05em" }}
            >
              Naija Mart
            </span>
            <MicroLabel>Nigeria's Marketplace</MicroLabel>
          </Link>

          <div className="shrink-0 hidden lg:flex flex-col cursor-pointer">
            <MicroLabel>Deliver To</MicroLabel>
            <span className="text-[13px] font-bold mt-0.5">Lagos, NG ▾</span>
          </div>

          <div className="hidden lg:flex flex-1 border-2 border-black">
            <select className="px-3 py-2.5 text-[11px] tracking-widest uppercase font-semibold bg-neutral-100 border-r-2 border-black outline-none cursor-pointer shrink-0">
              <option>All</option>
              <option>Electronics</option>
              <option>Fashion</option>
              <option>Phones & Tablets</option>
            </select>
            <input
              type="text"
              placeholder="Search products, brands and categories…"
              className="flex-1 px-4 py-2.5 text-sm outline-none bg-transparent"
            />
            <button className="px-6 py-2.5 bg-black text-white text-[10px] tracking-[0.2em] uppercase font-bold shrink-0">
              Search
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-8 shrink-0">
            <div className="relative">
              <button
                onClick={() => setAccountOpen((o) => !o)}
                className="flex flex-col items-start"
              >
                <MicroLabel>Account</MicroLabel>
                <span className="text-[13px] font-bold mt-0.5">
                  {user ? user.name.split(" ")[0] : "Sign In"} ▾
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
                        Sign In
                      </Link>
                      <Link
                        to="/register"
                        onClick={() => setAccountOpen(false)}
                        className="block px-4 py-3 text-[11px] uppercase font-bold tracking-wide hover:bg-neutral-50"
                      >
                        Register
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

          <div className="flex lg:hidden items-center gap-4 shrink-0">
            <Link to="/cart" className="text-[12px] font-bold">
              Cart ({totalItems})
            </Link>
            <button
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="w-8 h-8 border-2 border-black flex flex-col items-center justify-center gap-1"
              aria-label="Menu"
            >
              <span className="w-4 h-0.5 bg-black" />
              <span className="w-4 h-0.5 bg-black" />
              <span className="w-4 h-0.5 bg-black" />
            </button>
          </div>
        </div>

        <div className="lg:hidden max-w-screen-2xl mx-auto mt-3 flex border-2 border-black">
          <input
            type="text"
            placeholder="Search products…"
            className="flex-1 px-3 py-2 text-sm outline-none bg-transparent"
          />
          <button className="px-4 py-2 bg-black text-white text-[10px] tracking-[0.2em] uppercase font-bold shrink-0">
            Go
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden max-w-screen-2xl mx-auto mt-3 border-2 border-black divide-y-2 divide-black">
            <div className="p-3 flex justify-between items-center">
              <MicroLabel>Deliver To</MicroLabel>
              <span className="text-[13px] font-bold">Lagos, NG ▾</span>
            </div>
            {user ? (
              <>
                <div className="p-3">
                  <p className="text-[12px] font-bold">{user.name}</p>
                  <p className="text-[10px] text-neutral-400">{user.email}</p>
                </div>
                {user.role === "admin" && (
                  <Link
                    to="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block p-3 text-[11px] uppercase font-bold tracking-wide"
                  >
                    Admin Dashboard
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full text-left p-3 text-[11px] uppercase font-bold tracking-wide text-red-600"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="block p-3 text-[13px] font-bold"
              >
                Sign In ▾
              </Link>
            )}

            <Link
              to="/my-orders"
              onClick={() => setMobileMenuOpen(false)}
              className="flex justify-between items-center p-3 text-[11px] tracking-[0.15em] uppercase font-semibold hover:bg-neutral-100"
            >
              <MicroLabel>Returns & Orders</MicroLabel>
            </Link>
            
            <Link
              to="/sell"
              onClick={() => setMobileMenuOpen(false)}
              className="block p-3 text-[11px] tracking-[0.15em] uppercase font-semibold"
            >
              Sell on Naija Mart
            </Link>
            {["Track Order", "Help Center"].map((s) => (
              <div key={s} className="p-3">
                <span className="text-[11px] tracking-[0.15em] uppercase font-semibold">
                  {s}
                </span>
              </div>
            ))}
          </div>
        )}
      </header>

      {/* Category Nav */}
      <nav className="border-b border-black/15 bg-neutral-50 px-4 md:px-8">
        <div className="max-w-screen-2xl mx-auto flex items-center overflow-x-auto gap-0">
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
      </nav>

      <Outlet context={{ activeNav }} />
      <ChatWidget />
    </div>
  );
}
