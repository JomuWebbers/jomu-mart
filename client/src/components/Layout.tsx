import { useCallback, useEffect, useRef, useState } from "react";
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
import { useSavedItems } from "../context/useSavedItems";
import { ShoppingCart } from "lucide-react";

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const accountContainerRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const accountMenuId = "customer-account-menu";
  const [activeNav, setActiveNav] = useState("All");
  const { totalItems } = useCart();
  const { savedCount } = useSavedItems();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const returnFocusToMobileMenu = useCallback(
    () => mobileMenuButtonRef.current?.focus(),
    [],
  );

  useEffect(() => {
    if (!accountOpen) return;

    const closeWhenOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !accountContainerRef.current?.contains(event.target)
      ) {
        setAccountOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountOpen(false);
        accountButtonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", closeWhenOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeWhenOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountOpen]);


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
            <span className="text-[#E63312]">●</span> Free delivery on orders above ₦50,000
          </span>
        </div>
      </div>

      {/* Header */}
      <header className="border-b border-black/15 bg-white px-4 md:px-8 py-4 md:py-5">
        {/* Mobile header row — WF-06: ☰ · logo · account · cart */}
        <div className="lg:hidden max-w-screen-2xl mx-auto flex items-center gap-3">
          <button
            ref={mobileMenuButtonRef}
            onClick={() => setMobileMenuOpen(true)}
            className="w-9 h-9 border border-black flex flex-col items-center justify-center gap-1 hover:border-[#E63312] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E63312]"
            aria-label="Menu"
            aria-expanded={mobileMenuOpen}
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
          <Link to={user ? "/my-account" : "/login"} className="text-[13px] font-bold hover:text-[#E63312]">
            {user ? "👤 Account" : "👤 Login"}
          </Link>
          <Link
            to="/cart"
            aria-label={`Shopping cart, ${totalItems} ${totalItems === 1 ? "item" : "items"}`}
            className="relative flex h-9 w-9 items-center justify-center hover:text-[#E63312] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E63312]"
          >
            <ShoppingCart aria-hidden="true" className="h-5 w-5" />
            {totalItems > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E63312] px-1 text-[10px] font-bold leading-none text-white">
                {totalItems}
              </span>
            )}
          </Link>
        </div>

        {/* Desktop row */}
        <div className="hidden lg:flex max-w-screen-2xl mx-auto items-center justify-between lg:justify-start gap-4 lg:gap-6">
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
            className="hidden xl:block shrink-0 text-[11px] tracking-[0.15em] uppercase font-semibold hover:opacity-70"
          >
            🏷 Sell on Jomu Mart
          </Link>

          <span
            title="Coming soon"
            className="hidden 2xl:block shrink-0 text-[11px] tracking-[0.15em] uppercase font-semibold opacity-50 cursor-not-allowed select-none"
          >
            🏪 Jomu Mart Outlets
          </span>

          <form
            className="hidden lg:flex flex-1 min-w-0 border border-black focus-within:border-[#E63312]"
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
              className="flex-1 min-w-0 px-4 py-2.5 text-sm outline-none bg-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button type="submit" className="px-6 py-2.5 bg-[#E63312] text-white text-[10px] tracking-[0.2em] uppercase font-bold shrink-0 hover:bg-black transition-colors">
              Search
            </button>
          </form>

            <div className="relative group hidden xl:block shrink-0">
              <button
                type="button"
                className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] hover:text-[#E63312] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E63312]"
              >
                ▦ Download App ▾
              </button>
              <div className="invisible absolute right-0 top-full z-50 pt-3 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
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
  <button
    type="button"
    className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] hover:text-[#E63312] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E63312]"
  >
    ( ? ) Help ▾
  </button>
  <div className="invisible absolute right-0 top-full z-50 pt-3 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
    <div className="bg-white border-2 border-black shadow-[6px_6px_0_rgba(0,0,0,0.15)] min-w-[250px] py-1">
      {HELP_LINKS.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          className="block px-4 py-2 text-[11px] uppercase font-bold tracking-wide hover:bg-neutral-50 border-b border-black/10"
        >
          {link.label}
        </Link>
      ))}
    </div>
  </div>
