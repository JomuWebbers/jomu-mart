
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { apiRequest } from "../lib/api";

type State = "verifying" | "success" | "error";

export default function ListingFeeReturn() {
  const [searchParams] = useSearchParams();
  const { token } = useAuth();
  const [state, setState] = useState<State>("verifying");
  const [message, setMessage] = useState("Confirming your payment…");

  useEffect(() => {
    let ignore = false;
    const reference = searchParams.get("reference");

    async function verify() {
      if (!token || !reference) {
        setState("error");
        setMessage("We could not find your payment reference. Please contact support.");
        return;
      }

      try {
        await apiRequest("/products/listing-fee/verify", {
          method: "POST",
          token,
          body: { reference },
        });

        if (!ignore) {
          setState("success");
          setMessage(
            "Your monthly listing fee is confirmed. Your listing is now waiting for admin review.",
          );
        }
      } catch (error) {
        if (!ignore) {
          setState("error");
          setMessage(
            error instanceof Error
              ? error.message
              : "Payment could not be confirmed. Please contact support.",
          );
        }
      }
    }

    verify();

    return () => {
      ignore = true;
    };
  }, [searchParams, token]);

  return (
    <div className="min-h-[60vh] px-4 py-16">
      <div className="mx-auto max-w-xl border-2 border-black p-8 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">
          Monthly listing fee
        </p>
        <h1 className="mt-3 text-2xl font-black">
          {state === "verifying"
            ? "Verifying payment"
            : state === "success"
              ? "Payment confirmed"
              : "Payment not confirmed"}
        </h1>
        <p className="mt-4 text-sm leading-6 text-neutral-600">{message}</p>
        {state !== "verifying" && (
          <Link
            to="/"
            className="mt-6 inline-block bg-black px-5 py-3 text-xs font-bold uppercase tracking-widest text-white"
          >
            Return to store
          </Link>
        )}
      </div>
    </div>
  );
}


