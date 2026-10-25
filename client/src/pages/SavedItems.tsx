import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Heart } from "lucide-react";
import { useAuth } from "../context/useAuth";
import { useCart } from "../context/useCart";
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
    <div className="min-h-screen bg-white">
      <div className="px-4 py-3 max-w-screen-2xl mx-auto">
        <nav className="flex items-center gap-2 text-sm text-neutral-600">
          <span className="cursor-pointer hover:text-black">Home</span>
          <span className="text-neutral-400">›</span>
          <span className="font-semibold text-black">Saved Items</span>
        </nav>
      </div>
      <div className="px-4 max-w-screen-2xl mx-auto">
        <h1 className="text-3xl font-bold text-black mb-6">Saved Items</h1>
      </div>
      <div className="max-w-screen-2xl mx-auto px-4 pb-20">
        {isLoading ? (
          <p className="py-20 text-center text-neutral-600" role="status">
            Loading saved items…
          </p>
        ) : error ? (
          <div className="py-20 text-center" role="alert">
            <p className="mb-4 text-neutral-600">{error}</p>
            <button
              onClick={handleRetry}
              className="border border-black px-6 py-2.5 text-sm font-bold hover:bg-black hover:text-white"
            >
              Try Again
            </button>
          </div>
        ) : savedItems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {savedItems.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-lg border border-neutral-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="relative aspect-square mb-3 overflow-hidden rounded">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-neutral-100 flex items-center justify-center text-neutral-400">
                      No image
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleRemove(item);
                    }}
                    disabled={removingId === item.id}
                    aria-label={`Remove ${item.name} from saved items`}
                    aria-busy={removingId === item.id}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center bg-black text-white transition-all disabled:opacity-50"
                  >
                    <Heart className="w-5 h-5 fill-current" />
                  </button>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-semibold text-black">
                    {item.name}
                  </span>
                  {item.price !== undefined && (
                    <span className="text-sm font-medium text-neutral-600 ml-1">
                      ₦{item.price.toLocaleString()}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleAddToCart(item)}
                  className="w-full mt-3 py-2.5 bg-black text-white text-sm font-bold rounded hover:bg-neutral-800 transition-colors"
                >
                  Add to Cart
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-neutral-200">
              <Heart className="w-10 h-10 text-neutral-400" />
            </div>
            <h2 className="text-lg font-semibold text-black mb-2">
              No saved items yet
            </h2>
            <p className="text-neutral-600 max-w-xs mx-auto mb-6">
              Items you save while browsing will appear here.
            </p>
            <Link
              to="/"
              className="px-6 py-2.5 border border-black text-black text-sm font-bold hover:bg-black hover:text-white transition-colors"
            >
              Start Shopping
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
