import React, { useState, useEffect, useCallback } from "react";

import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
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
  Eye,
  EyeOff,
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
