
import { useState, type SubmitEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageShell } from "../components/wireframe-primitives";
import { useAuth } from "../context/useAuth";

export default function TrackOrderLookup() {
  const [orderId, setOrderId] = useState("");
  const { token } = useAuth();
  const navigate = useNavigate();

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanedId = orderId.trim();
    if (!cleanedId) return;

    if (!token) {
      return;
    }

    navigate(`/track/${encodeURIComponent(cleanedId)}`);
  }

  return (
    <PageShell title="Track Your Order" breadcrumb="HELP / TRACK ORDER">
      <div className="mx-auto max-w-xl border-2 border-black p-6 md:p-8">
        <h2 className="text-lg font-black uppercase">Find your order</h2>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          Enter the order ID shown on your order confirmation. For privacy,
          tracking is available to the account that placed the order.
        </p>

        {!token && (
          <p className="mt-5 border-l-4 border-black bg-neutral-50 p-3 text-sm">
            Please{" "}
            <Link to="/login" className="font-bold underline">
              sign in
            </Link>{" "}
            to track an order.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label
            htmlFor="order-id"
            className="block text-xs font-bold uppercase tracking-widest"
          >
            Order ID
          </label>
          <input
            id="order-id"
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
            placeholder="Paste your order ID"
            required
            className="w-full border-2 border-black px-4 py-3 text-sm outline-none focus:bg-neutral-50"
          />
          <button
            type="submit"
            disabled={!token || !orderId.trim()}
            className="w-full bg-black px-5 py-4 text-xs font-bold uppercase tracking-widest text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Track Order
          </button>
        </form>
      </div>
    </PageShell>
  );
}

