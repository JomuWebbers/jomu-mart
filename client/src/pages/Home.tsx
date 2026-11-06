import { useState, useEffect } from "react";
import { apiRequest } from "../lib/api";
import { Wire, MicroLabel } from "../components/wireframe-primitives";
import {
  Link,
  useNavigate,
  useOutletContext,
  useSearchParams,
} from "react-router-dom";
import { CATEGORY_NAMES } from "../data/categories";
import { fmt } from "../components/wireframe-helpers";
import { House, Smartphone, ShoppingBag } from "lucide-react";
import StoreProductCard, {
  type StoreProduct,
} from "../components/StoreProductCard";
import { useAuth } from "../context/useAuth";
import { useCart } from "../context/useCart";
import { useSavedItems } from "../context/useSavedItems";
import toast from "react-hot-toast";


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

const HERO_PHRASES = [
  "Great finds for every day.",
  "Something new to love.",
  "Good deals, close to home.",
  "Everything on your list, together.",
];

// ─── Homepage ──────────────────────────────────────────────────────────────

export default function Homepage() {
  const { activeNav, setActiveNav } = useOutletContext<{
    activeNav: string;
    setActiveNav: (category: string) => void;
  }>();
  const { token, user } = useAuth();
  const { addToCart } = useCart();
  const { markSavedItem, savedItemIds } = useSavedItems();
  const navigate = useNavigate();

  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadProducts, setReloadProducts] = useState(0);
  const [savingIds, setSavingIds] = useState<string[]>([]);
  const [heroPhraseIndex, setHeroPhraseIndex] = useState(0);

  useEffect(() => {
    apiRequest("/products")
      .then((data: StoreProduct[]) => setProducts(data))
      .catch((error: unknown) => {
        setLoadError(
          error instanceof Error ? error.message : "Could not load products.",
        );
      })
      .finally(() => setLoading(false));
  }, [reloadProducts]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const intervalId = window.setInterval(() => {
      setHeroPhraseIndex((index) => (index + 1) % HERO_PHRASES.length);
    }, 4500);

    return () => window.clearInterval(intervalId);
  }, []);

  const [searchParams] = useSearchParams();
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();

  const filtered = products.filter(
    (p) =>
      (activeNav === "All" || p.category === activeNav) &&
      (q === "" ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)),
  );

  // what happens when a tile is clicked: filter + jump to the product grid
  const selectCategory = (category: string) => {
    setActiveNav(category);
    scrollTo("product-grid");
  };

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const retryProducts = () => {
    setLoading(true);
    setLoadError("");
    setReloadProducts((current) => current + 1);
  };

  const addProductToCart = (product: StoreProduct) => {
    if (user?.id === product.sellerId) {
      toast.error("You can’t purchase a listing you created.");
      return;
    }
    if (product.stock != null && product.stock <= 0) {
      toast.error("This product is out of stock.");
      return;
    }

    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image ?? "",
      sellerId: product.sellerId,
    });
    toast.success(`${product.name} added to cart`);
  };

  const toggleSavedProduct = async (product: StoreProduct) => {
    if (!token) {
      toast.error("Sign in to save items.");
      navigate("/login");
      return;
    }
    if (savingIds.includes(product.id)) return;

    const currentlySaved = savedItemIds?.includes(product.id) ?? false;
    setSavingIds((current) => [...current, product.id]);
    try {
      await apiRequest(`/wishlist/${encodeURIComponent(product.id)}`, {
        method: currentlySaved ? "DELETE" : "POST",
        token,
      });
      markSavedItem(product.id, !currentlySaved);
      toast.success(
        currentlySaved
          ? "Removed from saved items"
          : "Added to saved items",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update saved items.",
      );
    } finally {
      setSavingIds((current) => current.filter((id) => id !== product.id));
    }
  };

  const renderProductCard = (product: StoreProduct) => (
    <StoreProductCard
      key={product.id}
      product={product}
      saved={savedItemIds?.includes(product.id) ?? false}
      saving={savingIds.includes(product.id)}
      isOwnListing={Boolean(user && user.id === product.sellerId)}
      onToggleSaved={(savedProduct) => void toggleSavedProduct(savedProduct)}
      onAddToCart={addProductToCart}
    />
  );

  const categoryTiles = [
    ...CATEGORY_NAMES.map((name) => ({
      label: name,
      count: loading
        ? null
        : products.filter((p) => p.category === name).length,
      isViewAll: false,
    })),
    {
      label: "View All",
      count: loading ? null : products.length,
      isViewAll: true,
    },
  ];

  // Deals are based on actual current prices and available stock.
  const discountedProducts = products.filter(
    (product) =>
      (product.originalPrice ?? 0) > product.price &&
      (product.stock ?? 0) > 0,
  );
  const flashDeals = [...discountedProducts]
    .sort(
      (a, b) =>
        ((b.originalPrice ?? 0) - b.price) / (b.originalPrice ?? 1) -
        ((a.originalPrice ?? 0) - a.price) / (a.originalPrice ?? 1),
    )
    .slice(0, 4);

  // New arrivals = newest approved products first (API already sorts createdAt
  // desc), in stock only, max 4
  const newArrivals = products.filter((p) => (p.stock ?? 0) > 0).slice(0, 4);
  const heroProducts = products
    .filter((product) => product.image && (product.stock == null || product.stock > 0))
    .slice(0, 3);

  return (
    <>
      {/* ── Hero — fixed brand headline with gently rotating support copy ── */}
      <section className="bg-brand-cream px-4 py-6 md:px-8 md:py-10">
        <div className="mx-auto grid max-w-screen-2xl overflow-hidden rounded-[1.75rem] bg-brand-evergreen text-brand-surface shadow-card lg:grid-cols-2">
          <div className="flex flex-col items-start justify-center px-6 py-10 sm:px-10 md:px-12 md:py-14">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/85">
              <span className="size-1.5 rounded-full bg-[#F4B942]" />
              A marketplace made for you
            </span>

            <h1 className="mt-6 max-w-xl text-4xl font-black leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-6xl xl:text-7xl">
              Millions of deals
              <br />
              in one <span className="text-[#F4C86A]">place.</span>
            </h1>

            <div className="mt-5 min-h-7 text-lg font-semibold text-white/90 sm:text-xl">
              <span key={heroPhraseIndex} className="hero-phrase">
                {HERO_PHRASES[heroPhraseIndex]}
              </span>
            </div>
            <p className="mt-2 max-w-md text-sm leading-6 text-white/70 sm:text-base">
              Discover electronics, style, and home essentials from sellers
              across Nigeria.
            </p>

            <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <button
                onClick={() => scrollTo("product-grid")}
                className="rounded-control bg-brand-surface px-7 py-3.5 text-sm font-bold text-brand-evergreen transition-colors hover:bg-[#F4C86A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Shop products
              </button>
              <button
                onClick={() => scrollTo("flash-sale")}
                className="rounded-control border border-white/35 px-7 py-3.5 text-sm font-bold text-white transition-colors hover:border-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Explore deals
              </button>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/20 pt-5 text-xs font-medium text-white/75">
              <span>Secure checkout</span>
              <span>Seller variety</span>
              <span>Delivery options at checkout</span>
            </div>
          </div>

          <div className="grid min-h-[340px] grid-cols-2 grid-rows-2 gap-3 p-4 pt-0 sm:min-h-[440px] sm:gap-4 sm:p-5 lg:min-h-full lg:pl-0">
            {heroProducts.length > 0 ? (
              heroProducts.map((product, index) => (
                <Link
                  key={product.id}
                  to={`/products/${product.id}`}
                  aria-label={`View ${product.name}, ${fmt(product.price)}`}
                  className={`group relative min-h-0 overflow-hidden rounded-2xl bg-brand-cream ${
                    index === 0 ? "row-span-2" : ""
                  }`}
                >
                  <img
                    src={product.image ?? ""}
                    alt=""
                    loading={index === 0 ? "eager" : "lazy"}
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-12 text-white">
                    <span className="block line-clamp-1 text-xs font-semibold sm:text-sm">
                      {product.name}
                    </span>
                    <span className="mt-1 block text-sm font-black sm:text-base">
                      {fmt(product.price)}
                    </span>
                  </span>
                </Link>
              ))
            ) : (
              <>
                <div className="row-span-2 flex flex-col justify-between rounded-2xl bg-[#E8C994] p-6 text-brand-charcoal sm:p-8">
                  <ShoppingBag aria-hidden="true" className="size-10 stroke-[1.5]" />
                  <div>
                    <span className="text-xs font-bold uppercase tracking-[0.15em]">
                      Find your next favorite
                    </span>
                    <span className="mt-2 block text-3xl font-black leading-tight sm:text-4xl">
                      Good things,
                      <br />
                      all together.
                    </span>
                  </div>
                </div>
                <div className="flex flex-col justify-between rounded-2xl bg-[#D9E5D7] p-4 text-brand-evergreen sm:p-5">
                  <Smartphone aria-hidden="true" className="size-8 stroke-[1.5]" />
                  <span className="text-sm font-bold">Tech &amp; gadgets</span>
                </div>
                <div className="flex flex-col justify-between rounded-2xl bg-[#F1D9CE] p-4 text-brand-charcoal sm:p-5">
                  <House aria-hidden="true" className="size-8 stroke-[1.5]" />
                  <span className="text-sm font-bold">Home &amp; living</span>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Category Showcase — 2 cols mobile, 3 sm, 4 from md up ────────── */}
      <section className="border-b border-brand-border bg-brand-surface px-4 py-10 md:px-8 md:py-12">
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
          <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-brand-border bg-brand-border sm:grid-cols-3 md:grid-cols-4">
            {categoryTiles.map((sc) => (
              <button
                key={sc.label}
                type="button"
                onClick={() => {
                  selectCategory(sc.isViewAll ? "All" : sc.label);
                  if (sc.isViewAll) scrollTo("product-grid");
                }}
                className="border-b border-r border-brand-border bg-brand-surface p-4 text-left transition-colors hover:bg-brand-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-brand-evergreen"
              >
                <Wire h="h-17 sm:h-20" />
                <div className="mt-3">
                  <MicroLabel>{sc.label}</MicroLabel>
                  <p className="text-[10px] tracking-widest uppercase text-neutral-300 font-medium mt-0.5">
                    {sc.count === null ? "…" : `${sc.count} items`}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Flash Sale — 2 cols mobile, 4 from sm up ─────────────────────── */}
      <section
        id="flash-sale"
        className="border-y border-brand-border bg-brand-cream px-4 py-10 md:px-8 md:py-12"
      >
        <div className="max-w-screen-2xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <MicroLabel>Currently discounted products</MicroLabel>
              <h2
                className="font-black uppercase leading-none mt-1"
                style={{ fontSize: 20, letterSpacing: "-0.03em" }}
              >
                Deals
              </h2>
            </div>
            <button
              onClick={() => scrollTo("product-grid")}
              className="self-start rounded-control border border-brand-evergreen px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-brand-evergreen transition-colors hover:bg-brand-evergreen hover:text-white sm:self-auto"
            >
              Browse products
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {flashDeals.length === 0 ? (
              <p className="col-span-full text-center text-neutral-500 py-10">
                {loading
                  ? "Loading deals…"
                  : "No discounted products are available right now."}
              </p>
            ) : (
              flashDeals.map(renderProductCard)
            )}
          </div>
        </div>
      </section>

      {/* ── Product listing — 2 cols mobile, 4 from sm up ───────────────── */}

      <section
        id="product-grid"
        className="border-b border-brand-border bg-brand-surface px-4 py-10 md:px-8 md:py-12"
      >
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
                {q
                  ? "Search Results"
                  : activeNav === "All"
                    ? "Shop Products"
                    : `${activeNav} Products`}
              </h2>
              {!loading && !loadError && (
                <p className="mt-1 text-xs text-neutral-500">
                  {filtered.length}{" "}
                  {filtered.length === 1 ? "product" : "products"}
                  {q ? ` matching “${searchParams.get("q")?.trim()}”` : ""}
                </p>
              )}
            </div>
            <button
              onClick={() => selectCategory("All")}
              className="border-b-2 border-brand-evergreen pb-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-brand-evergreen"
            >
              View All
            </button>
          </div>

          {loading ? (
            <p className="text-center text-neutral-400 py-10">
              Loading products…
            </p>
          ) : loadError ? (
            <div className="py-10 text-center" role="alert">
              <p className="mb-4 text-neutral-600">{loadError}</p>
              <button
                type="button"
                onClick={retryProducts}
                className="rounded-control bg-brand-evergreen px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-evergreen-strong"
              >
                Try again
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-neutral-400 py-10">
              {q || activeNav !== "All"
                ? "No products match this selection."
                : "No products are available yet."}
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {filtered.map(renderProductCard)}
            </div>
          )}
        </div>
      </section>

      {/* ── Deal callout — based on live product discounts ───────────────── */}
      <section className="border-y border-brand-border bg-brand-cream px-4 py-10 md:px-8 md:py-16">
        <div className="max-w-screen-2xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-7">
            <MicroLabel>Current marketplace deals</MicroLabel>
            <p
              className="font-black uppercase leading-none mt-3"
              style={{
                fontSize: "clamp(28px, 4vw, 60px)",
                letterSpacing: "-0.04em",
              }}
            >
              PRICE DROPS
              <br />
              AVAILABLE NOW
            </p>
            <p className="text-[14px] text-neutral-600 font-medium mt-4 leading-relaxed">
              {loading
                ? "Checking current discounts…"
                : `${discountedProducts.length} in-stock ${
                    discountedProducts.length === 1
                      ? "product has"
                      : "products have"
                  } a reduced price.`}
            </p>
          </div>
          <div className="md:col-span-5">
            <button
              type="button"
              onClick={() => scrollTo("flash-sale")}
              className="w-full rounded-control bg-brand-evergreen py-4 text-[10px] font-black uppercase tracking-[0.25em] text-white transition-colors hover:bg-brand-evergreen-strong"
            >
              Explore current deals
            </button>
          </div>
        </div>
      </section>

      {/* ── New Arrivals — 2 cols mobile, 4 from sm up ───────────────────── */}
      <section className="border-b border-brand-border bg-brand-surface px-4 py-10 md:px-8 md:py-12">
        <div className="max-w-screen-2xl mx-auto">
          <div className="flex items-baseline justify-between mb-6">
            <h2
              className="font-black uppercase"
              style={{ fontSize: 18, letterSpacing: "-0.03em" }}
            >
              New Arrivals
            </h2>
            <button
              onClick={() => selectCategory("All")}
              className="border-b-2 border-brand-evergreen pb-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-brand-evergreen"
            >
              View All New
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {newArrivals.length === 0 ? (
              <p className="col-span-full text-center text-neutral-400 py-10">
                {loading
                  ? "Loading new arrivals…"
                  : "No new arrivals yet — check back soon."}
              </p>
            ) : (
              newArrivals.map(renderProductCard)
            )}
          </div>
        </div>
      </section>

      {/* ── Brand Strip — wraps into 4 cols mobile, single row from md up ── */}
      <section className="border-y border-brand-border bg-brand-cream px-4 py-8 md:px-8">
        <div className="max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-8 mb-5">
            <MicroLabel>Official Brand Stores</MicroLabel>
          </div>
          <div className="flex flex-wrap items-center overflow-hidden rounded-xl border border-brand-border bg-brand-border">
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
                className="flex h-16 w-1/2 cursor-pointer items-center justify-center border-b border-r border-brand-border bg-brand-surface transition-colors hover:bg-white sm:w-1/4 md:flex-1"
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
      <footer className="bg-brand-evergreen px-4 pb-8 pt-10 text-white md:px-8 md:pb-8 md:pt-14">
        <div className="max-w-screen-2xl mx-auto">
          {/* Top grid — 2 cols mobile, 3 sm, 5 from md up */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-8 md:gap-12 mb-12 pb-12 border-b border-white/10">
            <div className="col-span-2 sm:col-span-3 md:col-span-1">
              <span
                className="font-black uppercase leading-none block mb-3"
                style={{ fontSize: 24, letterSpacing: "-0.05em" }}
              >
                Jomu Mart
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
            <MicroLabel>© 2026 Jomu Mart. All Rights Reserved.</MicroLabel>
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
