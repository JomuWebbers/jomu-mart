import { Heart, ImageIcon, ShoppingCart, Star, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import { fmt, pct } from "./wireframe-helpers";

export type StoreProduct = {
  id: string;
  name: string;
  price: number;
  originalPrice?: number | null;
  image?: string | null;
  category: string;
  stock?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  sellerId: string;
};

type Props = {
  product: StoreProduct;
  saved: boolean;
  saving: boolean;
  isOwnListing: boolean;
  onToggleSaved: (product: StoreProduct) => void;
  onAddToCart: (product: StoreProduct) => void;
};

export default function StoreProductCard({
  product,
  saved,
  saving,
  isOwnListing,
  onToggleSaved,
  onAddToCart,
}: Props) {
  const originalPrice = product.originalPrice;
  const hasDiscount =
    originalPrice != null && originalPrice > product.price;
  const outOfStock = product.stock != null && product.stock <= 0;
  const rating = product.rating ?? 0;
  const reviewCount = product.reviewCount ?? 0;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-card border border-brand-border bg-brand-surface shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative p-2 pb-0 sm:p-3 sm:pb-0">
        <Link
          to={`/products/${product.id}`}
          aria-label={`View ${product.name}`}
          className="relative block aspect-square overflow-hidden rounded-xl bg-brand-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-evergreen"
        >
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              loading="lazy"
              className="size-full object-contain p-3 transition-transform duration-300 group-hover:scale-105 sm:p-5"
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 text-brand-muted">
              <ImageIcon aria-hidden="true" className="size-8 stroke-[1.5]" />
              <span className="text-xs">Image coming soon</span>
            </div>
          )}
          {outOfStock && (
            <span className="absolute inset-x-0 bottom-0 bg-brand-charcoal/80 px-3 py-2 text-center text-xs font-bold text-white">
              Currently unavailable
            </span>
          )}
        </Link>
        {hasDiscount && (
          <span className="absolute left-4 top-4 rounded-full bg-brand-accent px-2.5 py-1 text-[10px] font-bold text-white sm:left-5 sm:top-5">
            Save {pct(product.price, originalPrice)}%
          </span>
        )}
        <button
          type="button"
          onClick={() => onToggleSaved(product)}
          disabled={saving}
          aria-label={`${saved ? "Remove" : "Save"} ${product.name}${
            saved ? " from" : " to"
          } saved items`}
          aria-pressed={saved}
          className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-brand-surface/95 text-brand-charcoal shadow-sm transition-colors hover:text-brand-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-evergreen disabled:opacity-50 sm:right-5 sm:top-5"
        >
          <Heart
            aria-hidden="true"
            className={`size-5 ${saved ? "fill-brand-accent text-brand-accent" : ""}`}
          />
        </button>
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-brand-evergreen">
          {product.category}
        </span>
        <Link
          to={`/products/${product.id}`}
          className="mt-1 line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-brand-charcoal transition-colors hover:text-brand-evergreen focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-evergreen"
        >
          {product.name}
        </Link>

        <div className="mt-3 flex min-h-11 flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-lg font-black tracking-tight text-brand-charcoal sm:text-xl">
            {fmt(product.price)}
          </span>
          {hasDiscount && (
            <span className="text-xs text-brand-muted line-through">
              {fmt(originalPrice)}
            </span>
          )}
        </div>

        <div className="mt-1 flex min-h-5 items-center gap-1 text-xs text-brand-muted">
          {rating > 0 ? (
            <>
              <Star aria-hidden="true" className="size-3.5 fill-[#E7B342] text-[#9A6B13]" />
              <span className="font-semibold">{rating.toFixed(1)}</span>
              <span>
                ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
              </span>
            </>
          ) : (
            <span className="text-brand-muted">No reviews yet</span>
          )}
        </div>

        <div className="mt-3 flex items-center gap-1.5 border-t border-brand-border pt-3 text-[11px] text-brand-muted">
          <Truck aria-hidden="true" className="size-3.5 shrink-0 text-brand-evergreen" />
          <span>Delivery options at checkout</span>
        </div>

        <button
          type="button"
          onClick={() => onAddToCart(product)}
          disabled={outOfStock || isOwnListing}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-control bg-brand-evergreen px-3 py-3 text-xs font-bold text-white transition-colors hover:bg-brand-evergreen-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-evergreen disabled:cursor-not-allowed disabled:bg-brand-border disabled:text-brand-muted"
        >
          <ShoppingCart aria-hidden="true" className="size-4" />
          {outOfStock
            ? "Out of stock"
            : isOwnListing
              ? "Your listing"
              : "Add to cart"}
        </button>
      </div>
    </article>
  );
}
