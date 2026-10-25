import React, { useState, useEffect, useCallback } from "react";

import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { useAuth } from "../context/useAuth";
import { PageShell } from "../components/wireframe-primitives";
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
} from "lucide-react";
import TrustedVendorRequest from "../components/TrustedVendorRequest";
import MyOrders from "./MyOrders";

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
    loadPendingRatingsCount();
    loadTrustedVendorStatus();
  }, [token, navigate, loadUser, loadAddresses, loadPendingRatingsCount, loadTrustedVendorStatus]);

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
                      {item.id === "pending-ratings" && pendingRatingsCount > 0 && (
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
                  {item.id === "pending-ratings" && pendingRatingsCount > 0 && (
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
              <PendingRatingsSection count={pendingRatingsCount} />
            )}
            {tab === "wallet" && <WalletView />}
            {tab === "voucher" && <VoucherView />}
            {tab === "trusted-vendor" && (
              <TrustedVendorView status={trustedVendorStatus} />
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

function PendingRatingsSection({ count }: { count: number }) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold flex items-center gap-2">
        Pending Ratings
        <span className="px-2 py-0.5 rounded bg-gray-200 text-gray-600 text-xs font-bold">
          {count}
        </span>
      </h2>
      <div className="bg-white p-4 border border-gray-300 rounded">
        <p className="text-gray-500">
          {count === 0
            ? "You do not have product for review."
            : "Your products awaiting review will appear here."}
        </p>
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

function TrustedVendorView({
  status,
}: {
  status: {
    isTrustedVendor: boolean;
    trustedVendorRequestStatus: string | null;
  } | null;
}) {
  return (
    <div className="space-y-6">
      {status?.isTrustedVendor ? (
        <>
          <h2 className="text-lg font-bold">Trusted Vendor</h2>
          <div className="bg-green-50 border border-green-200 p-4 rounded">
            <p className="text-green-800 text-sm font-medium">
              You are already a trusted vendor.
            </p>
          </div>
        </>
      ) : status?.trustedVendorRequestStatus === "pending" ? (
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
