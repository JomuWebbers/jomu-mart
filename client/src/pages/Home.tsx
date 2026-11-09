import { useState, useEffect } from "react";
import { apiRequest } from "../lib/api";
import { MicroLabel } from "../components/wireframe-primitives";
import {
  Link,
  useNavigate,
  useOutletContext,
  useSearchParams,
} from "react-router-dom";
import { CATEGORY_NAMES } from "../data/categories";
import { fmt } from "../components/wireframe-helpers";
import {
  Baby,
  Coffee,
  House,
  Shirt,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Tv,
  type LucideIcon,
} from "lucide-react";
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

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "Phones & Tablets": Smartphone,
  Electronics: Tv,
  "Home, Furniture & Appliances": House,
  Fashion: Shirt,
  "Baby & Kids": Baby,
  "Beauty & Personal Care": Sparkles,
  "Food & Beverages": Coffee,
  "View All": ShoppingBag,
};

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

  const categoryTiles = CATEGORY_NAMES.map((name) => ({
    label: name,
    count: loading ? null : products.filter((p) => p.category === name).length,
  }));

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
    .slice(0, 5);

  // New arrivals = newest approved products first (API already sorts createdAt
  // desc), in stock only, max 4
  const newArrivals = products.filter((p) => (p.stock ?? 0) > 0).slice(0, 5);
  const heroProducts = products
    .filter((product) => product.image && (product.stock == null || product.stock > 0))
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-[#171916]">
      <main className="mx-auto min-h-screen max-w-[1120px] space-y-4 bg-[#171916] px-3 pt-0 pb-4 sm:space-y-5 sm:px-4 md:space-y-6 md:px-0 md:pt-0 md:pb-6">
      {/* ── Hero — fixed brand headline with gently rotating support copy ── */}
      <section className="overflow-hidden rounded-2xl bg-brand-cream px-3 py-3 sm:px-4 md:px-8 md:py-5">
        <div className="mx-auto grid max-w-screen-2xl grid-cols-1 items-stretch gap-3 lg:grid-cols-[minmax(0,1.8fr)_minmax(190px,0.82fr)]">
          <div className="relative flex min-h-[230px] flex-col items-start justify-center overflow-hidden rounded-2xl bg-brand-evergreen px-5 py-6 text-brand-surface shadow-card sm:min-h-[270px] sm:px-8 sm:py-8 lg:col-start-1 lg:row-start-1 lg:min-h-[320px] lg:px-10 lg:py-6">
            <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-20 size-64 rounded-full border-[32px] border-white/5 sm:size-80" />
            <span aria-hidden="true" className="pointer-events-none absolute bottom-[-8rem] right-[22%] size-64 rounded-full bg-white/5 blur-3xl" />
            <span className="relative inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/85">
              <span className="size-1.5 rounded-full bg-[#F4B942]" />
              A marketplace made for you
            </span>

            <h1 className="relative mt-5 max-w-xl text-4xl font-black leading-[0.98] tracking-[-0.055em] sm:mt-6 sm:text-5xl lg:max-w-none lg:text-6xl">
              Millions of deals
              <br />
              in one <span className="text-[#F4C86A]">place.</span>
            </h1>

            <div className="relative mt-4 min-h-7 text-base font-semibold text-white/90 sm:mt-5 sm:text-xl">
              <span key={heroPhraseIndex} className="hero-phrase">
                {HERO_PHRASES[heroPhraseIndex]}
              </span>
            </div>
            <p className="relative mt-2 max-w-md text-sm leading-6 text-white/70 sm:text-base">
              Discover electronics, style, and home essentials from sellers
              across Nigeria.
            </p>

            <div className="relative mt-5 flex w-full flex-col gap-3 min-[370px]:flex-row sm:mt-6 sm:w-auto">
              <button
                onClick={() => scrollTo("product-grid")}
                className="rounded-control bg-brand-surface px-4 py-3 text-sm font-bold text-brand-evergreen transition-colors hover:bg-[#F4C86A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white min-[370px]:flex-1 sm:px-6"
              >
                Shop products
              </button>
              <button
                onClick={() => scrollTo("flash-sale")}
                className="rounded-control border border-white/35 px-4 py-3 text-sm font-bold text-white transition-colors hover:border-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white min-[370px]:flex-1 sm:px-6"
              >
                Explore deals
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 lg:row-start-2">
            <div className="mx-auto max-w-screen-2xl rounded-2xl border border-brand-border bg-brand-surface px-3 py-3 shadow-card sm:px-4">
              <div className="mb-2 flex items-center justify-between gap-4">
                <h2 className="text-sm font-black tracking-tight text-brand-charcoal sm:text-base">
                  Browse by category
                </h2>
                <button
                  type="button"
                  onClick={() => selectCategory("All")}
                  className="shrink-0 rounded-control px-2 py-1.5 text-[11px] font-bold text-brand-evergreen transition-colors hover:bg-brand-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-evergreen"
                >
                  View all
                </button>
              </div>
              <nav
                aria-label="Browse by category"
                className="horizontal-scrollbar-hidden flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain"
              >
                {categoryTiles.map((sc) => {
                  const Icon = CATEGORY_ICONS[sc.label] ?? ShoppingBag;
                  const selected = activeNav === sc.label;

                  return (
                    <button
                      key={sc.label}
                      type="button"
                      onClick={() => selectCategory(sc.label)}
                      aria-pressed={selected}
                      className={`group flex min-h-20 min-w-28 flex-1 snap-start flex-col items-center justify-center gap-1.5 rounded-control border px-2 py-2 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-evergreen sm:min-h-24 sm:min-w-32 sm:gap-2 sm:rounded-card sm:px-3 sm:py-3 ${
                        selected
                          ? "border-brand-evergreen bg-brand-cream"
                          : "border-transparent bg-brand-surface hover:border-brand-border hover:bg-brand-cream"
                      }`}
                    >
                      <span className="flex size-8 items-center justify-center rounded-full bg-brand-cream text-brand-evergreen transition-colors group-hover:bg-white sm:size-9">
                        <Icon
                          aria-hidden="true"
                          className="size-4 stroke-[1.8] sm:size-[18px]"
                        />
                      </span>
                      <span className="line-clamp-2 min-h-7 text-[10px] font-bold leading-3.5 text-brand-charcoal sm:text-[11px] sm:leading-4">
                        {sc.label}
                      </span>
                      <span className="text-[9px] text-brand-muted sm:text-[10px]">
                        {sc.count === null ? "Loading…" : `${sc.count} items`}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          <div className="grid grid-cols-2 grid-rows-2 gap-2 sm:gap-3 lg:col-start-2 lg:row-start-1 lg:grid-cols-2 lg:grid-rows-2">
            {heroProducts.length > 0 ? (
              heroProducts.map((product, index) => (
                <Link
                  key={product.id}
                  to={`/products/${product.id}`}
                  aria-label={`View ${product.name}, ${fmt(product.price)}`}
                  className={`group relative min-h-28 overflow-hidden rounded-2xl shadow-card sm:min-h-36 lg:min-h-0 ${
                    index === 0 ? "row-span-2 bg-[#E8C994]" : "bg-brand-surface"
                  }`}
                >
                  <img
                    src={product.image ?? ""}
                    alt=""
                    loading={index === 0 ? "eager" : "lazy"}
                    className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-3 pt-10 text-white sm:px-4 sm:pb-4">
                    <span className="block line-clamp-1 text-[11px] font-semibold sm:text-sm">
                      {product.name}
                    </span>
                    <span className="mt-1 block text-sm font-black">
                      {fmt(product.price)}
                    </span>
                  </span>
                </Link>
              ))
            ) : (
              <>
                <div className="relative row-span-2 flex min-h-28 flex-col justify-between overflow-hidden rounded-2xl bg-[#E8C994] p-4 text-brand-charcoal shadow-card sm:min-h-36 sm:p-6">
                  <ShoppingBag aria-hidden="true" className="size-7 stroke-[1.5] sm:size-10" />
                  <div>
                    <span className="text-xs font-bold uppercase tracking-[0.15em]">
                      Find your next favorite
                    </span>
                    <span className="mt-2 block text-2xl font-black leading-tight sm:text-4xl">
                      Good things,
                      <br />
                      all together.
                    </span>
                  </div>
                </div>
                <div className="flex min-h-28 flex-col justify-between rounded-2xl bg-[#D9E5D7] p-3 text-brand-evergreen shadow-card sm:min-h-36 sm:p-5">
                  <Smartphone aria-hidden="true" className="size-6 stroke-[1.5] sm:size-8" />
                  <span className="text-xs font-bold sm:text-sm">Tech &amp; gadgets</span>
                </div>
                <div className="flex min-h-28 flex-col justify-between rounded-2xl bg-[#F1D9CE] p-3 text-brand-charcoal shadow-card sm:min-h-36 sm:p-5">
                  <House aria-hidden="true" className="size-6 stroke-[1.5] sm:size-8" />
                  <span className="text-xs font-bold sm:text-sm">Home &amp; living</span>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl bg-brand-cream px-3 py-4 sm:px-4 md:px-8">
        <div className="mx-auto grid max-w-screen-2xl grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {[
            { title: "Jomu Picks", copy: "Good finds, picked for you", icon: Sparkles, tone: "bg-[#D9E5D7] text-brand-evergreen" },
            { title: "Seller Spotlights", copy: "Meet trusted local sellers", icon: House, tone: "bg-[#E8C994] text-brand-charcoal" },
            { title: "Everyday Essentials", copy: "Useful things for every day", icon: ShoppingBag, tone: "bg-[#F1D9CE] text-brand-charcoal" },
            { title: "Deals Worth a Look", copy: "Fresh offers from the market", icon: Coffee, tone: "bg-brand-evergreen text-white" },
          ].map(({ title, copy, icon: Icon, tone }) => (
            <button
              key={title}
              type="button"
              onClick={() => scrollTo(title === "Deals Worth a Look" ? "flash-sale" : "product-grid")}
              className={`flex min-h-24 items-center gap-3 rounded-card p-3 text-left transition-transform hover:-translate-y-0.5 sm:min-h-28 sm:gap-4 sm:p-4 ${tone}`}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/60 sm:size-11">
                <Icon aria-hidden="true" className="size-5 sm:size-6" />
              </span>
              <span>
                <span className="block text-xs font-black sm:text-sm">{title}</span>
                <span className="mt-1 block text-[10px] leading-4 opacity-75 sm:text-xs">{copy}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Flash Sale — 2 cols mobile, 4 from sm up ─────────────────────── */}
      <section
        id="flash-sale"
        className="overflow-hidden rounded-2xl bg-brand-cream px-4 py-10 md:px-8 md:py-12"
      >
        <div className="mx-auto max-w-[1200px]">
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

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 xl:grid-cols-5">
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
        className="overflow-hidden rounded-2xl bg-brand-surface px-4 py-10 md:px-8 md:py-12"
      >
        <div className="mx-auto max-w-[1200px]">
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 xl:grid-cols-5">
              {filtered.map(renderProductCard)}
            </div>
          )}
        </div>
      </section>

      {/* ── Deal callout — based on live product discounts ───────────────── */}
      <section className="overflow-hidden rounded-2xl bg-brand-cream px-4 py-10 md:px-8 md:py-16">
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-8 md:grid-cols-12">
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
      <section className="overflow-hidden rounded-2xl bg-brand-surface px-4 py-10 md:px-8 md:py-12">
        <div className="mx-auto max-w-[1200px]">
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 xl:grid-cols-5">
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
      <section className="overflow-hidden rounded-2xl bg-brand-cream px-4 py-8 md:px-8">
        <div className="mx-auto max-w-[1120px]">
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
      </main>

      {/* ── Footer — stacked/columns adapt across breakpoints ────────────── */}
      <footer className="mx-auto mt-4 max-w-[1120px] overflow-hidden rounded-2xl bg-brand-evergreen px-4 pb-8 pt-10 text-white sm:mt-5 md:mt-6 md:px-8 md:pb-8 md:pt-14">
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
    </div>
  );
}
