import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, ShoppingBag, Trash2, Truck } from "lucide-react";
import { MicroLabel, PageShell } from "../components/wireframe-primitives";
import { fmt } from "../components/wireframe-helpers";
import { useCart } from "../context/useCart";
import { useAuth } from "../context/useAuth";
import { apiRequest } from "../lib/api";
import toast from "react-hot-toast";

type ProductSuggestion = {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
  stock?: number | null;
  sellerId: string;
};

export default function Cart() {
  const { items, addToCart, removeFromCart, updateQty, subtotal, totalItems } =
    useCart();
  const { user } = useAuth();
  const [suggestedProducts, setSuggestedProducts] = useState<ProductSuggestion[]>([]);
  const [suggestionError, setSuggestionError] = useState("");

  useEffect(() => {
    let cancelled = false;
    apiRequest("/products")
      .then((products: ProductSuggestion[]) => {
        if (!cancelled) {
          setSuggestedProducts(products);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSuggestionError(
            error instanceof Error
              ? error.message
              : "Could not load product suggestions.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const cartIds = new Set(items.map((item) => item.id));
  const suggestions = suggestedProducts
    .filter(
      (product) =>
        !cartIds.has(product.id) && (product.stock ?? 0) > 0,
    )
    .slice(0, 4);

  const handleAddSuggestion = (product: ProductSuggestion) => {
    if (user?.id === product.sellerId) {
      toast.error("You can’t purchase a listing you created.");
      return;
    }
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      sellerId: product.sellerId,
    });
    toast.success(`${product.name} added to cart`);
  };

  if (items.length === 0) {
    return (
      <PageShell title="Shopping Cart" breadcrumb="HOME / CART">
        <div className="mx-auto flex max-w-xl flex-col items-center rounded-lg border border-neutral-200 px-6 py-16 text-center">
          <ShoppingBag className="mb-5 h-12 w-12 text-neutral-300" />
          <h2 className="text-xl font-bold">Your cart is empty</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Browse the marketplace and add items you love to your cart.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 rounded bg-[#E63312] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-black"
          >
            Continue shopping <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Shopping Cart"
      breadcrumb={`HOME / CART · ${totalItems} ${totalItems === 1 ? "ITEM" : "ITEMS"}`}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-600">
          {totalItems} {totalItems === 1 ? "item" : "items"} in your cart
        </p>
        <Link to="/" className="text-sm font-semibold text-[#E63312] hover:underline">
          Continue shopping
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
        <main className="space-y-4 lg:col-span-8" aria-label="Cart items">
          {items.map((item) => (
            <article
              key={item.id}
              className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-4 sm:flex-row"
            >
              <Link
                to={`/products/${item.id}`}
                aria-label={`View ${item.name}`}
                className="aspect-square w-full shrink-0 overflow-hidden rounded bg-neutral-100 sm:h-28 sm:w-28"
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-xs text-neutral-400">
                    Image unavailable
                  </span>
                )}
              </Link>

              <div className="flex min-w-0 flex-1 flex-col justify-between gap-4 sm:flex-row">
                <div className="min-w-0">
                  <Link
                    to={`/products/${item.id}`}
                    className="line-clamp-2 font-semibold text-neutral-900 hover:text-[#E63312]"
                  >
                    {item.name}
                  </Link>
                  <p className="mt-1 text-xs text-neutral-500">
                    Ships from marketplace seller
                  </p>
                  <p className="mt-2 text-lg font-bold">{fmt(item.price)}</p>
                  <p className="text-xs text-neutral-500">each</p>
                </div>

                <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                  <div className="flex items-center rounded border border-neutral-300">
                    <button
                      type="button"
                      aria-label={`Decrease quantity of ${item.name}`}
                      onClick={() => updateQty(item.id, item.qty - 1)}
                      disabled={item.qty <= 1}
                      className="px-3 py-2 font-bold hover:text-[#E63312] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      −
                    </button>
                    <span
                      aria-label={`Quantity ${item.qty}`}
                      className="min-w-10 border-x border-neutral-300 px-3 py-2 text-center text-sm font-semibold"
                    >
                      {item.qty}
                    </span>
                    <button
                      type="button"
                      aria-label={`Increase quantity of ${item.name}`}
                      onClick={() => updateQty(item.id, item.qty + 1)}
                      className="px-3 py-2 font-bold hover:text-[#E63312]"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-bold">
                    <span className="text-xs font-normal text-neutral-500">Line total</span>
                    {fmt(item.price * item.qty)}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.id)}
                    aria-label={`Remove ${item.name} from cart`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-500 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>
              </div>
            </article>
          ))}

          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <ShieldCheck className="h-5 w-5 shrink-0 text-green-700" />
            <p className="text-xs text-neutral-600">
              Secure checkout · Buyer protection · Delivery fees are calculated by each seller at checkout.
            </p>
          </div>
        </main>

        <aside className="lg:col-span-4">
          <div className="rounded-lg border border-neutral-200 bg-white p-5 lg:sticky lg:top-4">
            <h2 className="text-lg font-bold">Order Summary</h2>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-neutral-600">Items subtotal ({totalItems})</span>
                <span className="font-semibold">{fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-neutral-600">Estimated delivery</span>
                <span className="text-right text-xs text-neutral-500">Calculated at checkout</span>
              </div>
              <div className="border-t border-neutral-200 pt-3">
                <div className="flex justify-between gap-3 text-base font-bold">
                  <span>Subtotal</span>
                  <span>{fmt(subtotal)}</span>
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-neutral-500">
              Seller delivery charges, if any, will be confirmed at checkout.
            </p>
            <Link
              to="/checkout"
              className="mt-5 flex w-full items-center justify-center gap-2 rounded bg-[#E63312] px-4 py-3.5 text-sm font-bold text-white transition-colors hover:bg-black"
            >
              Proceed to checkout <ArrowRight className="h-4 w-4" />
            </Link>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-neutral-500">
              <Truck className="h-4 w-4" /> Secure payment options at checkout
            </div>
          </div>
        </aside>
      </div>

      <section className="mt-12 border-t border-neutral-200 pt-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <MicroLabel>Keep browsing</MicroLabel>
            <h2 className="mt-1 text-xl font-bold">You may also like</h2>
          </div>
        </div>
        {suggestionError ? (
          <p className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
            {suggestionError}
          </p>
        ) : suggestions.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {suggestions.map((product) => (
              <article
                key={product.id}
                className="overflow-hidden rounded-lg border border-neutral-200 bg-white"
              >
                <Link
                  to={`/products/${product.id}`}
                  className="block aspect-square overflow-hidden bg-neutral-100"
                >
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center text-xs text-neutral-400">
                      Image unavailable
                    </span>
                  )}
                </Link>
                <div className="p-3">
                  <Link
                    to={`/products/${product.id}`}
                    className="line-clamp-2 min-h-10 text-sm font-semibold hover:text-[#E63312]"
                  >
                    {product.name}
                  </Link>
                  <p className="mt-2 font-bold">{fmt(product.price)}</p>
                  <button
                    type="button"
                    onClick={() => handleAddSuggestion(product)}
                    disabled={user?.id === product.sellerId}
                    className="mt-3 w-full rounded border border-neutral-300 px-3 py-2 text-xs font-bold hover:border-[#E63312] hover:text-[#E63312] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Add to cart
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">No product suggestions are available right now.</p>
        )}
      </section>
    </PageShell>
  );
}