</div>




          <div className="hidden lg:flex items-center gap-6 shrink-0 whitespace-nowrap">
            {/* Account — opens on hover, same pattern as Help / Download App */}
            <div ref={accountContainerRef} className="relative group/account">
              <button
                ref={accountButtonRef}
                type="button"
                className="flex items-center gap-1.5 text-[11px] tracking-[0.14em] uppercase font-semibold cursor-pointer hover:text-[#E63312] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E63312]"
                aria-expanded={accountOpen}
                aria-haspopup="true"
                aria-controls={accountMenuId}
                onClick={(e) => {
                  e.stopPropagation();
                  setAccountOpen((o) => !o);
                }}
              >
                👤 {user ? user.name.split(" ")[0] : "Login / Sign Up"} ▾
              </button>
              <div
                className={`absolute right-0 top-full pt-3 z-50 transition-opacity ${
                  accountOpen
                    ? "visible opacity-100"
                    : "invisible opacity-0 group-hover/account:visible group-hover/account:opacity-100"
                }`}
              >
                <div
                  id={accountMenuId}
                  className="max-h-[calc(100vh-6rem)] w-80 max-w-[calc(100vw-2rem)] overflow-x-hidden overflow-y-auto border-2 border-black bg-white shadow-[6px_6px_0_rgba(0,0,0,0.15)]"
                >
                  {user ? (
                    <>
                      <div className="px-4 py-3 border-b border-black/10">
                        <p className="text-[12px] font-bold">{user.name}</p>
                        <p className="text-[10px] text-neutral-400">
                          {user.email}
                        </p>
                      </div>
                      <div className="border-b border-black/10 py-2">
                        <p className="mb-2 px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">
                          Account
                        </p>
                        <Link
                          to="/my-account"
                          onClick={() => setAccountOpen(false)}
                          className="block border-b border-black/10 px-4 py-3 text-[11px] font-bold uppercase tracking-wide hover:bg-neutral-50"
                        >
                          My Account
                        </Link>
                        <Link
                          to="/my-account/orders"
                          onClick={() => setAccountOpen(false)}
                          className="block border-b border-black/10 px-4 py-3 text-[11px] font-bold uppercase tracking-wide hover:bg-neutral-50"
                        >
                          My Orders
                        </Link>
                        <Link
                          to="/saved-items"
                          onClick={() => setAccountOpen(false)}
                          className="block border-b border-black/10 px-4 py-3 text-[11px] font-bold uppercase tracking-wide hover:bg-neutral-50"
                        >
                          <span className="flex items-center justify-between">
                            Saved Items
                            {savedCount !== null && savedCount > 0 && (
                              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E63312] px-1.5 text-[10px] font-bold text-white">
                                {savedCount}
                              </span>
                            )}
                          </span>
                        </Link>
                        <Link
                          to="/track-order"
                          onClick={() => setAccountOpen(false)}
                          className="block px-4 py-3 text-[11px] font-bold uppercase tracking-wide hover:bg-neutral-50"
                        >
                          Track My Order
                        </Link>
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
                          className="block w-full border-t border-black/10 px-4 py-3 text-[11px] font-bold uppercase tracking-wide hover:bg-neutral-50"
                        >
                          Admin Dashboard
                        </Link>
                      )}
                      <div className="border-t border-black/10">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAccountOpen(false);
                            handleLogout();
                          }}
                          className="block w-full box-border px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-red-600 hover:bg-neutral-50"
                        >
                          Sign Out
                        </button>
                      </div>
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
                        className="block px-4 py-3 text-[11px] uppercase font-bold tracking-wide hover:bg-neutral-50 border-b border-black/10"
                      >
                        My Account
                      </Link>
                      <Link
                        to="/my-account/orders"
                        onClick={() => setAccountOpen(false)}
                        className="block px-4 py-3 text-[11px] uppercase font-bold tracking-wide hover:bg-neutral-50 border-b border-black/10"
                      >
                        My Orders
                      </Link>
                      <Link
                        to="/saved-items"
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
              </div>
            </div>

            <Link
              to="/cart"
              aria-label={`Shopping cart, ${totalItems} ${totalItems === 1 ? "item" : "items"}`}
              className="relative flex h-9 w-9 shrink-0 items-center justify-center hover:text-[#E63312] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E63312]"
            >
              <ShoppingCart aria-hidden="true" className="h-5 w-5" />
              {totalItems > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E63312] px-1 text-[10px] font-bold leading-none text-white">
                  {totalItems}
                </span>
              )}
            </Link>
          </div>

        </div>

        <div className="lg:hidden max-w-screen-2xl mx-auto mt-3 flex border border-black focus-within:border-[#E63312]">
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
          <button type="submit" className="px-4 py-2 bg-[#E63312] text-white text-[10px] tracking-[0.2em] uppercase font-bold shrink-0 hover:bg-black transition-colors">
            Go
          </button>
          </form>
        </div>

        {/* Old mobile panel removed — replaced by MobileDrawer */}
      </header>

      {/* Category Nav — desktop: mega menu + quick links · mobile: Home + tabs */}
      <nav aria-label="Product categories" className="border-b border-black/15 bg-neutral-50 px-4 md:px-8">
        <div className="max-w-screen-2xl mx-auto flex items-center">
          {/* All Categories mega menu (desktop only) */}
          <div className="relative group/cat-trigger hidden lg:block shrink-0">
            <button
              type="button"
              className="border-r border-black/10 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#E63312]"
            >
              ☰ All Categories ▾
            </button>
            <div className="invisible absolute left-0 top-full z-50 opacity-0 group-hover/cat-trigger:visible group-hover/cat-trigger:opacity-100 group-focus-within/cat-trigger:visible group-focus-within/cat-trigger:opacity-100">
              <div className="w-[260px] bg-white border-2 border-black shadow-[6px_6px_0_rgba(0,0,0,0.15)] py-2">
                {CATEGORY_NAMES.map((cat) => (
                  <div
                    key={cat}
                    className="group/cat relative"
                  >
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left text-[12px] font-semibold hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#E63312]"
                    >
                      {cat} <span aria-hidden="true">▸</span>
                    </button>
                    <div className="invisible absolute left-full top-[-8px] z-50 w-[280px] border-2 border-black bg-white p-4 opacity-0 shadow-[6px_6px_0_rgba(0,0,0,0.15)] group-hover/cat:visible group-hover/cat:opacity-100 group-focus-within/cat:visible group-focus-within/cat:opacity-100">
                      {CATEGORIES[cat].map((sub) => (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => setActiveNav(cat)}
                          className="block w-full py-2 text-left text-[12px] font-medium hover:font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#E63312]"
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
            type="button"
            onClick={() => setActiveNav("All")}
            aria-pressed={activeNav === "All"}
            className={`lg:hidden shrink-0 px-4 py-3 text-[10px] tracking-[0.18em] uppercase font-semibold border-b-2 ${
              activeNav === "All"
                ? "border-[#E63312] text-[#E63312]"
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
                type="button"
                onClick={() => setActiveNav(cat)}
                aria-pressed={activeNav === cat}
                className={`shrink-0 px-4 py-3 text-[10px] tracking-[0.18em] uppercase font-semibold border-b-2 whitespace-nowrap ${
                  activeNav === cat
                    ? "border-[#E63312] text-[#E63312]"
                    : "border-transparent text-neutral-500 hover:text-black"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </nav>
      <MobileDrawer
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        returnFocus={returnFocusToMobileMenu}
        onCategory={setActiveNav}
        onSignOut={handleLogout}
        user={user}
      />

      <Outlet context={{ activeNav, setActiveNav }} />
      <ChatWidget />
    </div>
  );
}



// ## Phase 2 — Category listing & search page (PLP) — *first new page*

// - New route `/products?category=X&q=Y` + page from `02-category-listing.html`
// - Backend: extend `getProducts` with `q` (name search), `minPrice/maxPrice`, `sort`, `page`
// - Left filter rail (subcategory tree from `CATEGORIES`, price, rating, discount-only), sort bar, grid reusing `ProductCard` + add-to-cart, pagination
// - Point at it: mega menu subs, mobile drawer categories, header search, homepage "See All"/View All buttons, category tiles

// ✅ Validate: every entry path lands correctly; filters + pagination against real data.

// ## Phase 3 — Homepage body → WF-01

// - __3-column hero:__ category sidebar (links to PLP) · banner carousel placeholder (static image slides — no auto-play JS needed yet) · 2 promo tiles
// - Horizontal-scroll __category rows__ ("Top Deals in Phones…") derived from `products` by category
// - Keep your existing Phase 1–4 logic (flash sale, new arrivals, best sellers, tiles)
// - Service/trust strip + footer columns (mostly exists)

// ## Phase 4 — Product page upgrade (03)

// - __Gallery__ from the `images[]` column your schema already has (currently underused)
// - __Buy box:__ delivery info from `deliveryDays`/`deliveryFeeAmount` (already in schema), qty stepper, Add to Cart + Buy Now
// - __Tabs:__ description · specs · __reviews__ (`Review` model exists — surface it)
// - __Related products:__ same-category slice

// ## Phase 5 — Cart & checkout alignment (04/05)

// - Cart: order-summary rail layout + "customers also bought"
// - Checkout: restyle existing flow into the 3-step visual (address → delivery → payment already exist in your logic)

// ## Phase 6 — New account features *(first schema changes)*

// Priority order: __Saved Items__ (Wishlist model + migration + heart buttons sitewide) → __My Account page__ (profile + addresses — `Address` model exists) → __Pending Reviews__ (delivered orders awaiting review) → Help content sections (Return Policy) → Outlets *(discussion first, as agreed)*

// ## Phase 7 — Hi-fi visual pass

// Apply the Phase 0 direction (tokens: one accent color, typography, density) across every page; responsive QA at 2/3/4-col breakpoints; final `tsc`/lint/build sweep.

// ---

// __Dependency note:__ Phases 1→2 are sequential (header search needs the PLP). Phases 3–5 can reorder freely. Phase 6 can be sliced per feature. No schema changes until Phase 6 — everything before it uses existing models.
