import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { RotateCcwIcon, CheckCircle2Icon, XCircleIcon, TruckIcon, BanknoteIcon } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { apiRequest } from "../../lib/api";

type ReturnItem = {
  id: string;
  orderId: string;
  userId: string;
  reason: string;
  comments?: string;
  refundAmount: number;
  refundMethod: string;
  status: "pending" | "approved" | "rejected" | "item_picked_up" | "refunded";
  adminNote?: string;
  createdAt: string;
  user?: {
    name: string;
    email: string;
    phone?: string;
    accountBalance?: number;
  };
  order?: {
    id: string;
    total: number;
    paymentMethod: string;
  };
};

const STATUS_FILTERS = [
  "all",
  "pending",
  "approved",
  "item_picked_up",
  "refunded",
  "rejected",
] as const;

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-300",
  approved: "bg-blue-100 text-blue-800 border-blue-300",
  item_picked_up: "bg-purple-100 text-purple-800 border-purple-300",
  refunded: "bg-emerald-100 text-emerald-800 border-emerald-300",
  rejected: "bg-red-100 text-red-800 border-red-300",
};

export default function AdminReturns() {
  const { token } = useAuth();
  const [returns, setReturns] = useState<ReturnItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const query = filter !== "all" ? `?status=${filter}` : "";

    apiRequest(`/returns/admin${query}`, { token })
      .then((data: ReturnItem[]) => {
        if (!cancelled) setReturns(data);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Failed to load returns");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, filter, reloadKey]);

  const handleUpdateStatus = async (
    id: string,
    status: ReturnItem["status"],
    adminNote?: string
  ) => {
    if (!token) return;
    try {
      setActionLoadingId(id);
      await apiRequest(`/returns/admin/${id}/status`, {
        method: "PATCH",
        token,
        body: { status, adminNote },
      });
      toast.success(`Return request marked as ${status.replace("_", " ")}`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update return status"
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <RotateCcwIcon className="size-6 text-indigo-600" />
            Customer Returns & Refunds
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Review customer return requests, arrange item pickups, and process refunds.
          </p>
        </div>
        <span className="self-start sm:self-auto px-3 py-1 bg-zinc-100 text-zinc-700 rounded-full text-xs font-semibold">
          {returns.length} {returns.length === 1 ? "Request" : "Requests"}
        </span>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors ${
              filter === s
                ? "bg-indigo-600 text-white"
                : "bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            {s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {/* Returns Table */}
      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-sm text-zinc-500">
            Loading return requests...
          </div>
        ) : returns.length === 0 ? (
          <div className="p-12 text-center text-sm text-zinc-500">
            No return requests found for this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/60 text-zinc-500 text-xs uppercase font-bold tracking-wider">
                  <th className="py-3 px-4">Request / Date</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Order / Refund</th>
                  <th className="py-3 px-4">Reason & Details</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {returns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="py-4 px-4 align-top">
                      <div className="font-mono text-xs font-bold text-zinc-800">
                        {ret.id.slice(0, 10)}...
                      </div>
                      <div className="text-xs text-zinc-400 mt-1">
                        {new Date(ret.createdAt).toLocaleDateString("en-NG", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                    </td>

                    <td className="py-4 px-4 align-top">
                      <div className="font-semibold text-zinc-900">
                        {ret.user?.name || "Customer"}
                      </div>
                      <div className="text-xs text-zinc-500">{ret.user?.email}</div>
                      {ret.user?.phone && (
                        <div className="text-xs text-zinc-400 mt-0.5">
                          {ret.user.phone}
                        </div>
                      )}
                    </td>

                    <td className="py-4 px-4 align-top">
                      <div className="font-mono text-xs text-zinc-600">
                        Order: {ret.orderId.slice(0, 10)}...
                      </div>
                      <div className="font-bold text-zinc-900 mt-1">
                        ₦{ret.refundAmount.toLocaleString()}
                      </div>
                      <div className="text-xs text-zinc-500 capitalize">
                        Via: {ret.refundMethod}
                      </div>
                    </td>

                    <td className="py-4 px-4 align-top max-w-xs">
                      <div className="font-semibold text-zinc-800">
                        {ret.reason}
                      </div>
                      {ret.comments && (
                        <p className="text-xs text-zinc-500 mt-1 italic">
                          &ldquo;{ret.comments}&rdquo;
                        </p>
                      )}
                      {ret.adminNote && (
                        <div className="mt-2 text-xs bg-zinc-100 p-1.5 rounded text-zinc-700">
                          <span className="font-bold">Admin note:</span> {ret.adminNote}
                        </div>
                      )}
                    </td>

                    <td className="py-4 px-4 align-top">
                      <span
                        className={`inline-block px-2.5 py-1 text-xs font-bold uppercase rounded-full border ${
                          STATUS_STYLES[ret.status] || "bg-zinc-100 text-zinc-700"
                        }`}
                      >
                        {ret.status.replace(/_/g, " ")}
                      </span>
                    </td>

                    <td className="py-4 px-4 align-top text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {ret.status === "pending" && (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(ret.id, "approved")}
                              disabled={actionLoadingId === ret.id}
                              className="px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                              title="Approve return"
                            >
                              <CheckCircle2Icon className="size-3.5" /> Approve
                            </button>
                            <button
                              onClick={() => {
                                const note = window.prompt("Enter rejection reason:");
                                if (note !== null) {
                                  handleUpdateStatus(ret.id, "rejected", note);
                                }
                              }}
                              disabled={actionLoadingId === ret.id}
                              className="px-2.5 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                              title="Reject return"
                            >
                              <XCircleIcon className="size-3.5" /> Reject
                            </button>
                          </>
                        )}

                        {ret.status === "approved" && (
                          <button
                            onClick={() => handleUpdateStatus(ret.id, "item_picked_up")}
                            disabled={actionLoadingId === ret.id}
                            className="px-2.5 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                            title="Mark item picked up"
                          >
                            <TruckIcon className="size-3.5" /> Picked Up
                          </button>
                        )}

                        {(ret.status === "approved" || ret.status === "item_picked_up") && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Confirm refund of ₦${ret.refundAmount.toLocaleString()} to customer wallet?`)) {
                                handleUpdateStatus(ret.id, "refunded");
                              }
                            }}
                            disabled={actionLoadingId === ret.id}
                            className="px-2.5 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                            title="Process refund"
                          >
                            <BanknoteIcon className="size-3.5" /> Refund
                          </button>
                        )}

                        {(ret.status === "refunded" || ret.status === "rejected") && (
                          <span className="text-xs text-zinc-400 font-medium">Completed</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
