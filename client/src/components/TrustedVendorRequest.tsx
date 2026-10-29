
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/useAuth";
import { apiRequest } from "../lib/api";

type VendorStatus = {
  isTrustedVendor: boolean;
  trustedVendorRequestStatus: string | null;
};

export default function TrustedVendorRequest() {
  const { token } = useAuth();
  const [status, setStatus] = useState<VendorStatus | null>(null);

  useEffect(() => {
    if (!token) return;

    apiRequest("/users/me", { token })
      .then(setStatus)
      .catch(() => toast.error("Could not load trusted-vendor status"));
  }, [token]);

  if (!status || status.isTrustedVendor) return null;

  if (status.trustedVendorRequestStatus === "pending") {
    return (
      <p className="border-b border-black/10 px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-amber-700">
        Trusted-vendor request pending
      </p>
    );
  }

  return (
    <Link
      to="/my-account/trusted-vendor"
      className="block w-full border-b border-black/10 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide hover:bg-neutral-50"
    >
      {status.trustedVendorRequestStatus === "rejected"
        ? "Update trusted-vendor application"
        : "Apply for trusted-vendor status"}
    </Link>
  );
}
