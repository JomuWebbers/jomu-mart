import { Heart, ShoppingCart, Star, Truck } from "lucide-react";
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
    <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white transition-shadow hover:shadow-md">
      <div className="relative">
        <Link
          to={`/products/${product.id}`}
          aria-label={`View ${product.name}`}
          className="block aspect-square overflow-hidden bg-neutral-100"
        >
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-neutral-400">
              Product image unavailable
            </div>
          )}
        </Link>
        {hasDiscount && (
          <span className="absolute left-2 top-2 rounded bg-[#E63312] px-2 py-1 text-[10px] font-bold text-white">
            -{pct(product.price, originalPrice)}%
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
          className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white text-neutral-700 shadow-sm transition-colors hover:text-[#E63312] disabled:opacity-50"
        >
          <Heart
            className={`h-5 w-5 ${saved ? "fill-[#E63312] text-[#E63312]" : ""}`}
          />
        </button>
      </div>

      <div className="flex flex-1 flex-col p-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          {product.category}
        </span>
        <Link
          to={`/products/${product.id}`}
          className="mt-1 line-clamp-2 min-h-10 text-sm font-medium leading-5 text-neutral-900 hover:text-[#E63312]"
        >
          {product.name}
        </Link>

        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-base font-bold text-neutral-950">
            {fmt(product.price)}
          </span>
          {hasDiscount && (
            <span className="text-xs text-neutral-500 line-through">
              {fmt(originalPrice)}
            </span>
          )}
        </div>

        <div className="mt-2 flex min-h-5 items-center gap-1 text-xs text-neutral-600">
          {rating > 0 ? (
            <>
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
              <span className="font-semibold">{rating.toFixed(1)}</span>
              <span>({reviewCount})</span>
            </>
          ) : (
            <span className="text-neutral-400">No reviews yet</span>
          )}
        </div>

        <div className="mt-2 flex items-center gap-1 text-[11px] text-neutral-500">
          <Truck className="h-3.5 w-3.5 shrink-0" />
          <span>Delivery options at checkout</span>
        </div>

        <button
          type="button"
          onClick={() => onAddToCart(product)}
          disabled={outOfStock || isOwnListing}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded bg-black px-3 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#E63312] disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          <ShoppingCart className="h-4 w-4" />
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
