import { useEffect, useState } from "react";
import { BadgeCheck, ImageIcon, MapPin } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { PageShell } from "../components/wireframe-primitives";
import { fmt } from "../components/wireframe-helpers";
import { apiRequest } from "../lib/api";

type StoreProduct = {
  id: string;
  name: string;
  price: number;
  originalPrice: number | null;
  image: string;
  category: string;
  stock: number | null;
  rating: number | null;
  reviewCount: number | null;
  sellerId: string;
};

type SellerStoreData = {
  seller: {
    id: string;
    name: string;
    avatar: string | null;
    isTrustedVendor: boolean;
    trustedVendorBusinessName: string | null;
    trustedVendorLocation: string | null;
    trustedVendorDescription: string | null;
    createdAt: string;
  };
  products: StoreProduct[];
};

type StoreLoadResult = {
  key: string;
  data?: SellerStoreData;
  error?: string;
};

export default function SellerStore() {
  const { id } = useParams();
  const [loadResult, setLoadResult] = useState<StoreLoadResult | null>(null);
  const [retry, setRetry] = useState(0);
  const requestKey = `${id ?? ""}:${retry}`;

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    apiRequest(`/users/${encodeURIComponent(id)}/store`)
      .then((data: SellerStoreData) => {
        if (!cancelled) setLoadResult({ key: requestKey, data });
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setLoadResult({
            key: requestKey,
            error:
              requestError instanceof Error
                ? requestError.message
                : "Could not load this seller's store.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, requestKey]);

  const currentResult =
    loadResult?.key === requestKey ? loadResult : null;
  const store = currentResult?.data ?? null;

  if (!id) {
    return <p className="p-8 text-center">Seller store not found.</p>;
  }

  if (!store) {
    return currentResult?.error ? (
      <div className="p-8 text-center" role="alert">
        <p>{currentResult.error}</p>
        <button
          type="button"
          onClick={() => setRetry((attempt) => attempt + 1)}
          className="mt-3 font-bold underline"
        >
          Try again
        </button>
      </div>
    ) : (
      <p className="p-8 text-center" role="status">Loading seller store…</p>
    );
  }

  const { seller, products } = store;
  const storeName = seller.trustedVendorBusinessName?.trim() || seller.name;
  const memberSince = new Date(seller.createdAt).toLocaleDateString("en-NG", {
    month: "long",
    year: "numeric",
  });

  return (
    <PageShell
      title=""
      breadcrumb={`Home / Seller / ${storeName}`}
      containerClassName="max-w-6xl"
    >
      <section className="mt-5 rounded-card border border-brand-border bg-brand-surface p-5 shadow-card sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-evergreen text-xl font-black text-white">
            {seller.avatar ? (
              <img src={seller.avatar} alt="" className="size-full object-cover" />
            ) : (
              storeName.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black text-brand-charcoal">{storeName}</h1>
              {seller.isTrustedVendor && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-cream px-2.5 py-1 text-xs font-bold text-brand-evergreen">
                  <BadgeCheck aria-hidden="true" className="size-4" />
                  Trusted seller
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-brand-muted">On Jomu Mart since {memberSince}</p>
            {seller.trustedVendorLocation && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-brand-muted">
                <MapPin aria-hidden="true" className="size-4 shrink-0" />
                {seller.trustedVendorLocation}
              </p>
            )}
          </div>
          <div className="shrink-0 rounded-control bg-brand-cream px-4 py-3 text-center">
            <span className="block text-xl font-black text-brand-charcoal">
              {products.length.toLocaleString("en-NG")}
            </span>
            <span className="text-xs font-semibold text-brand-muted">
              Active {products.length === 1 ? "listing" : "listings"}
            </span>
          </div>
        </div>
        {seller.trustedVendorDescription && (
          <p className="mt-5 border-t border-brand-border pt-4 text-sm leading-6 text-brand-muted">
            {seller.trustedVendorDescription}
          </p>
        )}
      </section>

      <section className="py-8">
        <h2 className="text-xl font-black text-brand-charcoal">
          Products from {storeName}
        </h2>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <Link
              key={product.id}
              to={`/products/${product.id}`}
              className="group overflow-hidden rounded-card border border-brand-border bg-brand-surface shadow-card transition-shadow hover:shadow-lg"
            >
              <div className="flex aspect-square items-center justify-center bg-brand-cream">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    loading="lazy"
                    className="size-full object-contain p-3 transition-transform group-hover:scale-105"
                  />
                ) : (
                  <ImageIcon aria-hidden="true" className="size-9 text-brand-muted" />
                )}
              </div>
              <div className="p-3 sm:p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-brand-evergreen">
                  {product.category}
                </p>
                <h3 className="mt-1 line-clamp-2 min-h-10 text-sm font-semibold text-brand-charcoal">
                  {product.name}
                </h3>
                <p className="mt-2 font-black text-brand-charcoal">{fmt(product.price)}</p>
                {product.rating != null && product.reviewCount ? (
                  <p className="mt-1 text-xs text-brand-muted">
                    ★ {product.rating.toFixed(1)} ({product.reviewCount}{" "}
                    {product.reviewCount === 1 ? "review" : "reviews"})
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-brand-muted">No reviews yet</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
