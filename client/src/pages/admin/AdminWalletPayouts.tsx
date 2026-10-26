import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/useAuth";
import { apiRequest } from "../../lib/api";

type PayoutRequest = {
  id: string;
  amount: number;
  description: string;
  createdAt: string;
  metadata: { bankName?: string; accountNumber?: string } | null;
  user: { id: string; name: string; email: string };
};

export default function AdminWalletPayouts() {
  const { token } = useAuth();
  const [requests, setRequests] = useState<PayoutRequest[] | null>(null);
  const [actingId, setActingId] = useState("");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    apiRequest("/wallet/admin/payout-requests", { token })
      .then((data) => {
        if (cancelled) return;
        if (!Array.isArray(data)) {
          throw new Error("The payout service returned invalid data.");
        }
        setRequests(data);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        toast.error(
          error instanceof Error ? error.message : "Could not load payout requests",
        );
        setRequests([]);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const reviewRequest = async (
    request: PayoutRequest,
    action: "paid" | "reject",
  ) => {
    const confirmed =
      action === "paid"
        ? window.confirm(
            "Confirm the bank transfer has been completed before marking this payout as paid.",
          )
        : window.confirm(
            "Reject this payout request and return the reserved funds to the customer's wallet?",
          );
    if (!confirmed || !token) return;

    setActingId(request.id);
    try {
      await apiRequest(`/wallet/admin/payout-requests/${request.id}`, {
        method: "PATCH",
        token,
        body: { action },
      });
      toast.success(
        action === "paid"
          ? "Payout marked as paid"
          : "Payout rejected; funds returned to wallet",
      );
      setRequests((current) =>
        current?.filter((item) => item.id !== request.id) ?? current,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not process payout request",
      );
    } finally {
      setActingId("");
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900">Wallet Payouts</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Review payout requests. Complete the bank transfer before marking a
          request as paid; rejected requests return the reserved amount to the
          customer wallet.
        </p>
      </div>

      {requests === null ? (
        <p className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500" role="status">
          Loading payout requests…
        </p>
      ) : requests.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500">
          No pending payout requests.
        </p>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <article
              key={request.id}
              className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col justify-between gap-4 sm:flex-row">
                <div>
                  <p className="text-lg font-bold text-zinc-900">
                    ₦{request.amount.toLocaleString("en-NG")}
                  </p>
                  <p className="mt-1 text-sm font-medium text-zinc-700">
                    {request.user.name}
                  </p>
                  <p className="text-sm text-zinc-500">{request.user.email}</p>
                  <p className="mt-3 text-sm text-zinc-700">
                    {request.metadata?.bankName || "Bank not provided"} · Account{" "}
                    {request.metadata?.accountNumber || "not provided"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    Requested{" "}
                    {new Intl.DateTimeFormat("en-NG", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(request.createdAt))}
                  </p>
                </div>
                <div className="flex items-center gap-2 sm:self-center">
                  <button
                    type="button"
                    onClick={() => void reviewRequest(request, "reject")}
                    disabled={actingId === request.id}
                    className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Reject &amp; Refund
                  </button>
                  <button
                    type="button"
                    onClick={() => void reviewRequest(request, "paid")}
                    disabled={actingId === request.id}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {actingId === request.id ? "Processing…" : "Mark Paid"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
