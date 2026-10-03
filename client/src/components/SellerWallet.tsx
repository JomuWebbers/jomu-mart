
import { useEffect, useState, type SubmitEvent } from "react";
import { XIcon } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/useAuth";
import { apiRequest } from "../lib/api";

type Account = {
  accountBalance: number;
  linkedBankAccountNumber: string | null;
  linkedBankName: string | null;
};

export default function SellerWallet() {
  const { token } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);
  const [open, setOpen] = useState(false);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [password, setPassword] = useState("");
  const [savingBank, setSavingBank] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    if (!token) return;

    apiRequest("/users/me", { token })
      .then(setAccount)
      .catch(() => toast.error("Could not load your seller balance"));
  }, [token]);

  const saveBankAccount = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!token) return;

    setSavingBank(true);
    try {
      const result = await apiRequest("/users/bank-account", {
        method: "PATCH",
        token,
        body: { bankName, accountNumber },
      });

      setAccount((current) =>
        current
          ? {
              ...current,
              linkedBankName: result.linkedBankName,
              linkedBankAccountNumber: result.linkedBankAccountNumber,
            }
          : current,
      );
      setBankName("");
      setAccountNumber("");
      toast.success("Bank account saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save bank account");
    } finally {
      setSavingBank(false);
    }
  };

  const withdraw = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!token) return;

    setWithdrawing(true);
    try {
      const result = await apiRequest("/users/withdraw", {
        method: "POST",
        token,
        body: { password },
      });

      setAccount((current) =>
        current ? { ...current, accountBalance: result.newBalance } : current,
      );
      setPassword("");
      toast.success(`₦${Number(result.amountWithdrawn).toLocaleString()} withdrawal recorded`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not withdraw");
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full border-b border-black/10 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide hover:bg-neutral-50"
      >
        Seller balance
        <span className="float-right">
          {account
            ? `₦${account.accountBalance.toLocaleString()}`
            : "Loading…"}
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="seller-wallet-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto border-2 border-black bg-white p-6"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                  Seller account
                </p>
                <h2 id="seller-wallet-title" className="text-xl font-black">
                  Wallet & withdrawal
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close wallet"
                className="p-2 hover:bg-neutral-100"
              >
                <XIcon className="size-5" />
              </button>
            </div>

            <div className="mb-6 bg-black p-5 text-white">
              <p className="text-[10px] uppercase tracking-widest text-neutral-300">
                Available balance
              </p>
              <p className="mt-1 text-3xl font-black">
                ₦{(account?.accountBalance ?? 0).toLocaleString()}
              </p>
            </div>

            <div className="mb-6 border-l-2 border-amber-500 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              Withdrawals currently update the demo wallet balance; this endpoint
              does not send a real bank transfer.
            </div>

            <div className="mb-6">
              <h3 className="mb-2 text-sm font-bold">Linked bank account</h3>
              {account?.linkedBankAccountNumber ? (
                <p className="border border-black/15 p-3 text-sm">
                  {account.linkedBankName} ·••••
                  {account.linkedBankAccountNumber.slice(-4)}
                </p>
              ) : (
                <p className="mb-3 text-xs text-neutral-500">
                  Link an account before requesting a withdrawal.
                </p>
              )}

              <form onSubmit={saveBankAccount} className="mt-3 space-y-3">
                <input
                  value={bankName}
                  onChange={(event) => setBankName(event.target.value)}
                  required
                  placeholder="Bank name"
                  className="w-full border border-black/20 p-3 text-sm"
                />
                <input
                  value={accountNumber}
                  onChange={(event) => setAccountNumber(event.target.value)}
                  required
                  inputMode="numeric"
                  maxLength={10}
                  pattern="[0-9]{10}"
                  placeholder="10-digit account number"
                  className="w-full border border-black/20 p-3 text-sm"
                />
                <button
                  type="submit"
                  disabled={savingBank}
                  className="w-full border-2 border-black px-4 py-3 text-xs font-bold uppercase disabled:opacity-50"
                >
                  {savingBank ? "Saving…" : "Save bank account"}
                </button>
              </form>
            </div>

            <form onSubmit={withdraw} className="space-y-3 border-t border-black/15 pt-5">
              <h3 className="text-sm font-bold">Withdraw full balance</h3>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
                placeholder="Confirm with your login password"
                className="w-full border border-black/20 p-3 text-sm"
              />
              <button
                type="submit"
                disabled={
                  withdrawing ||
                  !account?.linkedBankAccountNumber ||
                  account.accountBalance <= 0
                }
                className="w-full bg-black px-4 py-3 text-xs font-bold uppercase text-white disabled:opacity-50"
              >
                {withdrawing ? "Processing…" : "Withdraw"}
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}



