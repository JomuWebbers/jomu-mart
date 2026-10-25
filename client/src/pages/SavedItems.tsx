import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Heart } from "lucide-react";
import { useAuth } from "../context/useAuth";
import { useCart } from "../context/useCart";
import { useSavedItems } from "../context/useSavedItems";
import { apiRequest } from "../lib/api";

type SavedItem = {
  id: string;
  name: string;
  price: number;
  image: string;
  sellerId: string;
};

export default function SavedItems() {
  const { token } = useAuth();
  const { addToCart } = useCart();
  const { markSavedItem } = useSavedItems();

  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    apiRequest("/wishlist", { token })
      .then((items: SavedItem[]) => {
        if (!cancelled) setSavedItems(items);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load your saved items.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleRetry = () => {
    if (!token) return;
    setIsLoading(true);
    setError("");
    apiRequest("/wishlist", { token })
      .then((items: SavedItem[]) => setSavedItems(items))
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load your saved items.",
        );
      })
      .finally(() => setIsLoading(false));
  };

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const handleAddToCart = (item: SavedItem) => {
    addToCart({
      id: item.id,
      name: item.name,
      price: item.price,
      image: item.image,
      sellerId: item.sellerId,
    });
    toast.success(`${item.name} added to cart`);
  };
  const handleRemove = async (item: SavedItem) => {
    setRemovingId(item.id);
    try {
      await apiRequest(`/wishlist/${encodeURIComponent(item.id)}`, {
        method: "DELETE",
        token,
      });
      setSavedItems((prev) => prev.filter((saved) => saved.id !== item.id));
      markSavedItem(item.id, false);
      toast.success(`${item.name} removed from saved items`);
    } catch (removeError) {
      toast.error(
        removeError instanceof Error
          ? removeError.message
          : "Could not remove this saved item.",
      );
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-screen-2xl px-4 py-4 sm:px-6">
        <nav className="flex items-center gap-2 text-sm text-neutral-600" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-[#E63312]">Home</Link>
          <span aria-hidden="true" className="text-neutral-400">›</span>
          <span aria-current="page" className="font-semibold text-neutral-950">Saved Items</span>
        </nav>
        <div className="mb-6 mt-5 flex items-end justify-between border-b border-neutral-200 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-950 sm:text-3xl">Saved Items</h1>
            {!isLoading && !error && savedItems.length > 0 && (
              <p className="mt-1 text-sm text-neutral-500">
                {savedItems.length} {savedItems.length === 1 ? "item" : "items"} saved
              </p>
            )}
          </div>
        </div>
        {isLoading ? (
          <p className="py-20 text-center text-neutral-600" role="status">
            Loading saved items…
          </p>
        ) : error ? (
          <div className="py-20 text-center" role="alert">
            <p className="mb-4 text-neutral-600">{error}</p>
            <button
              onClick={handleRetry}
              className="rounded-md border border-black px-6 py-2.5 text-sm font-bold transition-colors hover:bg-black hover:text-white"
            >
              Try Again
            </button>
          </div>
        ) : savedItems.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 pb-16 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {savedItems.map((item) => (
              <div
                key={item.id}
                className="group flex min-w-0 flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white transition-shadow hover:shadow-md"
              >
                <div className="relative aspect-square overflow-hidden bg-neutral-100">
                  <Link
                    to={`/products/${encodeURIComponent(item.id)}`}
                    aria-label={`View ${item.name}`}
                    className="block h-full w-full"
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-neutral-400">
                        Product image unavailable
                      </div>
                    )}
                  </Link>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleRemove(item);
                    }}
                    disabled={removingId === item.id}
                    aria-label={`Remove ${item.name} from saved items`}
                    aria-busy={removingId === item.id}
                    className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#E63312] shadow-sm transition-colors hover:bg-neutral-100 disabled:cursor-wait disabled:opacity-50"
                  >
                    <Heart className="h-5 w-5 fill-current" />
                  </button>
                </div>
                <div className="flex flex-1 flex-col p-3">
                  <Link
                    to={`/products/${encodeURIComponent(item.id)}`}
                    className="line-clamp-2 min-h-10 text-sm font-medium leading-5 text-neutral-900 hover:text-[#E63312]"
                  >
                    {item.name}
                  </Link>
                  <span className="mt-2 text-base font-bold text-neutral-950">
                    ₦{item.price.toLocaleString()}
                  </span>
                  <button
                    onClick={() => handleAddToCart(item)}
                    className="mt-3 w-full rounded bg-black px-3 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#E63312]"
                  >
                    Add to cart
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center sm:py-20">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50">
              <Heart className="h-10 w-10 text-neutral-400" />
            </div>
            <h2 className="mb-2 text-lg font-semibold text-neutral-950">
              No saved items yet
            </h2>
            <p className="mx-auto mb-6 max-w-xs text-neutral-600">
              Items you save while browsing will appear here.
            </p>
            <Link
              to="/"
              className="inline-flex rounded-md bg-black px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#E63312]"
            >
              Start Shopping
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
