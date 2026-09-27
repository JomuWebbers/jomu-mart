import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { TruckIcon, PackageCheckIcon, XIcon } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { apiRequest } from "../../lib/api";

type OrderItem = {
  productId: string;
  name: string;
  price: number;
  qty: number;
  sellerId?: string;
  payoutStatus?: string;
};

type Order = {
  id: string;
  total: number;
  status: string;
  deliveryPartnerId: string | null;
  deliveryPartner: { name: string; phone: string } | null;
  createdAt: string;
  items: OrderItem[];
};

type Partner = {
  id: string;
  name: string;
  phone: string;
  vehicleType: string | null;
};

const STATUS_OPTIONS = [
  "Placed",
  "Confirmed",
  "Assigned",
  "Out for Delivery",
  "Delivered",
  "Cancelled",
];

const STATUS_STYLES: Record<string, string> = {
  Placed: "bg-blue-100 text-blue-800",
  Confirmed: "bg-amber-100 text-amber-800",
  Assigned: "bg-indigo-100 text-indigo-800",
  "Out for Delivery": "bg-purple-100 text-purple-800",
  Delivered: "bg-green-100 text-green-800",
  Cancelled: "bg-red-100 text-red-800",
};

export default function AdminOrders() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignModalOrderId, setAssignModalOrderId] = useState<string | null>(
    null,
  );
  const [selectedPartner, setSelectedPartner] = useState("");
  const [payoutKey, setPayoutKey] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiRequest("/orders", { token: token ?? undefined }).then(setOrders),
      apiRequest("/delivery-partners", { token: token ?? undefined }).then(
        setPartners,
      ),
    ])
      .catch(() => toast.error("Failed to load dashboard data"))
      .finally(() => setLoading(false));
  }, [token]);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      const updated = await apiRequest(`/orders/${orderId}/status`, {
        method: "PATCH",
        token: token ?? undefined,
        body: { status: newStatus },
      });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      toast.success(`Order marked as ${newStatus}`);
    } catch {
      toast.error("Failed to update order status");
    }
  };

  const handleAssign = async () => {
    if (!assignModalOrderId || !selectedPartner) return;
    try {
      const updated = await apiRequest(`/orders/${assignModalOrderId}/assign`, {
        method: "PATCH",
        token: token ?? undefined,
        body: { deliveryPartnerId: selectedPartner },
      });
      setOrders((prev) =>
        prev.map((o) => (o.id === assignModalOrderId ? updated : o)),
      );
      toast.success("Delivery partner assigned");
      setAssignModalOrderId(null);
      setSelectedPartner("");
    } catch {
      toast.error("Failed to assign delivery partner");
    }
  };

  const handlePayout = async (orderId: string, item: OrderItem) => {
    const key = `${orderId}:${item.productId}`;
    setPayoutKey(key);

    try {
      const result = await apiRequest(
        `/orders/${orderId}/items/${item.productId}/payout`,
        {
          method: "PATCH",
          token: token ?? undefined,
        },
      );

      setOrders((current) =>
        current.map((order) =>
          order.id !== orderId
            ? order
            : {
                ...order,
                items: order.items.map((orderItem) =>
                  orderItem.productId === item.productId
                    ? { ...orderItem, payoutStatus: "paid" }
                    : orderItem,
                ),
              },
        ),
      );

      toast.success(
        `₦${Number(result.payoutAmount).toLocaleString()} credited to seller balance`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Seller payout failed",
      );
    } finally {
      setPayoutKey(null);
    }
  };

  if (loading) {
    return <div className="p-10 text-center font-bold">Loading orders…</div>;
  }

  return (
    <div className="p-4 md:p-8 bg-neutral-50 min-h-screen">
      <h1 className="text-xl font-semibold text-zinc-900 mb-6">Orders</h1>

      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-zinc-50 text-zinc-500 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">Order</th>
                <th className="px-6 py-4">Total</th>
                <th className="px-6 py-4">Items / Seller Payout</th>
                <th className="px-6 py-4">Delivery Partner</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {orders.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-zinc-500"
                  >
                    No orders yet.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-zinc-50/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <p className="font-semibold text-zinc-900">
                        #{order.id.slice(-8).toUpperCase()}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {new Date(order.createdAt).toLocaleString()}
                      </p>
                    </td>
                    <td className="px-6 py-4 font-medium">
                      ₦{order.total.toLocaleString()}
                    </td>

                    <td className="px-6 py-4">
                      <div className="space-y-3">
                        {(order.items ?? []).map((item) => {
                          const key = `${order.id}:${item.productId}`;

                          return (
                            <div key={item.productId} className="min-w-48">
                              <p className="text-xs font-medium text-zinc-900">
                                {item.name} × {item.qty}
                              </p>
                              <p className="text-[10px] text-zinc-500">
                                ₦{(item.price * item.qty).toLocaleString()}
                              </p>

                              {!item.sellerId ? (
                                <span className="text-[10px] text-zinc-400">
                                  No seller recorded
                                </span>
                              ) : item.payoutStatus === "paid" ? (
                                <span className="text-[10px] font-semibold text-green-700">
                                  Seller credited
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handlePayout(order.id, item)}
                                  disabled={payoutKey === key}
                                  className="mt-1 rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:opacity-50"
                                >
                                  {payoutKey === key
                                    ? "Crediting…"
                                    : "Credit seller balance"}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {order.deliveryPartner ? (
                        <div className="flex items-center gap-2">
                          <div className="size-8 rounded-full bg-indigo-500 flex items-center justify-center">
                            <span className="text-white text-xs font-semibold">
                              {order.deliveryPartner.name.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-zinc-900">
                              {order.deliveryPartner.name}
                            </p>
                            <p className="text-[10px] text-zinc-500">
                              {order.deliveryPartner.phone}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setAssignModalOrderId(order.id);
                            setSelectedPartner("");
                          }}
                          className="px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1.5"
                        >
                          <TruckIcon className="size-3.5" /> Assign
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={order.status}
                        onChange={(e) =>
                          handleStatusChange(order.id, e.target.value)
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold outline-none cursor-pointer ${STATUS_STYLES[order.status] || "bg-zinc-100 text-zinc-800"}`}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Modal */}
      {assignModalOrderId && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={() => setAssignModalOrderId(null)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-zinc-900">
                  Assign Delivery Partner
                </h3>
                <button
                  onClick={() => setAssignModalOrderId(null)}
                  className="p-1 hover:bg-zinc-100 rounded-lg"
                >
                  <XIcon className="size-5" />
                </button>
              </div>
              {partners.length === 0 ? (
                <p className="text-sm text-zinc-500 mb-4">
                  No delivery partners yet. Add one first.
                </p>
              ) : (
                <div className="space-y-2 mb-5 max-h-60 overflow-y-auto">
                  {partners.map((p) => (
                    <label
                      key={p.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        selectedPartner === p.id
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-zinc-200 hover:bg-zinc-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="partner"
                        checked={selectedPartner === p.id}
                        onChange={() => setSelectedPartner(p.id)}
                      />
                      <div className="size-8 rounded-full bg-indigo-500 flex items-center justify-center">
                        <span className="text-white text-xs font-semibold">
                          {p.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-900">
                          {p.name}
                        </p>
                        <p className="text-xs text-zinc-500 capitalize">
                          {p.vehicleType} · {p.phone}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setAssignModalOrderId(null)}
                  className="flex-1 py-2.5 text-sm font-medium text-zinc-600 bg-zinc-100 rounded-xl hover:bg-zinc-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssign}
                  disabled={!selectedPartner}
                  className="flex-1 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <PackageCheckIcon className="size-4" /> Assign
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
