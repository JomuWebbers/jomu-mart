import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Heart } from "lucide-react";
import { useAuth } from "../context/useAuth";

type SavedItem = {
  id: string;
  name: string;
  price?: number;
  image?: string;
};

const MOCK_SAVED_ITEMS: SavedItem[] = [
  {
    id: "1",
    name: "StarLink V4",
    price: 590000,
    image:
      "https://images.unsplash.com/photo-1628973888124-a0e231d6f684?w=400&q=80",
  },
  {
    id: "2",
    name: "HP 240R G10 Notebook PC",
    price: 759000,
    image:
      "https://images.unsplash.com/photo-1588872657528-3518e1ec490d?w=400&q=80",
  },
];

const INITIAL_LIKED: Record<string, boolean> = MOCK_SAVED_ITEMS.reduce(
  (acc, item) => ({ ...acc, [item.id]: true }),
  {},
);

export default function SavedItems() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [savedItems, setSavedItems] = useState<SavedItem[]>(MOCK_SAVED_ITEMS);
  const [liked, setLiked] = useState<Record<string, boolean>>(INITIAL_LIKED);

    if (!token) {
    navigate("/login");
    return null;
  }


  
  const handleAddToCart = (item: SavedItem) =>
    toast.success(`${item.name} added to cart`);
  const handleRemove = (item: SavedItem) => {
    setSavedItems((prev) => prev.filter((i) => i.id !== item.id));
    setLiked((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
    toast.success(`${item.name} removed from saved items`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
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
      <div className="max-w-screen-2xl mx-auto px-4">
        {savedItems.length > 0 ? (
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
                      handleRemove(item);
                    }}
                    className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all ${liked[item.id] ? "bg-pink-600 text-white" : "bg-white/90 border border-neutral-200 text-neutral-600"}`}
                  >
                    {liked[item.id] ? (
                      <Heart className="w-5 h-5 fill-current" />
                    ) : (
                      <Heart className="w-5 h-5" />
                    )}
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
                  className="w-full mt-3 py-2.5 bg-pink-600 text-white text-sm font-bold rounded hover:bg-pink-700 transition-colors"
                >
                  Add to Cart
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="w-8 h-8 text-neutral-400" />
            </div>
            <h2 className="text-lg font-semibold text-black mb-2">
              No saved items yet
            </h2>
            <p className="text-neutral-600 max-w-xs mx-auto">
              Your saved items will appear here. Browse products and tap the
              heart icon to save them for later.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
