import { useState, useEffect } from "react";
import { apiRequest } from "../lib/api";
import { Wire, MicroLabel } from "../components/wireframe-primitives";
import { fmt, pct } from "../components/wireframe-helpers";
import { Link } from "react-router-dom";
import { useOutletContext } from "react-router-dom";

// ─── Data ────────────────────────────────────────────────────────────────────

// const NAV_CATEGORIES = [
//   'All', 'ELECTRONICS', 'Fashion', 'Home & Kitchen',
//   'Computing', 'Phones & Tablets', 'Baby Products', 'Gaming', 'Sports & Fitness',
// ]

type Product = {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  image: string;
  category: string;
  stock: number;
};

const FLASH_DEALS = [
  {
    id: 9,
    name: "AirPods Pro (3rd Gen)",
    price: 320_000,
    original: 420_000,
    tag: "AUDIO",
  },
  {
    id: 10,
    name: "Canon EOS R50 Mirrorless Camera",
    price: 680_000,
    original: 890_000,
    tag: "CAMERAS",
  },
  {
    id: 11,
    name: "Ninja AF101 Air Fryer 3.8L",
    price: 57_000,
    original: 82_000,
    tag: "HOME & KITCHEN",
  },
  {
    id: 12,
    name: "JBL Charge 5 Bluetooth Speaker",
    price: 98_000,
    original: 135_000,
    tag: "AUDIO",
  },
];

const NEW_ARRIVALS = [
  { id: 13, name: "Samsung Galaxy S24 Ultra", price: 1_150_000, tag: "PHONES" },
  {
    id: 14,
    name: "Linen Blend Tailored Suit — Slate",
    price: 78_000,
    tag: "FASHION",
  },
  { id: 15, name: "Bosch Serie 6 Dishwasher", price: 520_000, tag: "HOME" },
  { id: 16, name: "DJI Mini 4 Pro Drone", price: 780_000, tag: "ELECTRONICS" },
];

const SHOWCASE_CATS = [
  { label: "ELECTRONICS", count: "4,200+" },
  { label: "FASHION", count: "12,800+" },
  { label: "HOME Furniture & Appliances", count: "6,400+" },
  { label: "PHONES & TABLET", count: "2,100+" },
  { label: "Vehicles", count: "1,800+" },
  { label: "PROPERTY", count: "3,600+" },
];

// const SHOWCASE_CATS = [
//   { label: 'Cars & Trucks',   sub: 'Buy · Sell · Hire'      },
//   { label: 'Property',        sub: 'Rent · Sale · Land'     },
//   { label: 'Phones & Tablets',sub: 'New & Used'             },
//   { label: 'ELECTRONICS',     sub: 'TVs · Audio · Cameras'  },
//   { label: 'FASHION',         sub: 'Men · Women · Kids'     },
//   { label: 'Home & Garden',   sub: 'Furniture · Appliances' },
// ]

const FOOTER_COLS = [
  {
    heading: "Shop",
    links: [
      "All Products",
      "Flash Deals",
      "New Arrivals",
      "Best Sellers",
      "Brand Store",
    ],
  },
  {
    heading: "Account",
    links: [
      "Sign In",
      "Register",
      "My Orders",
      "Wishlist",
      "Returns & Refunds",
    ],
  },
  {
    heading: "Sell",
    links: [
      "Start Selling",
      "Seller Hub",
      "Seller Protection",
      "Seller Policies",
      "Advertise",
    ],
  },
  {
    heading: "Help",
    links: [
      "Contact Support",
      "FAQs",
      "Delivery Info",
      "Payment Options",
      "Track Order",
    ],
  },
];

const FOOTER_LINK_DESTINATIONS: Record<string, string> = {
  "Contact Support": "/help#contact",
  FAQs: "/help#faqs",
  "Delivery Info": "/help#delivery",
  "Payment Options": "/help#payments",
  "Track Order": "/track-order",
  "My Orders": "/my-orders",
  "Sign In": "/login",
  Register: "/register",
};

