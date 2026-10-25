import React, { useState, useEffect, useCallback } from "react";

import { useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { useAuth } from "../context/useAuth";
import { PageShell } from "../components/wireframe-primitives";
import { STATES } from "../data/nigeriaLocations";
import toast from "react-hot-toast";
import {
  UserIcon,
  ShoppingBagIcon,
  WalletIcon,
  TicketIcon,
  UserXIcon,
  ShieldCheckIcon,
} from "lucide-react";
import TrustedVendorRequest from "../components/TrustedVendorRequest";

type User = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role?: string;
  accountBalance?: number;
};

type Address = {
  id: string;
  label: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  isDefault: boolean;
};

type Tab =
  | "account-information"
  | "delivery-address"
  | "order-history"
  | "pending-ratings"
  | "wallet"
  | "voucher"
  | "trusted-vendor"
  | "delete-account";

type ApiError = {
  response?: {
    data?: {
      message?: string;
    };
  };
};

const EMPTY_ADDRESS: Address = {
  id: "",
  label: "Home",
  address: "",
  city: "",
  state: STATES[0] || "Lagos",
  zip: "",
  isDefault: false,
};

export default function MyAccount() {
  const { user: authUser, token } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("account-information");
  const [userData, setUserData] = useState<User | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [pendingRatingsCount, setPendingRatingsCount] = useState(0);
  const [trustedVendorStatus, setTrustedVendorStatus] = useState<{ isTrustedVendor: boolean; trustedVendorRequestStatus: string | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [form, setForm] = useState<Address>(EMPTY_ADDRESS);

  const loadUser = useCallback(async () => {
    try {
      const data = await apiRequest("/users/me", { token: token ?? undefined });
      setUserData(data);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(apiErr?.response?.data?.message || "Failed to load profile");
    }
  }, [token]);

  const loadAddresses = useCallback(async () => {
    try {
      const data = await apiRequest("/addresses", {
        token: token ?? undefined,
      });
      setAddresses(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(
        apiErr?.response?.data?.message || "Failed to load addresses",
      );
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

  const loadTrustedVendorStatus = useCallback(async () => {
    try {
      const data = await apiRequest("/users/me", { token: token ?? undefined });
      setTrustedVendorStatus({
        isTrustedVendor: data.isTrustedVendor ?? false,
        trustedVendorRequestStatus: data.trustedVendorRequestStatus ?? null,
      });
    } catch {
      // Silent fail — trusted vendor section will show default state
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUser();
    loadAddresses();
    loadPendingRatingsCount();
    loadTrustedVendorStatus();
  }, [token, navigate, loadUser, loadAddresses, loadPendingRatingsCount, loadTrustedVendorStatus]);

  const handleSaveProfile = async () => {
    if (!token || !userData) return;
    setSaving(true);
    try {
      await apiRequest("/users/me", {
        method: "PATCH",
        body: { name: userData.name, phone: userData.phone ?? "" },
        token,
      });
      toast.success("Profile updated successfully");
      loadUser();
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(
        apiErr?.response?.data?.message || "Failed to update profile",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAddress = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const payload = {
        label: form.label || "Home",
        address: form.address,
        city: form.city,
        state: form.state,
        zip: form.zip,
        isDefault: form.isDefault,
      };
      if (editingAddress) {
        await apiRequest(`/addresses/${editingAddress.id}`, {
          method: "PATCH",
          body: payload,
          token,
        });
      } else {
        await apiRequest("/addresses", {
          method: "POST",
          body: payload,
          token,
        });
      }
      setForm(EMPTY_ADDRESS);
      setEditingAddress(null);
      setShowAddressForm(false);
      await loadAddresses();
      toast.success(editingAddress ? "Address updated" : "Address added");
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(apiErr?.response?.data?.message || "Failed to save address");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    if (!window.confirm("Delete this address?")) return;
    if (!token) return;
    try {
      await apiRequest(`/addresses/${id}`, { method: "DELETE", token });
      setAddresses((prev) => prev.filter((a) => a.id !== id));
      toast.success("Address deleted");
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(
        apiErr?.response?.data?.message || "Failed to delete address",
      );
    }
  };

  const handleSetDefault = async (id: string) => {
    if (!token) return;
    try {
      await apiRequest(`/addresses/${id}`, {
        method: "PATCH",
        body: { isDefault: true },
        token,
      });
      await loadAddresses();
      toast.success("Default address updated");
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(apiErr?.response?.data?.message || "Failed to set default");
    }
  };

  const navItems = [
    {
      section: "My Profile",
      icon: UserIcon,
      items: [
        { id: "account-information", label: "Account Information" },
        { id: "delivery-address", label: "Delivery Address" },
      ],
    },
    {
      section: "My Orders",
      icon: ShoppingBagIcon,
      items: [
        { id: "order-history", label: "Order History" },
        { id: "pending-ratings", label: "Pending Ratings", badge: pendingRatingsCount },
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
      section: "Trusted Vendor",
      icon: ShieldCheckIcon,
      items: [{ id: "trusted-vendor", label: "Trusted Vendor" }],
    },
    {
      section: "Delete Account",
      icon: UserXIcon,
      items: [{ id: "delete-account", label: "Delete Account" }],
    },
  ];

  return (
    <PageShell title="My Account" breadcrumb="MY ACCOUNT">
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
                      <group.icon className="w-5 h-5 text-gray-600" />
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
                            {item.badge ?? 0}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 p-8 md:p-12 overflow-y-auto">
            {tab === "account-information" && (
              <AccountInformation
                user={userData}
                onSave={handleSaveProfile}
                saving={saving}
              />
            )}
            {tab === "delivery-address" && (
              <DeliveryAddress
                addresses={addresses}
                form={form}
                setForm={setForm}
                editingAddress={editingAddress}
                showAddressForm={showAddressForm}
                setShowAddressForm={setShowAddressForm}
                onSave={handleSaveAddress}
                onDelete={handleDeleteAddress}
                onSetDefault={handleSetDefault}
                onEdit={(a) => {
                  setForm(a);
                  setEditingAddress(a);
                  setShowAddressForm(true);
                }}
                onAdd={() => {
                  setForm(EMPTY_ADDRESS);
                  setEditingAddress(null);
                  setShowAddressForm(true);
                }}
                saving={saving}
              />
            )}
            {tab === "order-history" && <OrdersSection />}
            {tab === "pending-ratings" && <OrdersSection />}
            {tab === "wallet" && <WalletView />}
            {tab === "voucher" && <VoucherView />}
            {tab === "trusted-vendor" && <TrustedVendorView />}
            {tab === "delete-account" && <DeleteAccountView />}
          </main>
        </div>
      </div>
    </PageShell>
  );
}

function AccountInformation({
  user,
  onSave,
  saving,
}: {
  user: User | null;
  onSave: (e: React.FormEvent) => Promise<void>;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    firstName: user?.name?.split(" ")[0] || "",
    lastName: user?.name?.split(" ").slice(1).join(" ") || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(e);
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            First Name
          </label>
          <input
            name="firstName"
            value={form.firstName}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Last Name
          </label>
          <input
            name="lastName"
            value={form.lastName}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
            required
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Email</label>
        <input
          name="email"
          value={form.email}
          onChange={handleChange}
          className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
          type="email"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Phone</label>
        <input
          name="phone"
          value={form.phone}
          onChange={handleChange}
          className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
          type="tel"
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="bg-black text-white px-6 py-2 rounded hover:bg-gray-800 disabled:opacity-50"
      >
        Save Changes
      </button>
    </form>
  );
}

function DeliveryAddress({
  addresses,
  form,
  setForm,
  editingAddress,
  showAddressForm,
  setShowAddressForm,
  onSave,
  onDelete,
  onSetDefault,
  onEdit,
  onAdd,
  saving,
}: {
  addresses: Address[];
  form: Address;
  setForm: React.Dispatch<React.SetStateAction<Address>>;
  editingAddress: Address | null;
  showAddressForm: boolean;
  setShowAddressForm: (value: boolean) => void;
  onSave: () => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSetDefault: (id: string) => Promise<void>;
  onEdit: (a: Address) => void;
  onAdd: () => void;
  saving: boolean;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };
  const handleIsDefaultChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, isDefault: e.target.checked }));
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave();
  };
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Delivery Addresses</h2>
        <button
          onClick={onAdd}
          className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800"
        >
          + Add Address
        </button>
      </div>
      {showAddressForm && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 bg-white p-4 border border-gray-300 rounded"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Label
              </label>
              <input
                name="label"
                value={form.label}
                onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Address
              </label>
              <input
                name="address"
                value={form.address}
                onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                City
              </label>
              <input
                name="city"
                value={form.city}
                onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                State
              </label>
              <input
                name="state"
                value={form.state}
                onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Zip Code
              </label>
              <input
                name="zip"
                value={form.zip}
                onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
                required
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isDefault"
              checked={form.isDefault}
              onChange={handleIsDefaultChange}
            />
            <label className="text-sm">Set as default</label>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-black text-white px-6 py-2 rounded hover:bg-gray-800 disabled:opacity-50"
          >
            {editingAddress ? "Update" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setShowAddressForm(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </form>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {addresses.map((addr) => (
          <div
            key={addr.id}
            className="bg-white p-4 border border-gray-300 rounded"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">{addr.label}</span>
              {addr.isDefault && (
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  Default
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-2">
              {addr.address}, {addr.city}, {addr.state} {addr.zip}
            </p>
            <div className="flex gap-2">
              {!addr.isDefault && (
                <button
                  onClick={() => onSetDefault(addr.id)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Set Default
                </button>
              )}
              <button
                onClick={() => {
                  onEdit(addr);
                }}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(addr.id)}
                className="text-xs text-red-600 hover:text-red-800"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {addresses.length === 0 && (
          <p className="text-gray-500">No addresses found.</p>
        )}
      </div>
    </div>
  );
}

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

function TrustedVendorView() {
  return (
    <div className="space-y-6">
      {trustedVendorStatus?.isTrustedVendor ? (
        <>
          <h2 className="text-lg font-bold">Trusted Vendor</h2>
          <div className="bg-green-50 border border-green-200 p-4 rounded">
            <p className="text-green-800 text-sm font-medium">
              You are already a trusted vendor.
            </p>
          </div>
        </>
      ) : trustedVendorStatus?.trustedVendorRequestStatus === "pending" ? (
        <>
          <h2 className="text-lg font-bold">Trusted Vendor</h2>
          <div className="bg-amber-50 border border-amber-200 p-4 rounded">
            <p className="text-amber-800 text-sm font-medium">
              Your trusted-vendor request is pending review.
            </p>
          </div>
        </>
      ) : (
        <>
          <h2 className="text-lg font-bold">Trusted Vendor</h2>
          <TrustedVendorRequest />
        </>
      )}
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
