import { useEffect, useRef, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { CATEGORY_NAMES } from "../data/categories";
import SellerWallet from "./SellerWallet";
import TrustedVendorRequest from "./TrustedVendorRequest";

type Props = {
  open: boolean;
  onClose: () => void;
  returnFocus: () => void;
  onCategory: (cat: string) => void;
  onSignOut: () => void;
  user: { name: string; email: string; role: string } | null;
};

const CAT_ICONS: Record<string, string> = {
  "Phones & Tablets": "📱",
  Electronics: "💻",
  "Home, Furniture & Appliances": "🏠",
  Fashion: "👗",
  "Baby & Kids": "🧸",
  "Beauty & Personal Care": "💄",
  "Food & Beverages": "🛒",
};

const UTILITY_LINKS: { label: string; to: string; soon?: boolean }[] = [
  { label: "My Orders", to: "/my-account/orders" },
  { label: "Pending Reviews", to: "/my-account/pending-ratings" },
  { label: "Saved Items", to: "/saved-items" },
  { label: "Track Orders", to: "/track-order" },
  { label: "Sell on Jomu Mart", to: "/sell" },
  { label: "Jomu Mart Outlets", to: "#", soon: true },
];

export default function MobileDrawer({
  open,
  onClose,
  returnFocus,
  onCategory,
  onSignOut,
  user,
}: Props) {
  const drawerRef = useRef<HTMLElement>(null);
  const wasOpen = useRef(open);

  useEffect(() => {
    if (open) {
      drawerRef.current
        ?.querySelector<HTMLButtonElement>('button[aria-label="Close menu"]')
        ?.focus();
    } else if (wasOpen.current) {
      returnFocus();
    }
    wasOpen.current = open;
  }, [open, returnFocus]);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== "Tab") return;
    const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-brand-charcoal/45 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      {/* Drawer — slides from the left (WF-06 frame B) */}
      <aside
        ref={drawerRef}
        className={`fixed bottom-0 left-0 top-0 z-50 w-[85%] max-w-[330px] transform overflow-y-auto bg-brand-surface transition-transform duration-200 ease-out lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        role={open ? "dialog" : undefined}
        aria-modal={open ? "true" : undefined}
        aria-label={open ? "Navigation menu" : undefined}
        aria-hidden={!open}
        inert={!open}
        onKeyDown={handleKeyDown}
      >
        {/* Header: logo + close */}
        <div className="flex items-center justify-between border-b border-brand-border bg-brand-cream px-4 py-3">
          <Link
            to="/"
            onClick={onClose}
            className="font-black uppercase leading-none"
            style={{ fontSize: 18, letterSpacing: "-0.05em" }}
          >
            Jomu Mart
          </Link>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-9 w-9 items-center justify-center rounded-control border border-brand-border text-lg leading-none hover:border-brand-evergreen hover:text-brand-evergreen focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-evergreen"
          >
            ✕
          </button>
        </div>

        {/* Konga chevron rows */}
        <Link
          to="/help"
          onClick={onClose}
          className="flex items-center justify-between border-b border-brand-border px-4 py-4 text-[15px] font-bold hover:bg-brand-cream"
        >
          Need Help? <span>›</span>
        </Link>
        <Link
          to={
            user
              ? user.role === "admin"
                ? "/admin"
                : "/my-account"
              : "/login"
          }
          onClick={onClose}
          className="flex items-center justify-between border-b border-brand-border px-4 py-4 text-[15px] font-bold hover:bg-brand-cream"
        >
          {user?.role === "admin" ? "Admin Dashboard" : "My Account"} <span>›</span>
        </Link>

        {/* Account block */}
        {user ? (
          <div className="border-b border-brand-border px-4 py-3">
            <p className="text-[13px] font-bold">{user.name}</p>
            <p className="text-[11px] text-neutral-400">{user.email}</p>
            {user.role === "admin" && (
              <div className="mt-2 flex gap-4">
                <Link
                  to="/admin"
                  onClick={onClose}
                  className="text-[11px] uppercase font-bold tracking-wide"
                >
                  Admin Dashboard
                </Link>
                <Link
                  to="/"
                  onClick={onClose}
                  className="text-[11px] uppercase font-bold tracking-wide"
                >
                  View Store
                </Link>
              </div>
            )}
            {/* Sellers need wallet + trusted-vendor access on mobile too */}
            {user.role !== "admin" && (
              <>
                <SellerWallet />
                <TrustedVendorRequest />
              </>
            )}
            <button
              onClick={() => {
                onSignOut();
                onClose();
              }}
              className="mt-2 text-[11px] uppercase font-bold tracking-wide text-red-600"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <>
            <Link
              to="/login"
              onClick={onClose}
              className="block border-b border-brand-border px-4 py-4 text-[14px] font-bold text-brand-evergreen"
            >
              ↗ Login / Signup
            </Link>
            <Link
              to="/register"
              onClick={onClose}
              className="block border-b border-brand-border px-4 py-3.5 text-[13px] font-semibold"
            >
              Register
            </Link>
          </>
        )}

        {user?.role !== "admin" && UTILITY_LINKS.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            onClick={onClose}
            className={`block border-b border-brand-border px-4 py-3.5 text-[13px] font-semibold hover:bg-brand-cream hover:text-brand-evergreen ${
              item.soon ? "opacity-50" : ""
            }`}
          >
            {item.label}
            {item.soon ? " (soon)" : ""}
          </Link>
        ))}

        {/* Our Categories */}
        <p className="px-4 pb-2 pt-5 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-evergreen">
          Our Categories
        </p>
        {CATEGORY_NAMES.map((cat) => (
          <button
            key={cat}
            onClick={() => {
              onCategory(cat);
              onClose();
            }}
            className="flex w-full items-center gap-3 border-b border-brand-border px-4 py-3.5 text-left text-[13px] font-semibold hover:bg-brand-cream"
          >
            <span>{CAT_ICONS[cat] ?? "🏷"}</span> {cat}
          </button>
        ))}

        <Link
          to="/"
          onClick={onClose}
          className="block border-b border-brand-border px-4 py-3.5 text-[13px] font-semibold text-brand-muted"
        >
          ▦ Download App (soon)
        </Link>
        <p className="px-4 py-4 text-[11px] text-neutral-400">🇳🇬 Nigeria · English</p>
      </aside>
    </>
  );
}
