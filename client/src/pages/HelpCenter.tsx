
import { Link } from "react-router-dom";
import { PageShell } from "../components/wireframe-primitives";
import { useAuth } from "../context/useAuth";

const FAQs = [
  {
    question: "How do I track an order?",
    answer:
      "Sign in to the account used to place the order, then enter the order ID on our tracking page.",
    link: "/track-order",
    linkLabel: "Track an order",
  },
  {
    question: "When will my order be delivered?",
    answer:
      "You can see the latest order status and available delivery updates on the tracking page.",
    link: "/track-order",
    linkLabel: "View tracking",
  },
  {
    question: "Which payment methods can I use?",
    answer:
      "Available payment methods are shown during checkout. The options may depend on the order.",
  },
  {
    question: "How can I contact support?",
    answer:
      "Customers who are signed in can message the Naija Mart support team using the support chat.",
  },
];

export default function HelpCenter() {
  const { user } = useAuth();

  function openSupportChat() {
    window.dispatchEvent(new Event("naija-mart:open-support-chat"));
  }

  return (
    <PageShell title="Help Center" breadcrumb="HELP / SUPPORT">
      <div className="mx-auto max-w-4xl space-y-10">
        <section className="border-2 border-black p-6 md:p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">
            Naija Mart Support
          </p>
          <h2 className="mt-2 text-2xl font-black">How can we help?</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">
            Find answers to common questions below, or contact our support team
            through chat.
          </p>

          {user?.role === "admin" ? (
            <Link
              to="/admin/support"
              className="mt-6 inline-block bg-black px-5 py-4 text-xs font-bold uppercase tracking-widest text-white"
            >
              Open support inbox
            </Link>
          ) : user ? (
            <button
              type="button"
              onClick={openSupportChat}
              className="mt-6 bg-black px-5 py-4 text-xs font-bold uppercase tracking-widest text-white"
            >
              Chat with support
            </button>
          ) : (
            <Link
              to="/login"
              className="mt-6 inline-block bg-black px-5 py-4 text-xs font-bold uppercase tracking-widest text-white"
            >
              Sign in to contact support
            </Link>
          )}
        </section>

        <section id="faqs" className="scroll-mt-8">
          <h2 className="mb-4 text-lg font-black uppercase">FAQs</h2>
          <div className="divide-y-2 divide-black border-y-2 border-black">
            {FAQs.map((item) => (
              <article key={item.question} className="py-5">
                <h3 className="font-bold">{item.question}</h3>
                <p className="mt-2 text-sm leading-6 text-neutral-600">
                  {item.answer}
                </p>
                {item.link && (
                  <Link
                    to={item.link}
                    className="mt-2 inline-block text-sm font-bold underline"
                  >
                    {item.linkLabel}
                  </Link>
                )}
              </article>
            ))}
          </div>
        </section>

        <section id="delivery" className="scroll-mt-8 border-2 border-black p-6">
          <h2 className="font-black uppercase">Delivery</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Delivery updates are available from your order tracking page. Sign
            in and use the order ID from your confirmation.
          </p>
          <Link to="/track-order" className="mt-3 inline-block font-bold underline">
            Go to order tracking
          </Link>
        </section>

        <section id="payments" className="scroll-mt-8 border-2 border-black p-6">
          <h2 className="font-black uppercase">Payments</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Payment methods available for your purchase are displayed at
            checkout. If you have a payment question, contact support through
            chat.
          </p>
        </section>

        <section id="contact" className="scroll-mt-8">
          <h2 className="font-black uppercase">Contact Support</h2>
          <p className="mt-2 text-sm text-neutral-600">
            For help with an order or payment, contact us through the support
            chat.
          </p>
        </section>
      </div>
    </PageShell>
  );
}


