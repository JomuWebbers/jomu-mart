import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  HeartIcon,
  ShoppingBagIcon,
  TicketIcon,
  UserIcon,
  UserXIcon,
  WalletIcon,
} from "lucide-react";
import { PageShell } from "../components/wireframe-primitives";
import { apiRequest } from "../lib/api";
import { useAuth } from "../context/useAuth";
import type { User } from "../types/user.types";

type ApiError = {
  response?: {
    data?: {
      message?: string;
    };
  };
};

type SavedItem = {
  id: string;
  name: string;
  price?: number;
  image?: string;
};

type Tab =
  | "account-information"
  | "order-history"
  | "pending-ratings"
  | "wallet"
  | "voucher"
  | "saved-items"
  | "delete-account";

const navItems = [
  {
    section: "My Profile",
    icon: UserIcon,
    items: [{ id: "account-information", label: "Account Information" }],
  },
  {
    section: "My Orders",
    icon: ShoppingBagIcon,
    items: [
      { id: "order-history", label: "Order History" },
      { id: "pending-ratings", label: "Pending Ratings", badge: 0 },
    ],
  },
  {
    section: "My Wallet",
    icon: WalletIcon,
    items: [{ id: "wallet", label: "Wallet" }],
  },
  {
    section: "Voucher",
    icon: TicketIcon,
    items: [{ id: "voucher", label: "Voucher" }],
  },
  {
    section: "Delete Account",
    icon: UserXIcon,
    items: [{ id: "delete-account", label: "Delete Account" }],
  },
  {
    section: "Saved Items",
    icon: HeartIcon,
    items: [{ id: "saved-items", label: "Saved Items" }],
  },
];
function OrdersSection() {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">Order History</h2>
      <div className="bg-white p-4 border border-gray-300 rounded">
        <p className="text-gray-500">No orders found.</p>
      </div>
    </div>
  );
}

function WalletView() {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">My Wallet</h2>
      <div className="bg-white p-4 border border-gray-300 rounded">
        <p className="text-gray-500">Wallet functionality coming soon.</p>
      </div>
    </div>
  );
}

function VoucherView() {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">Vouchers</h2>
      <div className="bg-white p-4 border border-gray-300 rounded">
        <p className="text-gray-500">No vouchers found.</p>
      </div>
    </div>
  );
}

function DeleteAccountView() {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">Delete Account</h2>
      <div className="bg-white p-4 border border-gray-300 rounded">
        <p className="text-gray-500">
          Account deletion functionality coming soon.
        </p>
      </div>
    </div>
  );
}

