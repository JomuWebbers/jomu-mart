import React, { useState, useEffect, useCallback } from "react";

import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { useAuth } from "../context/useAuth";
import { PageShell } from "../components/wireframe-primitives";
import { CATEGORIES } from "../data/categories";
import { CITIES_BY_STATE, STATES } from "../data/nigeriaLocations";
import toast from "react-hot-toast";
import {
  UserIcon,
  ShoppingBagIcon,
  WalletIcon,
  TicketIcon,
  UserXIcon,
  ShieldCheckIcon,
  Eye,
  EyeOff,
  MapPin,
  Star,
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  Eye as BalanceVisibleIcon,
  EyeOff as BalanceHiddenIcon,
  X,
} from "lucide-react";
import MyOrders from "./MyOrders";

type User = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role?: string;
  accountBalance?: number;
  isTrustedVendor?: boolean;
  trustedVendorRequestStatus?: string | null;
  trustedVendorBusinessName?: string | null;
  trustedVendorCategories?: string[];
  trustedVendorLocation?: string | null;
  trustedVendorDescription?: string | null;
  trustedVendorWebsite?: string | null;
  trustedVendorRequestedAt?: string | null;
  trustedVendorRejectionReason?: string | null;
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

type PendingRating = {
  productId: string;
  orderId: string;
  name: string;
  image: string;
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

const ACCOUNT_SECTION_PATHS: Record<Tab, string> = {
  "account-information": "/my-account/profile",
  "delivery-address": "/my-account/delivery-addresses",
  "order-history": "/my-account/orders",
  "pending-ratings": "/my-account/pending-ratings",
  wallet: "/my-account/wallet",
  voucher: "/my-account/vouchers",
  "trusted-vendor": "/my-account/trusted-vendor",
  "delete-account": "/my-account/delete-account",
};

const ACCOUNT_PATH_SECTIONS: Record<string, Tab> = Object.fromEntries(
  Object.entries(ACCOUNT_SECTION_PATHS).map(([section, path]) => [
    path,
    section as Tab,
  ]),
);

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
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const legacySection = searchParams.get("section");
  const legacyTab: Tab | undefined =
    legacySection === "pending-ratings" || legacySection === "order-history"
      ? legacySection
      : undefined;
  const tab =
    ACCOUNT_PATH_SECTIONS[location.pathname] ??
    (location.pathname === "/my-account"
      ? legacyTab ?? "account-information"
      : "account-information");
  const [userData, setUserData] = useState<User | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [addressesError, setAddressesError] = useState("");
  const [pendingRatings, setPendingRatings] = useState<PendingRating[]>([]);
  const [pendingRatingsCount, setPendingRatingsCount] = useState(0);
  const [pendingRatingsLoading, setPendingRatingsLoading] = useState(true);
  const [pendingRatingsError, setPendingRatingsError] = useState("");
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
    setAddressesLoading(true);
    setAddressesError("");
    try {
      const data = await apiRequest("/addresses", {
        token: token ?? undefined,
      });
      if (!Array.isArray(data)) {
        throw new Error("The address service returned an invalid response.");
      }
      setAddresses(data);
      return true;
    } catch (err: unknown) {
      setAddressesError(
        err instanceof Error ? err.message : "Failed to load addresses.",
      );
      return false;
    } finally {
      setAddressesLoading(false);
    }
  }, [token]);

  const loadPendingRatings = useCallback(async () => {
    setPendingRatingsLoading(true);
    setPendingRatingsError("");
    try {
      const data = await apiRequest("/orders/pending-ratings", {
        token: token ?? undefined,
      });
      if (!Array.isArray(data)) {
        throw new Error("The ratings service returned an invalid response.");
      }
      setPendingRatings(data);
      setPendingRatingsCount(data.length);
    } catch (err: unknown) {
      setPendingRatingsError(
        err instanceof Error ? err.message : "Failed to load products for review.",
      );
    } finally {
      setPendingRatingsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (location.pathname === "/my-account") {
      navigate(ACCOUNT_SECTION_PATHS[tab], { replace: true });
    }
  }, [location.pathname, navigate, tab]);

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUser();
    loadAddresses();
    loadPendingRatings();
  }, [token, navigate, loadUser, loadAddresses, loadPendingRatings]);

  const handleSaveProfile = async (name: string, phone: string) => {
    if (!token) return;
    setSaving(true);
    try {
      await apiRequest("/users/me", {
        method: "PATCH",
        body: { name, phone },
        token,
      });
      toast.success("Profile updated successfully");
      await loadUser();
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(
        apiErr?.response?.data?.message || "Failed to update profile",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (passwords: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => {
    if (!token) return false;
    try {
      await apiRequest("/users/password", {
        method: "PATCH",
        body: passwords,
        token,
      });
      toast.success("Password updated successfully");
      return true;
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(
        apiErr?.response?.data?.message ||
          (err instanceof Error ? err.message : "Failed to update password"),
      );
      return false;
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
      await loadAddresses();
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
      <div className="grid min-h-[560px] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm md:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="hidden border-r border-neutral-200 bg-neutral-50 md:block">
          <div className="border-b border-neutral-200 p-5">
            <h2 className="font-bold text-neutral-950">My Account</h2>
            <p className="mt-1 break-all text-sm text-neutral-500">
              {authUser?.email || ""}
            </p>
          </div>
          <nav className="space-y-5 p-4" aria-label="Account sections">
            {navItems.map((group) => (
              <div key={group.section}>
                <div className="mb-2 flex items-center gap-2 px-2">
                  <group.icon className="h-4 w-4 text-neutral-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-500">
                    {group.section}
                  </h3>
                </div>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <Link
                      key={item.id}
                      to={ACCOUNT_SECTION_PATHS[item.id as Tab]}
                      aria-current={tab === item.id ? "page" : undefined}
                      className={`flex min-h-10 items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E63312] ${
                        tab === item.id
                          ? "bg-black font-semibold text-white"
                          : "text-neutral-700 hover:bg-neutral-200"
                      }`}
                    >
                      {item.label}
                      {item.id === "pending-ratings" && (
                        <span
                          className={`ml-auto rounded px-2 py-0.5 text-xs font-bold ${
                            tab === item.id
                              ? "bg-white text-black"
                              : "bg-neutral-200 text-neutral-700"
                          }`}
                        >
                          {pendingRatingsCount}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <div className="min-w-0">
          <nav
            className="flex gap-2 overflow-x-auto border-b border-neutral-200 p-3 md:hidden"
            aria-label="Account sections"
          >
            {navItems.flatMap((group) =>
              group.items.map((item) => (
                <Link
                  key={item.id}
                  to={ACCOUNT_SECTION_PATHS[item.id as Tab]}
                  aria-current={tab === item.id ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E63312] ${
                    tab === item.id
                      ? "border-black bg-black text-white"
                      : "border-neutral-200 text-neutral-700"
                  }`}
                >
                  {item.label}
                  {item.id === "pending-ratings" && (
                    <span className="rounded-full bg-[#E63312] px-1.5 py-0.5 text-[10px] text-white">
                      {pendingRatingsCount}
                    </span>
                  )}
                </Link>
              )),
            )}
          </nav>

          <main className="min-w-0 p-4 sm:p-6 lg:p-8">
            {tab === "account-information" && (
              userData ? (
                <AccountInformation
                  key={`${userData.id}:${userData.name}:${userData.phone ?? ""}`}
                  user={userData}
                  onSave={handleSaveProfile}
                  onChangePassword={handleChangePassword}
                  saving={saving}
                />
              ) : (
                <p className="py-12 text-center text-sm text-neutral-500" role="status">
                  Loading your profile…
                </p>
              )
            )}
            {tab === "delivery-address" && (
              <DeliveryAddress
                addresses={addresses}
                loading={addressesLoading}
                error={addressesError}
                onRetry={() => void loadAddresses()}
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
            {tab === "pending-ratings" && (
              <PendingRatingsSection
                items={pendingRatings}
                loading={pendingRatingsLoading}
                error={pendingRatingsError}
                onRetry={() => void loadPendingRatings()}
                onReviewed={loadPendingRatings}
              />
            )}
            {tab === "wallet" && <WalletView />}
            {tab === "voucher" && <VoucherView />}
            {tab === "trusted-vendor" && (
              <TrustedVendorView
                status={userData}
                token={token}
                onSubmitted={loadUser}
              />
            )}
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
  onChangePassword,
  saving,
}: {
  user: User;
  onSave: (name: string, phone: string) => Promise<void>;
  onChangePassword: (passwords: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => Promise<boolean>;
  saving: boolean;
}) {
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [visiblePasswords, setVisiblePasswords] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [changingPassword, setChangingPassword] = useState(false);
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
    const name = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
    await onSave(name, form.phone);
  };
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error("New password and confirmation do not match");
      return;
    }

    setChangingPassword(true);
    try {
      const updated = await onChangePassword(passwords);
      if (updated) {
        setPasswords({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      }
    } finally {
      setChangingPassword(false);
    }
  };

  const passwordFields = [
    { name: "currentPassword", label: "Current Password", autoComplete: "current-password" },
    { name: "newPassword", label: "New Password", autoComplete: "new-password" },
    { name: "confirmPassword", label: "Confirm New Password", autoComplete: "new-password" },
  ] as const;

  const togglePasswordVisibility = (
    field: keyof typeof visiblePasswords,
  ) => {
    setVisiblePasswords((current) => ({
      ...current,
      [field]: !current[field],
    }));
  };

  const handlePasswordChange = (
    field: keyof typeof passwords,
    value: string,
  ) => {
    setPasswords((current) => ({ ...current, [field]: value }));
  };

  const renderPasswordField = (
    field: (typeof passwordFields)[number],
  ) => (
    <div key={field.name} className="space-y-1.5">
      <label
        htmlFor={`profile-${field.name}`}
        className="block text-sm font-medium text-neutral-700"
      >
        {field.label}
      </label>
      <div className="relative">
        <input
          id={`profile-${field.name}`}
          name={field.name}
          type={visiblePasswords[field.name] ? "text" : "password"}
          value={passwords[field.name]}
          onChange={(event) =>
            handlePasswordChange(field.name, event.target.value)
          }
          autoComplete={field.autoComplete}
          minLength={field.name === "currentPassword" ? undefined : 6}
          required
          disabled={changingPassword}
          className="block w-full rounded-md border border-neutral-300 px-3 py-2.5 pr-12 focus:border-black focus:outline-none focus:ring-1 focus:ring-black disabled:bg-neutral-50"
        />
        <button
          type="button"
          onClick={() => togglePasswordVisibility(field.name)}
          aria-label={`${visiblePasswords[field.name] ? "Hide" : "Show"} ${field.label.toLowerCase()}`}
          aria-pressed={visiblePasswords[field.name]}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-neutral-500 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#E63312]"
        >
          {visiblePasswords[field.name] ? (
            <EyeOff className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Eye className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl space-y-8">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="border-b border-neutral-200 pb-4">
          <h2 className="text-xl font-bold text-neutral-950">Account Information</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Update your personal details and how we reach you.
          </p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="profile-first-name" className="block text-sm font-medium text-neutral-700">
            First Name
          </label>
          <input
            id="profile-first-name"
            name="firstName"
            value={form.firstName}
            onChange={handleChange}
            className="block w-full rounded-md border border-neutral-300 px-3 py-2.5 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="profile-last-name" className="block text-sm font-medium text-neutral-700">
            Last Name
          </label>
          <input
            id="profile-last-name"
            name="lastName"
            value={form.lastName}
            onChange={handleChange}
            className="block w-full rounded-md border border-neutral-300 px-3 py-2.5 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            required
          />
        </div>
      <div className="space-y-1.5">
        <label htmlFor="profile-email" className="block text-sm font-medium text-neutral-700">Email</label>
        <input
          id="profile-email"
          name="email"
          value={form.email}
          readOnly
          aria-describedby="profile-email-help"
          className="block w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-neutral-600"
          type="email"
        />
        <p id="profile-email-help" className="text-xs text-neutral-500">
          Email address cannot be changed here.
        </p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="profile-phone" className="block text-sm font-medium text-neutral-700">Phone</label>
        <input
          id="profile-phone"
          name="phone"
          value={form.phone}
          onChange={handleChange}
          className="block w-full rounded-md border border-neutral-300 px-3 py-2.5 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
          type="tel"
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-black px-6 py-2.5 font-semibold text-white transition-colors hover:bg-[#E63312] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Changes"}
      </button>
      </form>

      <form
      onSubmit={handlePasswordSubmit}
      className="space-y-5 border-t border-neutral-200 pt-6"
      >
      <div>
        <h2 className="text-lg font-bold text-neutral-950">
          Password &amp; Security
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Verify your current password before choosing a new one.
        </p>
      </div>
      <div className="space-y-5">
        {passwordFields.map(renderPasswordField)}
      </div>
      <button
        type="submit"
        disabled={changingPassword}
        className="rounded-md bg-black px-6 py-2.5 font-semibold text-white transition-colors hover:bg-[#E63312] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {changingPassword ? "Updating password…" : "Update Password"}
      </button>
      </form>
    </div>
  );
}

function DeliveryAddress({
  addresses,
  loading,
  error,
  onRetry,
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
  loading: boolean;
  error: string;
  onRetry: () => void;
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
  const handleLocationChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setForm((prev) =>
      name === "state"
        ? { ...prev, state: value, city: "" }
        : { ...prev, city: value },
    );
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
          type="button"
          onClick={onAdd}
          className="rounded-md bg-black px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#E63312]"
        >
          + Add Address
        </button>
      </div>
      {error && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4"
          role="alert"
        >
          <p className="text-sm text-red-800">
            Could not load delivery addresses: {error}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-md border border-red-300 px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-100"
          >
            Try again
          </button>
        </div>
      )}
      {showAddressForm && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 bg-white p-4 border border-gray-300 rounded"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="delivery-label" className="block text-sm font-medium text-neutral-700">
                Label
              </label>
              <input
                id="delivery-label"
                name="label"
                value={form.label}
                onChange={handleChange}
                className="block w-full rounded-md border border-neutral-300 px-3 py-2.5"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="delivery-street" className="block text-sm font-medium text-neutral-700">
                Address
              </label>
              <input
                id="delivery-street"
                name="address"
                value={form.address}
                onChange={handleChange}
                className="block w-full rounded-md border border-neutral-300 px-3 py-2.5"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="delivery-state" className="block text-sm font-medium text-neutral-700">
                State
              </label>
              <select
                id="delivery-state"
                name="state"
                value={form.state}
                onChange={handleLocationChange}
                className="block w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5"
                required
              >
                {STATES.map((state) => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="delivery-city" className="block text-sm font-medium text-neutral-700">
                City
              </label>
              <select
                id="delivery-city"
                name="city"
                value={form.city}
                onChange={handleLocationChange}
                className="block w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5"
                required
              >
                <option value="" disabled>Select city / local government</option>
                {form.city && !CITIES_BY_STATE[form.state]?.includes(form.city) && (
                  <option value={form.city}>{form.city}</option>
                )}
                {(CITIES_BY_STATE[form.state] ?? []).map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="delivery-zip" className="block text-sm font-medium text-neutral-700">
                Zip Code
              </label>
              <input
                id="delivery-zip"
                name="zip"
                value={form.zip}
                onChange={handleChange}
                className="block w-full rounded-md border border-neutral-300 px-3 py-2.5"
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
          <div className="flex items-center justify-between">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-black px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {editingAddress ? "Update" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setShowAddressForm(false)}
              className="rounded-md border border-neutral-300 bg-white px-5 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-400 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {loading ? (
        <p className="py-12 text-center text-sm text-neutral-500" role="status">
          Loading delivery addresses…
        </p>
      ) : !error && addresses.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-5 py-16 text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-white text-[#E63312] shadow-sm">
            <MapPin className="h-10 w-10" strokeWidth={1.5} aria-hidden="true" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-950">
            You do not have any address
          </h3>
          <p className="mt-2 text-sm text-neutral-600">
            When you add an address, you can manage it here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {addresses.map((addr) => (
            <article
              key={addr.id}
              className="rounded-lg border border-neutral-200 bg-white p-4 sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-neutral-950">
                    {addr.label}
                  </h3>
                  {addr.isDefault && (
                    <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                      Default address
                    </span>
                  )}
                </div>
                <span aria-hidden="true" className="text-xl">⌖</span>
              </div>
              <address className="mt-4 space-y-1 text-sm not-italic leading-6 text-neutral-600">
                <p>{addr.address}</p>
                <p>
                  {addr.city}, {addr.state} {addr.zip}
                </p>
              </address>
              <div className="mt-4 flex flex-wrap gap-3 border-t border-neutral-100 pt-3">
                {!addr.isDefault && (
                  <button
                    type="button"
                    onClick={() => onSetDefault(addr.id)}
                    className="text-sm font-semibold text-neutral-700 hover:text-[#E63312]"
                  >
                    Set as default
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onEdit(addr)}
                  className="text-sm font-semibold text-neutral-700 hover:text-[#E63312]"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(addr.id)}
                  className="text-sm font-semibold text-red-700 hover:text-red-900"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function OrdersSection() {
  return <MyOrders embedded />;
}

function PendingRatingsSection({
  items,
  loading,
  error,
  onRetry,
  onReviewed,
}: {
  items: PendingRating[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onReviewed: () => Promise<void>;
}) {
  const { token } = useAuth();
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [submittingProductId, setSubmittingProductId] = useState("");
  const [submitError, setSubmitError] = useState("");

  const submitReview = async (
    event: React.FormEvent<HTMLFormElement>,
    item: PendingRating,
  ) => {
    event.preventDefault();
    const rating = ratings[item.productId] ?? 0;
    const comment = comments[item.productId]?.trim() ?? "";
    if (!token || rating < 1 || comment.length < 10) return;

    setSubmittingProductId(item.productId);
    setSubmitError("");
    try {
      await apiRequest(`/products/${encodeURIComponent(item.productId)}/reviews`, {
        method: "POST",
        token,
        body: { rating, comment },
      });
      toast.success("Your verified-purchase review has been saved.");
      await onReviewed();
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : "Could not submit your review.",
      );
    } finally {
      setSubmittingProductId("");
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">Rate &amp; Review</h2>
      {loading ? (
        <p className="py-12 text-center text-sm text-neutral-500" role="status">
          Loading products for review…
        </p>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-5" role="alert">
          <p className="text-sm text-red-800">
            Could not load products for review: {error}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-md border border-red-300 px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-100"
          >
            Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-neutral-200 bg-white px-6 py-12 text-center">
          <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-amber-50 text-amber-500">
            <Star className="h-12 w-12" strokeWidth={1.5} aria-hidden="true" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-950">
            You do not have product for review
          </h3>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-600">
            After your order is delivered, you will be able to write a review and
            rate the product. Your review and rating will be published on Product
            Page to help other shoppers make the best decision to get the best
            shopping experience.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {submitError && (
            <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
              {submitError}
            </p>
          )}
          {items.map((item) => {
            const rating = ratings[item.productId] ?? 0;
            const comment = comments[item.productId] ?? "";
            const submitting = submittingProductId === item.productId;
            return (
              <article
                key={item.productId}
                className="grid gap-5 rounded-lg border border-neutral-200 bg-white p-5 sm:grid-cols-[112px_minmax(0,1fr)]"
              >
                <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-md bg-neutral-100">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <ShoppingBagIcon className="h-9 w-9 text-neutral-400" aria-hidden="true" />
                  )}
                </div>
                <form
                  onSubmit={(event) => void submitReview(event, item)}
                  className="space-y-4"
                >
                  <div>
                    <h3 className="font-semibold text-neutral-950">{item.name}</h3>
                    <p className="mt-1 text-xs text-neutral-500">
                      Delivered order · {item.orderId.slice(-8).toUpperCase()}
                    </p>
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-neutral-700">
                      Your rating
                    </span>
                    <div
                      className="mt-1 flex gap-1"
                      role="radiogroup"
                      aria-label={`Rate ${item.name}`}
                    >
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={rating === value}
                          aria-label={`${value} star${value === 1 ? "" : "s"}`}
                          onClick={() =>
                            setRatings((current) => ({
                              ...current,
                              [item.productId]: value,
                            }))
                          }
                          className={`text-2xl transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
                            value <= rating ? "text-amber-500" : "text-neutral-300"
                          }`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor={`rating-review-${item.productId}`}
                      className="block text-sm font-medium text-neutral-700"
                    >
                      Your review
                    </label>
                    <textarea
                      id={`rating-review-${item.productId}`}
                      value={comment}
                      onChange={(event) =>
                        setComments((current) => ({
                          ...current,
                          [item.productId]: event.target.value,
                        }))
                      }
                      minLength={10}
                      maxLength={1500}
                      required
                      rows={4}
                      placeholder="Share your experience with this product…"
                      className="mt-1 block w-full rounded-md border border-neutral-300 p-3 text-sm focus:border-[#E63312] focus:outline-none focus:ring-1 focus:ring-[#E63312]"
                    />
                    <p className="mt-1 text-right text-xs text-neutral-500">
                      {comment.length}/1500 characters
                    </p>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={submitting || rating === 0 || comment.trim().length < 10}
                      className="rounded-md bg-black px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#E63312] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submitting ? "Submitting…" : "Submit Review"}
                    </button>
                  </div>
                </form>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

type WalletTransaction = {
  id: string;
  type: string;
  direction: "received" | "sent";
  amount: number;
  status: string;
  description: string;
  reference: string | null;
  createdAt: string;
};

function WalletView() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<"all" | "received" | "sent">("all");
  const [balance, setBalance] = useState<number>();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [activeForm, setActiveForm] = useState<"fund" | "payout" | null>(null);
  const [fundAmount, setFundAmount] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [password, setPassword] = useState("");
  const [processing, setProcessing] = useState(false);
  const [fundingMessage, setFundingMessage] = useState("");
  const [payoutMessage, setPayoutMessage] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const paymentReference = searchParams.get("reference");

  const tabs = [
    { id: "all" as const, label: "Transaction History", icon: FileText },
    { id: "received" as const, label: "Received", icon: ArrowDownLeft },
    { id: "sent" as const, label: "Sent", icon: ArrowUpRight },
  ];

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    Promise.all([
      apiRequest("/wallet", { token }),
      apiRequest("/wallet/transactions", { token }),
    ])
      .then(([wallet, transactionRows]) => {
        if (cancelled) return;
        if (!Array.isArray(transactionRows)) {
          throw new Error("The wallet service returned invalid transaction data.");
        }
        setBalance(wallet.accountBalance);
        setBankName(wallet.linkedBankName ?? "");
        setAccountNumber(wallet.linkedBankAccountNumber ?? "");
        setTransactions(transactionRows);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load wallet details.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, reloadKey]);

  useEffect(() => {
    if (!token || !paymentReference) return;
    let cancelled = false;

    apiRequest("/wallet/fund/verify", {
      method: "POST",
      token,
      body: { reference: paymentReference },
    })
      .then((result) => {
        if (cancelled) return;
        setBalance(result.accountBalance);
        toast.success("Wallet funding confirmed.");
        setLoading(true);
        setError("");
        setReloadKey((key) => key + 1);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFundingMessage(
            err instanceof Error ? err.message : "Could not verify wallet funding.",
          );
        }
      })
      .finally(() => {
        if (cancelled) return;
        setProcessing(false);
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete("reference");
        setSearchParams(nextParams, { replace: true });
      });

    return () => {
      cancelled = true;
    };
  }, [token, paymentReference, searchParams, setSearchParams]);

  const handleFundWallet = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    setProcessing(true);
    setFundingMessage("");
    try {
      const result = await apiRequest("/wallet/fund/initialize", {
        method: "POST",
        token,
        body: { amount: Number(fundAmount) },
      });
      window.location.assign(result.authorizationUrl);
    } catch (err: unknown) {
      setFundingMessage(
        err instanceof Error ? err.message : "Could not start wallet funding.",
      );
      setProcessing(false);
    }
  };

  const handlePayoutRequest = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!token) return;
    setProcessing(true);
    setPayoutMessage("");
    try {
      const result = await apiRequest("/wallet/payout", {
        method: "POST",
        token,
        body: {
          amount: Number(payoutAmount),
          bankName,
          accountNumber,
          password,
        },
      });
      setBalance(result.accountBalance);
      setPassword("");
      setActiveForm(null);
      setLoading(true);
      setError("");
      setReloadKey((key) => key + 1);
      toast.success("Payout request submitted for admin review.");
    } catch (err: unknown) {
      setPayoutMessage(
        err instanceof Error ? err.message : "Could not submit payout request.",
      );
    } finally {
      setProcessing(false);
    }
  };

  const visibleTransactions = transactions.filter(
    (transaction) =>
      activeTab === "all" || transaction.direction === activeTab,
  );
  const formatAmount = (amount: number) =>
    `₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">My Wallet</h2>
      <section
        aria-label="Wallet balance"
        className="relative max-w-md rounded-2xl bg-gradient-to-br from-fuchsia-800 to-pink-600 p-7 text-white shadow-sm"
      >
        <button
          type="button"
          onClick={() => setBalanceVisible((visible) => !visible)}
          aria-label={balanceVisible ? "Hide wallet balance" : "Show wallet balance"}
          aria-pressed={!balanceVisible}
          className="absolute right-5 top-5 rounded-full p-2 text-white/90 transition-colors hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {balanceVisible ? (
            <BalanceVisibleIcon className="h-5 w-5" aria-hidden="true" />
          ) : (
            <BalanceHiddenIcon className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
        <p className="text-sm font-medium text-white/90">Wallet Balance (₦)</p>
        <p className="mt-2 text-3xl font-bold">
          {loading && balance === undefined ? (
            <span className="text-lg font-medium text-white/80" role="status">
              Loading balance…
            </span>
          ) : (
            balanceVisible
              ? formatAmount(balance ?? 0)
              : "₦ ••••••"
          )}
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setActiveForm("fund")}
            className="rounded-xl border border-white/30 bg-white/15 px-5 py-3 text-sm font-semibold transition-colors hover:bg-white/25"
          >
            + Fund Wallet
          </button>
          <button
            type="button"
            onClick={() => {
              setPayoutAmount("");
              setActiveForm("payout");
            }}
            disabled={!balance || balance < 100}
            className="rounded-xl border border-white/30 bg-white/15 px-5 py-3 text-sm font-semibold transition-colors hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ↑ Payout
          </button>
        </div>
      </section>

      {(fundingMessage || payoutMessage) && !activeForm && (
        <div
          className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          role="status"
        >
          {fundingMessage || payoutMessage}
        </div>
      )}

      <div
        className="flex flex-wrap gap-2 border-b border-neutral-200"
        role="tablist"
        aria-label="Wallet transactions"
      >
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`wallet-tab-${id}`}
            aria-selected={activeTab === id}
            aria-controls="wallet-transactions-panel"
            onClick={() => setActiveTab(id)}
            className={`inline-flex min-h-12 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors ${
              activeTab === id
                ? "border-[#E63312] bg-rose-50 text-neutral-950"
                : "border-transparent text-neutral-500 hover:text-neutral-900"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <section
        id="wallet-transactions-panel"
        role="tabpanel"
        aria-labelledby={`wallet-tab-${activeTab}`}
        className="min-h-[420px] rounded-lg border border-neutral-200 bg-white px-6 py-8"
      >
        {error ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center text-center" role="alert">
            <p className="text-sm text-red-700">Could not load wallet transactions: {error}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setError("");
                setReloadKey((key) => key + 1);
              }}
              className="mt-4 rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold hover:bg-neutral-50"
            >
              Try again
            </button>
          </div>
        ) : loading ? (
          <p className="py-16 text-center text-sm text-neutral-500" role="status">
            Loading transactions…
          </p>
        ) : visibleTransactions.length > 0 ? (
          <div className="divide-y divide-neutral-100">
            {visibleTransactions.map((transaction) => (
              <article
                key={transaction.id}
                className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      transaction.direction === "received"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-neutral-100 text-neutral-700"
                    }`}
                  >
                    {transaction.direction === "received" ? (
                      <ArrowDownLeft className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-neutral-900">
                      {transaction.description}
                    </h3>
                    <p className="mt-1 text-xs text-neutral-500">
                      {new Intl.DateTimeFormat("en-NG", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(transaction.createdAt))}
                    </p>
                    {transaction.status === "pending" && (
                      <p className="mt-1 text-xs font-medium text-amber-700">
                        Pending admin approval
                      </p>
                    )}
                    {transaction.status === "rejected" && (
                      <p className="mt-1 text-xs font-medium text-red-700">
                        Rejected · funds returned to wallet
                      </p>
                    )}
                  </div>
                </div>
                <p
                  className={`text-sm font-bold ${
                    transaction.direction === "received"
                      ? "text-emerald-700"
                      : "text-neutral-900"
                  }`}
                >
                  {transaction.direction === "received" ? "+" : "−"}
                  {formatAmount(transaction.amount)}
                </p>
              </article>
            ))}
          </div>
        ) : transactions.length === 0 && activeTab === "all" ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
            <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-neutral-50 text-neutral-300">
              <FileText className="h-20 w-20" strokeWidth={1.6} aria-hidden="true" />
            </div>
            <h3 className="text-xl font-semibold text-neutral-950">
              No transactions yet
            </h3>
            <p className="mt-3 max-w-md text-base leading-7 text-neutral-500">
              When you make your first transaction, it will appear here. Start by
              adding money to your account or making a payment.
            </p>
            <p className="mt-8 text-sm text-neutral-400">
              <span aria-hidden="true">✨</span> Your transactions are secure and
              encrypted <span aria-hidden="true">✨</span>
            </p>
          </div>
        ) : (
          <p className="py-16 text-center text-sm text-neutral-500">
            No {activeTab === "received" ? "received" : "sent"} transactions yet.
          </p>
        )}
      </section>

      {activeForm && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !processing) {
              setActiveForm(null);
              setFundingMessage("");
              setPayoutMessage("");
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="wallet-action-title"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 id="wallet-action-title" className="text-lg font-bold">
                  {activeForm === "fund" ? "Fund Wallet" : "Request a Payout"}
                </h3>
                <p className="mt-1 text-sm text-neutral-500">
                  {activeForm === "fund"
                    ? "Payments are securely processed by Paystack."
                    : "Your payout amount is reserved while an admin reviews your request."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveForm(null)}
                disabled={processing}
                aria-label="Close form"
                className="rounded p-2 text-neutral-500 hover:bg-neutral-100 disabled:opacity-50"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {activeForm === "fund" ? (
              <form onSubmit={(event) => void handleFundWallet(event)} className="space-y-4">
                <label className="block text-sm font-medium text-neutral-700" htmlFor="wallet-fund-amount">
                  Amount (₦)
                </label>
                <input
                  id="wallet-fund-amount"
                  type="number"
                  min="100"
                  max="5000000"
                  step="0.01"
                  value={fundAmount}
                  onChange={(event) => setFundAmount(event.target.value)}
                  required
                  className="w-full rounded-md border border-neutral-300 px-3 py-3 text-sm focus:border-[#E63312] focus:outline-none focus:ring-1 focus:ring-[#E63312]"
                  placeholder="Enter amount (minimum ₦100)"
                />
                {fundingMessage && (
                  <p className="text-sm text-red-700" role="alert">{fundingMessage}</p>
                )}
                <button
                  type="submit"
                  disabled={processing}
                  className="w-full rounded-md bg-black px-4 py-3 text-sm font-semibold text-white hover:bg-[#E63312] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {processing ? "Preparing secure payment…" : "Continue to Paystack"}
                </button>
              </form>
            ) : (
              <form onSubmit={(event) => void handlePayoutRequest(event)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700" htmlFor="wallet-payout-amount">
                    Amount (₦)
                  </label>
                  <input
                    id="wallet-payout-amount"
                    type="number"
                    min="100"
                    max={balance ?? 0}
                    step="0.01"
                    value={payoutAmount}
                    onChange={(event) => setPayoutAmount(event.target.value)}
                    required
                    className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-3 text-sm focus:border-[#E63312] focus:outline-none focus:ring-1 focus:ring-[#E63312]"
                    placeholder={`Available: ${formatAmount(balance ?? 0)}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700" htmlFor="wallet-payout-bank">
                    Bank name
                  </label>
                  <input
                    id="wallet-payout-bank"
                    value={bankName}
                    onChange={(event) => setBankName(event.target.value)}
                    required
                    className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-3 text-sm focus:border-[#E63312] focus:outline-none focus:ring-1 focus:ring-[#E63312]"
                    placeholder="Enter bank name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700" htmlFor="wallet-payout-account">
                    10-digit account number
                  </label>
                  <input
                    id="wallet-payout-account"
                    value={accountNumber}
                    onChange={(event) => setAccountNumber(event.target.value)}
                    required
                    inputMode="numeric"
                    maxLength={10}
                    pattern="[0-9]{10}"
                    className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-3 text-sm focus:border-[#E63312] focus:outline-none focus:ring-1 focus:ring-[#E63312]"
                    placeholder="Account number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700" htmlFor="wallet-payout-password">
                    Confirm with your password
                  </label>
                  <input
                    id="wallet-payout-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-3 text-sm focus:border-[#E63312] focus:outline-none focus:ring-1 focus:ring-[#E63312]"
                    placeholder="Account password"
                  />
                </div>
                {payoutMessage && (
                  <p className="text-sm text-red-700" role="alert">{payoutMessage}</p>
                )}
                <button
                  type="submit"
                  disabled={processing}
                  className="w-full rounded-md bg-black px-4 py-3 text-sm font-semibold text-white hover:bg-[#E63312] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {processing ? "Submitting request…" : "Submit Payout Request"}
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

type VoucherStatus = "active" | "used" | "expired";

type Voucher = {
  code: string;
  title: string;
  description: string;
  validity: string;
  status: VoucherStatus;
};

const SAMPLE_VOUCHERS: Voucher[] = [
  {
    code: "WELCOME10",
    title: "10% off your order",
    description: "Save up to ₦2,000 on orders of ₦10,000 or more.",
    validity: "Expires 31 Dec 2026",
    status: "active",
  },
  {
    code: "FREESHIP",
    title: "Free standard delivery",
    description: "Enjoy free standard delivery on orders of ₦15,000 or more.",
    validity: "Expires 30 Nov 2026",
    status: "active",
  },
  {
    code: "SAVE1500",
    title: "₦1,500 off your order",
    description: "A sample voucher that has already been used.",
    validity: "Used 14 Sep 2026",
    status: "used",
  },
  {
    code: "OLD500",
    title: "₦500 off your order",
    description: "A sample voucher that is no longer valid.",
    validity: "Expired 30 Sep 2026",
    status: "expired",
  },
];

function VoucherView() {
  const [activeFilter, setActiveFilter] = useState<VoucherStatus>("active");
  const vouchers = SAMPLE_VOUCHERS.filter(
    (voucher) => voucher.status === activeFilter,
  );
  const filters: { id: VoucherStatus; label: string }[] = [
    { id: "active", label: "Active" },
    { id: "used", label: "Used" },
    { id: "expired", label: "Expired" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-neutral-950">My Vouchers</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Keep track of discounts and delivery offers available to you.
        </p>
      </div>

      <div
        className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
        role="note"
      >
        <p className="font-semibold">Preview with sample vouchers</p>
        <p className="mt-1 text-amber-900">
          These examples are for display only. Voucher issuing and checkout
          redemption are not connected yet.
        </p>
      </div>

      <div className="flex gap-2 border-b border-neutral-200" aria-label="Voucher status">
        {filters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            aria-pressed={activeFilter === filter.id}
            onClick={() => setActiveFilter(filter.id)}
            className={`border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E63312] ${
              activeFilter === filter.id
                ? "border-black text-neutral-950"
                : "border-transparent text-neutral-500 hover:text-neutral-900"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {vouchers.length ? (
        <ul className="grid gap-4 lg:grid-cols-2">
          {vouchers.map((voucher) => (
            <li
              key={voucher.code}
              className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-bold text-neutral-950">{voucher.title}</p>
                  <p className="mt-1 text-sm leading-5 text-neutral-600">
                    {voucher.description}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold capitalize ${
                    voucher.status === "active"
                      ? "bg-green-100 text-green-800"
                      : "bg-neutral-100 text-neutral-600"
                  }`}
                >
                  {voucher.status}
                </span>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-neutral-200 pt-4">
                <span className="rounded border border-dashed border-neutral-300 bg-neutral-50 px-3 py-1.5 font-mono text-sm font-bold tracking-wider text-neutral-800">
                  {voucher.code}
                </span>
                <span className="text-xs text-neutral-500">
                  {voucher.validity}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-neutral-600">
          No {activeFilter} vouchers in this preview.
        </p>
      )}
    </div>
  );
}

function TrustedVendorView({
  status,
  token,
  onSubmitted,
}: {
  status: User | null;
  token: string | null;
  onSubmitted: () => Promise<void>;
}) {
  const [businessName, setBusinessName] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const requestStatus = status?.trustedVendorRequestStatus ?? "none";
  const allCategories = Object.keys(CATEGORIES);

  const toggleCategory = (category: string) => {
    setCategories((selected) =>
      selected.includes(category)
        ? selected.filter((item) => item !== category)
        : [...selected, category],
    );
  };

  const submitApplication = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || submitting) return;
    setSubmitting(true);
    try {
      await apiRequest("/users/trusted-vendor-request", {
        method: "POST",
        token,
        body: { businessName, categories, location, description, website },
      });
      await onSubmitted();
      toast.success("Trusted-vendor application submitted for review.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not submit your trusted-vendor application.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submittedDate = status?.trustedVendorRequestedAt
    ? new Date(status.trustedVendorRequestedAt).toLocaleDateString("en-NG", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h2 className="text-lg font-bold text-neutral-950">Trusted Vendor</h2>
        <p className="mt-1 text-sm leading-6 text-neutral-600">
          Apply to have your seller account reviewed for trusted-vendor status.
          Our team will review your business details before making a decision.
        </p>
      </header>

      <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
        <h3 className="font-semibold text-neutral-950">What to expect</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-5 text-neutral-700">
          <li>Submit accurate business and product-category information.</li>
          <li>An administrator will review your application.</li>
          <li>
            Trusted status does not replace marketplace policies or product
            listing requirements.
          </li>
        </ul>
      </section>

      {!status ? (
        <p className="py-8 text-center text-sm text-neutral-500" role="status">
          Loading your application status…
        </p>
      ) : status.isTrustedVendor || requestStatus === "approved" ? (
        <section className="rounded-xl border border-green-200 bg-green-50 p-5">
          <p className="font-semibold text-green-900">
            Your account has trusted-vendor status.
          </p>
          <p className="mt-1 text-sm text-green-800">
            Continue to follow marketplace policies and keep your product and
            business information up to date.
          </p>
          <VendorApplicationDetails status={status} />
        </section>
      ) : requestStatus === "pending" ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="font-semibold text-amber-950">
            Your application is under review.
          </p>
          <p className="mt-1 text-sm text-amber-900">
            Submitted{submittedDate ? ` on ${submittedDate}` : ""}. You can
            check this page for an update.
          </p>
          <VendorApplicationDetails status={status} />
        </section>
      ) : (
        <>
          {requestStatus === "rejected" && (
            <section className="rounded-xl border border-red-200 bg-red-50 p-5">
              <p className="font-semibold text-red-900">
                Your previous application was not approved.
              </p>
              <p className="mt-1 text-sm text-red-800">
                You may update your details and submit a new application.
                {status.trustedVendorRejectionReason
                  ? ` Review note: ${status.trustedVendorRejectionReason}`
                  : ""}
              </p>
            </section>
          )}

          <form
            onSubmit={submitApplication}
            className="space-y-5 rounded-xl border border-neutral-200 bg-white p-5"
          >
            <div>
              <h3 className="font-semibold text-neutral-950">
                Business application
              </h3>
              <p className="mt-1 text-sm text-neutral-600">
                Share the details an administrator needs to review your seller
                application. Do not submit identity documents here.
              </p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="vendor-business-name"
                className="block text-sm font-medium text-neutral-700"
              >
                Business or shop name
              </label>
              <input
                id="vendor-business-name"
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                maxLength={100}
                required
                minLength={2}
                autoComplete="organization"
                className="block w-full rounded-md border border-neutral-300 px-3 py-2.5"
              />
            </div>

            <fieldset>
              <legend className="text-sm font-medium text-neutral-700">
                Product categories
              </legend>
              <p className="mt-1 text-xs text-neutral-500">
                Select at least one category you intend to sell in.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {allCategories.map((category) => (
                  <label
                    key={category}
                    className="flex items-start gap-2 rounded-md border border-neutral-200 p-3 text-sm text-neutral-700"
                  >
                    <input
                      type="checkbox"
                      checked={categories.includes(category)}
                      onChange={() => toggleCategory(category)}
                      className="mt-0.5 accent-black"
                    />
                    <span>{category}</span>
                  </label>
                ))}
              </div>
              {categories.length === 0 && (
                <p className="mt-2 text-xs text-neutral-500">
                  Choose at least one category before submitting.
                </p>
              )}
            </fieldset>

            <div className="space-y-1.5">
              <label
                htmlFor="vendor-location"
                className="block text-sm font-medium text-neutral-700"
              >
                Business location
              </label>
              <input
                id="vendor-location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                maxLength={160}
                minLength={2}
                required
                placeholder="City, State"
                autoComplete="street-address"
                className="block w-full rounded-md border border-neutral-300 px-3 py-2.5"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="vendor-description"
                className="block text-sm font-medium text-neutral-700"
              >
                About your business
              </label>
              <textarea
                id="vendor-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={1000}
                minLength={20}
                required
                rows={5}
                placeholder="Tell us what you sell and about your experience serving customers."
                className="block w-full rounded-md border border-neutral-300 px-3 py-2.5"
              />
              <p className="text-right text-xs text-neutral-500">
                {description.length}/1,000 characters
              </p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="vendor-website"
                className="block text-sm font-medium text-neutral-700"
              >
                Website or social media page{" "}
                <span className="font-normal text-neutral-500">(optional)</span>
              </label>
              <input
                id="vendor-website"
                type="url"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                maxLength={200}
                placeholder="https://example.com"
                autoComplete="url"
                className="block w-full rounded-md border border-neutral-300 px-3 py-2.5"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || categories.length === 0}
              className="rounded-md bg-black px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#E63312] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Submitting application…" : "Submit application"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

function VendorApplicationDetails({ status }: { status: User }) {
  if (!status.trustedVendorBusinessName) return null;

  return (
    <dl className="mt-5 grid gap-3 border-t border-current/10 pt-4 text-sm sm:grid-cols-2">
      <div>
        <dt className="font-medium">Business</dt>
        <dd className="mt-0.5">{status.trustedVendorBusinessName}</dd>
      </div>
      <div>
        <dt className="font-medium">Location</dt>
        <dd className="mt-0.5">{status.trustedVendorLocation || "Not provided"}</dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="font-medium">Product categories</dt>
        <dd className="mt-0.5">
          {status.trustedVendorCategories?.join(", ") || "Not provided"}
        </dd>
      </div>
      {status.trustedVendorDescription && (
        <div className="sm:col-span-2">
          <dt className="font-medium">About the business</dt>
          <dd className="mt-0.5 whitespace-pre-wrap">
            {status.trustedVendorDescription}
          </dd>
        </div>
      )}
      {status.trustedVendorWebsite && (
        <div className="sm:col-span-2">
          <dt className="font-medium">Website or social page</dt>
          <dd className="mt-0.5 break-all">{status.trustedVendorWebsite}</dd>
        </div>
      )}
    </dl>
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
