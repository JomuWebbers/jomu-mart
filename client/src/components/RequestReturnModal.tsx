import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { apiRequest } from "../lib/api";
import { fmt } from "./wireframe-helpers";

type OrderItem = {
  name?: string;
  qty?: number;
};

type Order = {
  id: string;
  total: number;
  items: OrderItem[];
};

interface RequestReturnModalProps {
  order: Order;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}

const RETURN_REASONS = [
  "Damaged or defective item",
  "Item does not match description",
  "Wrong item or size delivered",
  "Missing parts or accessories",
  "Quality not as expected",
];

export default function RequestReturnModal({
  order,
  token,
  onClose,
  onSuccess,
}: RequestReturnModalProps) {
  const [reason, setReason] = useState(RETURN_REASONS[0]);
  const [comments, setComments] = useState("");
  const [refundMethod, setRefundMethod] = useState("wallet");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!reason.trim()) {
      toast.error("Please select a return reason");
      return;
    }

    try {
      setSubmitting(true);
      await apiRequest(`/returns/order/${order.id}`, {
        method: "POST",
        token,
        body: {
          reason,
          comments,
          refundMethod,
        },
      });

      toast.success("Return request submitted successfully");
      onSuccess();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to submit return request"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-50"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white border-2 border-black max-w-lg w-full p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex justify-between items-start border-b-2 border-black pb-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">
                Return & Refund
              </p>
              <h2 className="text-lg font-black uppercase mt-1">Request Return</h2>
            </div>
            <button
              onClick={onClose}
              disabled={submitting}
              className="text-lg font-black px-2 hover:bg-neutral-100"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Order Summary */}
            <div className="bg-neutral-50 border border-neutral-300 p-3 text-xs space-y-1">
              <p className="font-bold">
                Order ID: <span className="font-mono">{order.id}</span>
              </p>
              <p className="text-neutral-600">
                Items:{" "}
                {order.items
                  .map((it) => `${it.name || "Item"} × ${it.qty || 1}`)
                  .join(", ")}
              </p>
              <p className="font-black text-sm pt-1">
                Refund Value: {fmt(order.total)}
              </p>
            </div>

            {/* Reason Dropdown */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1">
                Reason for Return
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={submitting}
                className="w-full border-2 border-black p-2 text-sm bg-white font-medium outline-none"
              >
                {RETURN_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Explanation / Comments */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1">
                Additional Details (Optional)
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Explain the issue with the item..."
                disabled={submitting}
                rows={3}
                className="w-full border-2 border-black p-2 text-sm outline-none resize-none"
              />
            </div>

            {/* Refund Method Selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1">
                Preferred Refund Method
              </label>
              <div className="grid grid-cols-2 gap-3 text-xs font-bold">
                <label className="flex items-center gap-2 border-2 border-black p-2 cursor-pointer">
                  <input
                    type="radio"
                    name="refundMethod"
                    value="wallet"
                    checked={refundMethod === "wallet"}
                    onChange={(e) => setRefundMethod(e.target.value)}
                    disabled={submitting}
                  />
                  <span>Store Wallet (Instant)</span>
                </label>
                <label className="flex items-center gap-2 border-2 border-black p-2 cursor-pointer">
                  <input
                    type="radio"
                    name="refundMethod"
                    value="bank"
                    checked={refundMethod === "bank"}
                    onChange={(e) => setRefundMethod(e.target.value)}
                    disabled={submitting}
                  />
                  <span>Bank Account</span>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-3 border-t-2 border-black">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 border-2 border-black py-2.5 text-xs font-bold uppercase hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-black text-white py-2.5 text-xs font-bold uppercase tracking-widest disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Confirm Return"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