function AccountInformation({
  user,
  onSave,
  saving,
  setUserData,
}: {
  user: User | null;
  onSave: () => void;
  saving: boolean;
  setUserData: React.Dispatch<React.SetStateAction<User | null>>;
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">Account Information</h2>
      <form
        onSubmit={async (e: React.FormEvent) => {
          e.preventDefault();
          await onSave();
        }}
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              value={user?.name || ""}
              onChange={(e) =>
                setUserData(
                  (prev: User | null) =>
                    ({
                      ...prev,
                      name: e.target.value,
                    }) as User,
                )
              }
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-black"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={user?.phone || ""}
              onChange={(e) =>
                setUserData(
                  (prev: User | null) =>
                    ({
                      ...prev,
                      phone: e.target.value,
                    }) as User,
                )
              }
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-black"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="mt-4 bg-black text-white px-6 py-2 rounded hover:bg-gray-800 disabled:opacity-50"
        >
          Save changes
        </button>
      </form>
    </div>
  );
}
export default function SavedItems() {
  const { user: authUser, token } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("saved-items");
  const [userData, setUserData] = useState<User | null>(null);
  const [pendingRatingsCount, setPendingRatingsCount] = useState(0);
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);

  const loadUser = useCallback(async () => {
    try {
      const data = await apiRequest("/users/me", { token: token ?? undefined });
      setUserData(data);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(apiErr?.response?.data?.message || "Failed to load profile");
    }
  }, [token]);

  const loadPendingRatingsCount = useCallback(async () => {
    try {
      const data = await apiRequest("/ratings/pending-count", {
        token: token ?? undefined,
      });
      if (typeof data === "number") {
        setPendingRatingsCount(data);
      } else if (data && typeof data.count === "number") {
        setPendingRatingsCount(data.count);
      }
    } catch {
      // Silent fail — badge stays at 0 until backend endpoint exists
    }
  }, [token]);

  const loadSavedItems = useCallback(async () => {
    try {
      const data = await apiRequest("/wishlist", {
        token: token ?? undefined,
      });
      setSavedItems(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(
        apiErr?.response?.data?.message || "Failed to load saved items",
      );
    }
  }, [token]);

  const handleSaveProfile = useCallback(async () => {
    toast("Profile save not yet implemented", { icon: "ℹ️" });
  }, []);

  useEffect(() => {
    const loadData = async () => {
      if (!token) {
        navigate("/login");
        return;
      }
      await loadUser();
      await loadPendingRatingsCount();
      await loadSavedItems();
    };
    loadData();
  }, [token, navigate, loadUser, loadPendingRatingsCount, loadSavedItems]);

  return (
    <PageShell title="Saved Items" breadcrumb="SAVED ITEMS">
      <div className="border-2 border-black bg-neutral-50 min-h-screen">
        <div className="flex h-screen">
          {/* Sidebar */}
          <aside className="w-64 border-r border-black bg-white hidden md:flex flex-col">
            <div className="p-4">
              <h2 className="text-lg font-bold">My Account</h2>
              <p className="text-sm text-gray-500">{authUser?.email || ""}</p>
              <nav className="mt-6 space-y-4">
                {navItems.map((group) => (
                  <div key={group.section} className="mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      {group.icon && (
                        <group.icon className="w-5 h-5 text-gray-600" />
                      )}
                      <h3 className="text-sm font-semibold text-gray-800">
                        {group.section}
                      </h3>
                    </div>
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setTab(item.id as Tab)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-left ${
                          tab === item.id
                            ? "bg-black text-white"
                            : "text-gray-600 hover:bg-neutral-100 hover:text-gray-900"
                        }`}
                      >
                        {item.label}
                        {item.id === "pending-ratings" && (
                          <span className="ml-auto px-2 py-0.5 rounded bg-gray-200 text-gray-600 text-xs font-bold">
                            {pendingRatingsCount}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ))}
              </nav>
              <button
                onClick={() => setTab("delete-account")}
                className="mt-auto pt-4 text-left px-3 py-2 text-red-600 hover:bg-red-50 rounded"
              >
                Delete Account
              </button>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 p-8 md:p-12 overflow-y-auto">
            {tab === "account-information" && (
              <AccountInformation
                user={userData}
                onSave={handleSaveProfile}
                saving={false}
                setUserData={setUserData}
              />
            )}
            {tab === "order-history" && <OrdersSection />}
            {tab === "pending-ratings" && <OrdersSection />}
            {tab === "wallet" && <WalletView />}
            {tab === "voucher" && <VoucherView />}
            {tab === "delete-account" && <DeleteAccountView />}
            {tab === "saved-items" && (
              <SavedItemsContent savedItems={savedItems} />
            )}
          </main>
        </div>
      </div>
    </PageShell>
  );
}

function SavedItemsContent({ savedItems }: { savedItems: SavedItem[] }) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">My Saved Items</h2>
      {savedItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {savedItems.map((item) => (
            <div
              key={item.id}
              className="bg-white p-4 border border-gray-300 rounded"
            >
              {item.image && (
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-40 object-cover rounded mb-3"
                />
              )}
              <h3 className="text-sm font-medium">{item.name}</h3>
              {item.price !== undefined && (
                <p className="text-gray-500">₦{item.price}</p>
              )}
              <button
                className="mt-2 text-blue-600 hover:text-blue-800"
                onClick={() => {
                  // Remove from wishlist - would call API
                  toast("Remove from wishlist (not implemented yet)");
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500">No saved items found.</p>
      )}
    </div>
  );
}