// ─── Product Cards ────────────────────────────────────────────────────────────
function ProductCard({
  id,
  name,
  price,
  original,
  tag,
  image,
}: {
  id: string;
  name: string;
  price: number;
  original: number;
  tag: string;
  image?: string;
}) {
  const hasDiscount = original > price;

  return (
    <Link
      to={`/products/${id}`}
      className="border-t-2 border-black group cursor-pointer block"
    >
      {image ? (
        <div className="h-32 sm:h-44 overflow-hidden bg-neutral-100">
          <img src={image} alt={name} className="w-full h-full object-cover" />
        </div>
      ) : (
        <Wire h="h-32 sm:h-44" label="PRODUCT IMAGE" />
      )}
      <div className="p-3 space-y-1.5">
        {/* ...unchanged... */}
        <MicroLabel>{tag}</MicroLabel>
        <p className="text-[13px] font-semibold leading-snug line-clamp-2 mt-1">
          {name}
        </p>
        <div className="flex items-baseline gap-2 pt-1 flex-wrap">
          <span className="text-[15px] font-black">{fmt(price)}</span>
          {hasDiscount && (
            <>
              <span className="text-[11px] text-neutral-400 line-through">
                {fmt(original)}
              </span>
              <span className="text-[9px] font-black bg-black text-white px-1.5 py-0.5">
                -{pct(price, original)}%
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

function DealCard({
  name,
  price,
  original,
  tag,
}: {
  name: string;
  price: number;
  original: number;
  tag: string;
}) {
  return (
    <div className="bg-white text-black border-t-2 border-white/40 group cursor-pointer">
      <Wire h="h-28 sm:h-40" label="PRODUCT" />
      <div className="p-3 space-y-1">
        <MicroLabel>{tag}</MicroLabel>
        <p className="text-[13px] font-semibold leading-snug line-clamp-2 mt-1">
          {name}
        </p>
        <div className="flex items-baseline gap-2 pt-1 flex-wrap">
          <span className="text-[14px] font-black">{fmt(price)}</span>
          <span className="text-[9px] font-black bg-black text-white px-1.5 py-0.5">
            -{pct(price, original)}%
          </span>
        </div>
      </div>
    </div>
  );
}

function ArrivalCard({
  name,
  price,
  tag,
}: {
  name: string;
  price: number;
  tag: string;
}) {
  return (
    <div className="border-t-2 border-black cursor-pointer">
      <Wire h="h-32 sm:h-44" label="NEW" />
      <div className="p-3 space-y-1.5">
        <MicroLabel>{tag}</MicroLabel>
        <p className="text-[13px] font-semibold leading-snug mt-1">{name}</p>
        <span className="text-[15px] font-black block pt-1">{fmt(price)}</span>
      </div>
    </div>
  );
}

// ─── Homepage ──────────────────────────────────────────────────────────────

export default function Homepage() {
  const { activeNav } = useOutletContext<{ activeNav: string }>();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest("/products")
      .then((data) => setProducts(data))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered =
    activeNav === "All"
      ? products
      : products.filter((p) => p.category === activeNav);

  return (
    // <div
    //   className="bg-white text-black min-h-screen overflow-x-hidden"
    //   style={{ fontFamily: "'Barlow', 'Helvetica Neue', Arial, sans-serif" }}
    // >

    <>
      {/* ── Hero — stacked on mobile, side-by-side from md up ────────────── */}

      <section className="border-b-2 border-black px-4 md:px-8 py-10 md:py-16">
        <div className="max-w-screen-2xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          <div className="md:col-span-7 xl:col-span-6 flex flex-col items-start">
            <MicroLabel>Nigeria's Largest Online Marketplace</MicroLabel>

            <h1
              className="font-black uppercase leading-none mt-4 mb-6"
              style={{
                fontSize: "clamp(36px, 7.5vw, 116px)",
                letterSpacing: "-0.04em",
              }}
            >
              MILLIONS
              <br />
              OF DEALS.
              <br />
              ONE PLACE.
            </h1>

            <p className="text-[14px] md:text-[15px] text-neutral-600 font-medium max-w-sm mb-8 leading-relaxed">
              ELECTRONICS, fashion, home essentials and more — shipped fast to
              your door across all 36 states.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
              <button
                style={{ backgroundColor: "var(--vermilion)" }}
                className="px-10 py-4 text-white text-[10px] tracking-[0.25em] uppercase font-black"
              >
                Shop Now
              </button>
              <button className="px-10 py-4 text-black text-[10px] tracking-[0.25em] uppercase font-black border-2 border-black">
                View Deals
              </button>
            </div>

            {/* Trust badges — wraps into 2 columns on very small screens */}
            <div className="flex flex-wrap items-center gap-6 md:gap-8 mt-10 pt-8 border-t border-black/15 w-full">
              {[
                "Free Returns",
                "100% Authentic",
                "Secure Payments",
                "Fast Delivery",
              ].map((t) => (
                <div key={t} className="flex flex-col gap-0.5">
                  <div className="w-4 h-4 bg-black" />
                  <MicroLabel>{t}</MicroLabel>
                </div>
              ))}
            </div>
          </div>

          <div className="md:col-span-5 xl:col-span-6 grid grid-cols-2 gap-3">
            <Wire h="h-48 sm:h-72" label="HERO IMAGE" />
            <div className="flex flex-col gap-3">
              <Wire h="h-[92px] sm:h-36" label="PROMO TILE" />
              <Wire h="h-[92px] sm:h-36" label="PROMO TILE" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Category Showcase — 2 cols mobile, 3 sm, 6 from md up ────────── */}
      <section className="px-4 md:px-8 py-10 md:py-12 border-b border-black/15">
        <div className="max-w-screen-2xl mx-auto">
          <div className="flex items-baseline gap-4 mb-6">
            <MicroLabel>Browse By</MicroLabel>
            <h2
              className="font-black uppercase"
              style={{ fontSize: 18, letterSpacing: "-0.03em" }}
            >
              Category
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 border-l-2 border-t-2 border-black">
            {SHOWCASE_CATS.map((sc) => (
              <div
                key={sc.label}
                className="border-r-2 border-b-2 border-black p-4 cursor-pointer hover:bg-neutral-50"
              >
                <Wire h="h-16 sm:h-20" />
                <div className="mt-3">
                  <MicroLabel>{sc.label}</MicroLabel>
                  <p className="text-[10px] tracking-widest uppercase text-neutral-300 font-medium mt-0.5">
                    {sc.count} items
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Flash Sale — 2 cols mobile, 4 from sm up ─────────────────────── */}
      <section className="border-t-2 border-b-2 border-black bg-black text-white px-4 md:px-8 py-10 md:py-12">
        <div className="max-w-screen-2xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-baseline gap-6 md:gap-8 flex-wrap">
              <h2
                className="font-black uppercase leading-none"
                style={{ fontSize: 20, letterSpacing: "-0.03em" }}
              >
                Flash Sale
              </h2>
              <div className="flex items-center gap-2">
                <MicroLabel>Ends In</MicroLabel>
                <div className="flex items-center gap-1 ml-2">
                  {["02", "14", "38"].map((t, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <span className="bg-white text-black text-[13px] font-black px-2 py-0.5 font-mono leading-tight">
                        {t}
                      </span>
                      {i < 2 && (
                        <span className="text-white/50 font-black text-sm">
                          :
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <button className="text-[10px] tracking-[0.2em] uppercase font-black border border-white px-6 py-3 hover:bg-white hover:text-black transition-colors self-start sm:self-auto">
              All Deals
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {FLASH_DEALS.map((d) => (
              <DealCard key={d.id} {...d} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Best Sellers — 2 cols mobile, 4 from sm up ───────────────────── */}
      <section className="px-4 md:px-8 py-10 md:py-12 border-b border-black/15">
        <div className="max-w-screen-2xl mx-auto">
          <div className="flex items-baseline justify-between mb-6">
            <div>
              <MicroLabel>
                {activeNav === "All" ? "All Categories" : activeNav}
              </MicroLabel>
              <h2
                className="font-black uppercase mt-1"
                style={{ fontSize: 18, letterSpacing: "-0.03em" }}
              >
                Best Sellers
              </h2>
            </div>
            <button className="text-[10px] tracking-[0.2em] uppercase font-black border-b-2 border-black pb-0.5">
              View All
            </button>
          </div>

          {loading ? (
            <p className="text-center text-neutral-400 py-10">
              Loading products…
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-neutral-400 py-10">
              No products yet — check back soon.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {filtered.map((p) => (
                <ProductCard
                  key={p.id}
                  id={p.id}
                  name={p.name}
                  price={p.price}
                  original={p.originalPrice}
                  tag={p.category}
                  image={p.image}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Promo Banner — stacked on mobile, side-by-side from md up ────── */}
      <section className="border-t-2 border-b-2 border-black bg-neutral-50 px-4 md:px-8 py-10 md:py-16">
        <div className="max-w-screen-2xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-7">
            <MicroLabel>Limited Time Offer · This Week Only</MicroLabel>
            <p
              className="font-black uppercase leading-none mt-3"
              style={{
                fontSize: "clamp(28px, 4vw, 60px)",
                letterSpacing: "-0.04em",
              }}
            >
              UP TO 70% OFF
              <br />
              SELECTED ITEMS
            </p>
            <p className="text-[14px] text-neutral-600 font-medium mt-4 leading-relaxed">
              Over 2,400 products marked down this week. New discounts added
              every 24 hours.
            </p>
          </div>
          <div className="md:col-span-5 flex flex-col gap-4">
            <div className="p-5 border-2 border-black bg-white">
              <MicroLabel>Use Promo Code</MicroLabel>
              <p
                className="font-black uppercase tracking-tight mt-2"
                style={{ fontSize: 32, letterSpacing: "-0.04em" }}
              >
                Naija Mart 70
              </p>
            </div>
            <button className="w-full py-4 bg-black text-white text-[10px] tracking-[0.25em] uppercase font-black">
              Claim Discount
            </button>
          </div>
        </div>
      </section>

      {/* ── New Arrivals — 2 cols mobile, 4 from sm up ───────────────────── */}
      <section className="px-4 md:px-8 py-10 md:py-12 border-b border-black/15">
        <div className="max-w-screen-2xl mx-auto">
          <div className="flex items-baseline justify-between mb-6">
            <h2
              className="font-black uppercase"
              style={{ fontSize: 18, letterSpacing: "-0.03em" }}
            >
              New Arrivals
            </h2>
            <button className="text-[10px] tracking-[0.2em] uppercase font-black border-b-2 border-black pb-0.5">
              View All New
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {NEW_ARRIVALS.map((p) => (
              <ArrivalCard key={p.id} {...p} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Brand Strip — wraps into 4 cols mobile, single row from md up ── */}
      <section className="border-t-2 border-b-2 border-black px-4 md:px-8 py-8 bg-neutral-50">
        <div className="max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-8 mb-5">
            <MicroLabel>Official Brand Stores</MicroLabel>
          </div>
          <div className="flex flex-wrap items-center gap-0 border-l-2 border-t-2 border-black">
            {[
              "SAMSUNG",
              "APPLE",
              "HP",
              "SONY",
              "NIKE",
              "DYSON",
              "CANON",
              "LG",
            ].map((b) => (
              <div
                key={b}
                className="w-1/2 sm:w-1/4 md:flex-1 border-r-2 border-b-2 border-black h-16 flex items-center justify-center cursor-pointer hover:bg-white transition-colors"
              >
                <span className="text-[10px] md:text-[11px] tracking-[0.15em] md:tracking-[0.2em] uppercase font-black text-neutral-400">
                  {b}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer — stacked/columns adapt across breakpoints ────────────── */}
      <footer className="bg-black text-white px-4 md:px-8 pt-10 md:pt-14 pb-8">
        <div className="max-w-screen-2xl mx-auto">
          {/* Top grid — 2 cols mobile, 3 sm, 5 from md up */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-8 md:gap-12 mb-12 pb-12 border-b border-white/10">
            <div className="col-span-2 sm:col-span-3 md:col-span-1">
              <span
                className="font-black uppercase leading-none block mb-3"
                style={{ fontSize: 24, letterSpacing: "-0.05em" }}
              >
                Naija Mart
              </span>
              <p className="text-[12px] text-neutral-400 leading-relaxed font-medium max-w-sm">
                Nigeria's largest online marketplace. Fast delivery and buyer
                protection guaranteed across all 36 states.
              </p>
              <div className="flex items-center gap-2 mt-6">
                {["APP STORE", "GOOGLE PLAY"].map((s) => (
                  <div key={s} className="border border-white/20 px-3 py-2">
                    <span className="text-[9px] tracking-[0.18em] uppercase font-semibold">
                      {s}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {FOOTER_COLS.map((col) => (
              <div key={col.heading}>
                <MicroLabel>{col.heading}</MicroLabel>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((link) => {
                    const destination = FOOTER_LINK_DESTINATIONS[link];

                    return (
                      <li key={link}>
                        {destination ? (
                          <Link
                            to={destination}
                            className="text-[12px] text-neutral-400 hover:text-white font-medium transition-colors"
                          >
                            {link}
                          </Link>
                        ) : (
                          <a
                            href="#"
                            className="text-[12px] text-neutral-400 hover:text-white font-medium transition-colors"
                          >
                            {link}
                          </a>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          {/* Payment methods — wraps on mobile */}
          <div className="flex flex-wrap items-center gap-4 mb-8 pb-8 border-b border-white/10">
            <MicroLabel>Accepted Payments</MicroLabel>
            <div className="flex flex-wrap items-center gap-2">
              {["VISA", "MASTERCARD", "VERVE", "PAYSTACK", "OPAY", "USSD"].map(
                (m) => (
                  <div key={m} className="border border-white/20 px-2.5 py-1">
                    <span className="text-[9px] tracking-[0.15em] uppercase font-black text-neutral-300">
                      {m}
                    </span>
                  </div>
                ),
              )}
            </div>
          </div>

          {/* Bottom — stacked on mobile */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <MicroLabel>
              © 2026 Naija Mart Technologies Ltd. All Rights Reserved.
            </MicroLabel>
            <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-6">
              {[
                "Privacy Policy",
                "Terms of Use",
                "Cookie Policy",
                "Sitemap",
              ].map((link) => (
                <a
                  key={link}
                  href="#"
                  className="text-[9px] tracking-[0.18em] uppercase font-semibold text-neutral-500 hover:text-white transition-colors"
                >
                  {link}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
