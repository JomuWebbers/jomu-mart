import { Link } from "react-router-dom";
import { CATEGORY_NAMES } from "../data/categories";
import SellerWallet from "./SellerWallet";
import TrustedVendorRequest from "./TrustedVendorRequest";

type Props = {
  open: boolean;
  onClose: () => void;
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
  { label: "My Orders", to: "/my-orders" },
  { label: "Pending Reviews", to: "/my-account/pending-ratings" },
  { label: "Saved Items", to: "/saved-items" },
  { label: "Track Orders", to: "/track-order" },
  { label: "Sell on Jomu Mart", to: "/sell" },
  { label: "Jomu Mart Outlets", to: "#", soon: true },
];

export default function MobileDrawer({
  open,
  onClose,
  onCategory,
  onSignOut,
  user,
}: Props) {
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      {/* Drawer — slides from the left (WF-06 frame B) */}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-[85%] max-w-[330px] bg-white z-50 lg:hidden overflow-y-auto transform transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!open}
      >
        {/* Header: logo + close */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/15">
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
            className="w-9 h-9 border border-black flex items-center justify-center text-lg leading-none hover:border-[#E63312] hover:text-[#E63312] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E63312]"
          >
            ✕
          </button>
        </div>

        {/* Konga chevron rows */}
        <Link
          to="/help"
          onClick={onClose}
          className="flex items-center justify-between px-4 py-4 text-[15px] font-bold border-b border-black/5"
        >
          Need Help? <span>›</span>
        </Link>
        <Link
          to={user ? "/my-account" : "/login"}
          onClick={onClose}
          className="flex items-center justify-between px-4 py-4 text-[15px] font-bold border-b border-black/5"
        >
          My Account <span>›</span>
        </Link>

        {/* Account block */}
        {user ? (
          <div className="px-4 py-3 border-b border-black/5">
            <p className="text-[13px] font-bold">{user.name}</p>
            <p className="text-[11px] text-neutral-400">{user.email}</p>
            {user.role === "admin" && (
              <Link
                to="/admin"
                onClick={onClose}
                className="block mt-2 text-[11px] uppercase font-bold tracking-wide"
              >
                Admin Dashboard
              </Link>
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
              className="block px-4 py-4 text-[14px] font-bold border-b border-black/5"
            >
              ↗ Login / Signup
            </Link>
            <Link
              to="/register"
              onClick={onClose}
              className="block px-4 py-3.5 text-[13px] font-semibold border-b border-black/5"
            >
              Register
            </Link>
          </>
        )}

        {UTILITY_LINKS.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            onClick={onClose}
            className={`block px-4 py-3.5 text-[13px] font-semibold border-b border-black/5 hover:bg-neutral-50 hover:text-[#E63312] ${
              item.soon ? "opacity-50" : ""
            }`}
          >
            {item.label}
            {item.soon ? " (soon)" : ""}
          </Link>
        ))}

        {/* Our Categories */}
        <p className="px-4 pt-5 pb-2 text-[10px] tracking-[0.2em] uppercase font-bold text-neutral-500">
          Our Categories
        </p>
        {CATEGORY_NAMES.map((cat) => (
          <button
            key={cat}
            onClick={() => {
              onCategory(cat);
              onClose();
            }}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-[13px] font-semibold border-b border-black/5 text-left hover:bg-neutral-50"
          >
            <span>{CAT_ICONS[cat] ?? "🏷"}</span> {cat}
          </button>
        ))}

        <Link
          to="/"
          onClick={onClose}
          className="block px-4 py-3.5 text-[13px] font-semibold border-b border-black/5 opacity-70"
        >
          ▦ Download App (soon)
        </Link>
        <p className="px-4 py-4 text-[11px] text-neutral-400">🇳🇬 Nigeria · English</p>
      </aside>
    </>
  );
}
