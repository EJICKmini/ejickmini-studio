/**
 * stripe-setup.ts: Stripe catalog for the website studio. TEST MODE ONLY.
 *
 *   npm run stripe-setup                       create or reuse products, prices, payment links
 *   npm run stripe-setup -- invoice <email> "<business name>" <lookup_key>
 *                                              send a hosted test-mode invoice
 *
 * Key source: STRIPE_SECRET_KEY in .env if set; otherwise requests go through the
 * logged-in Stripe CLI in test mode (no key read or stored). Keys are
 * never printed, logged or written anywhere. Any key that is not sk_test_/rk_test_
 * is refused.
 *
 * Idempotent: prices are found by lookup_key, products and payment links by
 * metadata.studio_key, before anything is created. Re-running changes nothing.
 * Writes stripe-links.json (price IDs and payment link URLs only, no keys).
 */
import "./load-env.js";
import Stripe from "stripe";
import { writeFileSync, existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const REDIRECT_URL = "https://personal-site-xs12r15q0hxw.vercel.app/studio/";
// Stripe Tax stays off unless the integration plan says it is needed.
const AUTOMATIC_TAX = process.env.STRIPE_AUTOMATIC_TAX === "on";

type Offer = {
  lookupKey: string;
  productName: string;
  description: string;
  unitAmount: number; // cents
  currency: "usd";
  interval?: "month";
};

export const OFFERS: Offer[] = [
  {
    lookupKey: "launch_usd",
    productName: "Website Launch",
    description: "Design and deployment of a small-business website.",
    unitAmount: 5000,
    currency: "usd",
  },
  {
    lookupKey: "care_usd_monthly",
    productName: "Website Care",
    description: "Monthly hosting, updates and small content changes.",
    unitAmount: 1000,
    currency: "usd",
    interval: "month",
  },
];

const STRIPE_BIN = process.env.STRIPE_CLI_BIN ?? resolve(homedir(), ".npm-global/bin/stripe");

/**
 * Sends the SDK's requests through the logged-in Stripe CLI (`stripe get|post|delete`),
 * which defaults to test mode and is never given --live. No API key is read or stored.
 * Any response with livemode: true aborts the run.
 */
class CliHttpClient extends Stripe.HttpClient {
  getClientName() {
    return "stripe-cli";
  }
  async makeRequest(
    _host: string, _port: string, path: string, method: string,
    headers: Record<string, unknown>, requestData: string,
  ) {
    const [pathname, query = ""] = path.split("?");
    const body = [query, requestData].filter(Boolean).join("&");
    const args = [method.toLowerCase(), pathname];
    for (const pair of body.split("&").filter(Boolean)) {
      const [k, v = ""] = pair.split("=");
      const dec = (s: string) => decodeURIComponent(s.replace(/\+/g, " "));
      args.push("-d", `${dec(k)}=${dec(v)}`);
    }
    const version = headers["Stripe-Version"];
    if (typeof version === "string") args.push("-v", version);
    const idem = headers["Idempotency-Key"];
    if (typeof idem === "string") args.push("-i", idem);
    if (method.toUpperCase() === "DELETE") args.push("-c");
    const stdout = await new Promise<string>((ok, fail) =>
      execFile(STRIPE_BIN, args, { maxBuffer: 20 * 1024 * 1024 }, (err, out) =>
        out ? ok(out) : fail(err ?? new Error("empty response from stripe CLI")),
      ),
    );
    const json = JSON.parse(stdout.slice(stdout.indexOf("{")));
    if (json?.livemode === true || json?.data?.some?.((d: { livemode?: boolean }) => d.livemode)) {
      throw new Error("Refusing to continue: the Stripe CLI returned a live-mode object.");
    }
    const status = json?.error ? (json.error.type === "invalid_request_error" ? 400 : 402) : 200;
    const text = JSON.stringify(json);
    return new (class extends Stripe.HttpClientResponse {
      getRawResponse() { return {}; }
      toStream() { throw new Error("streaming not supported over the CLI"); }
      toJSON() { return Promise.resolve(JSON.parse(text)); }
    })(status, {});
  }
}

export function stripeClient(): { stripe: Stripe; source: string } {
  const key = process.env.STRIPE_SECRET_KEY;
  if (key) {
    if (!/^(sk|rk)_test_/.test(key)) throw new Error("Refusing to run: STRIPE_SECRET_KEY in .env is not a test-mode key.");
    return { stripe: new Stripe(key, { maxNetworkRetries: 2 }), source: ".env STRIPE_SECRET_KEY" };
  }
  if (!existsSync(STRIPE_BIN)) throw new Error("No STRIPE_SECRET_KEY in .env and no Stripe CLI found.");
  // The SDK needs a key-shaped string; the CLI transport ignores it.
  const stripe = new Stripe("sk_test_cli_session", { httpClient: new CliHttpClient(), maxNetworkRetries: 0 });
  return { stripe, source: "Stripe CLI session (test mode)" };
}

async function findProduct(stripe: Stripe, studioKey: string) {
  for await (const p of stripe.products.list({ limit: 100 })) {
    if (p.metadata?.studio_key === studioKey) return p;
  }
  return undefined;
}

async function ensurePrice(stripe: Stripe, o: Offer) {
  const existing = await stripe.prices.list({ lookup_keys: [o.lookupKey], limit: 1 });
  const found = existing.data[0];
  if (found) {
    const recurringOk = (found.recurring?.interval ?? undefined) === o.interval;
    if (found.unit_amount !== o.unitAmount || found.currency !== o.currency || !recurringOk) {
      throw new Error(`Price ${o.lookupKey} exists (${found.id}) but does not match the expected amount/interval. Fix it by hand; not overwriting.`);
    }
    return { price: found, created: false };
  }
  let product = await findProduct(stripe, o.lookupKey);
  if (!product) {
    product = await stripe.products.create({
      name: o.productName,
      description: o.description,
      metadata: { studio_key: o.lookupKey },
    });
  }
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: o.unitAmount,
    currency: o.currency,
    lookup_key: o.lookupKey,
    ...(o.interval ? { recurring: { interval: o.interval } } : {}),
    ...(AUTOMATIC_TAX ? { tax_behavior: "exclusive" as const } : {}),
  });
  return { price, created: true };
}

async function ensurePaymentLink(stripe: Stripe, o: Offer, priceId: string) {
  for await (const l of stripe.paymentLinks.list({ active: true, limit: 100 })) {
    if (l.metadata?.studio_key === o.lookupKey) return { link: l, created: false };
  }
  const link = await stripe.paymentLinks.create({
    line_items: [{ price: priceId, quantity: 1 }],
    after_completion: { type: "redirect", redirect: { url: REDIRECT_URL } },
    automatic_tax: { enabled: AUTOMATIC_TAX },
    metadata: { studio_key: o.lookupKey },
  });
  return { link, created: true };
}

/**
 * Creates (or reuses, by email) a customer, adds the price, and sends a hosted invoice.
 * One-time prices become an invoice item on a send_invoice invoice.
 * Recurring prices become a send_invoice subscription, whose first invoice Stripe sends.
 * Test mode only: Stripe does not email outside addresses from test mode.
 */
export async function createInvoice(email: string, businessName: string, priceLookupKey: string) {
  const { stripe } = stripeClient();
  const prices = await stripe.prices.list({ lookup_keys: [priceLookupKey], limit: 1 });
  const price = prices.data[0];
  if (!price) throw new Error(`No price with lookup_key ${priceLookupKey}. Run npm run stripe-setup first.`);

  const existing = await stripe.customers.list({ email, limit: 1 });
  const customer =
    existing.data[0] ?? (await stripe.customers.create({ email, name: businessName, metadata: { source: "studio" } }));

  if (price.type === "recurring") {
    const sub = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: price.id }],
      collection_method: "send_invoice",
      days_until_due: 7,
      automatic_tax: { enabled: AUTOMATIC_TAX },
      expand: ["latest_invoice"],
    });
    let inv = sub.latest_invoice as Stripe.Invoice;
    if (inv.status === "draft") inv = await stripe.invoices.finalizeInvoice(inv.id!);
    if (inv.status === "open") inv = await stripe.invoices.sendInvoice(inv.id!);
    return { customerId: customer.id, subscriptionId: sub.id, invoiceId: inv.id, hostedUrl: inv.hosted_invoice_url };
  }

  const draft = await stripe.invoices.create({
    customer: customer.id,
    collection_method: "send_invoice",
    days_until_due: 7,
    automatic_tax: { enabled: AUTOMATIC_TAX },
    pending_invoice_items_behavior: "exclude",
    metadata: { business: businessName, lookup_key: priceLookupKey },
  });
  await stripe.invoiceItems.create({ customer: customer.id, invoice: draft.id!, pricing: { price: price.id } });
  await stripe.invoices.finalizeInvoice(draft.id!);
  const sent = await stripe.invoices.sendInvoice(draft.id!);
  return { customerId: customer.id, invoiceId: sent.id, hostedUrl: sent.hosted_invoice_url };
}

async function setup() {
  const { stripe, source } = stripeClient();
  console.log(`Stripe test mode, key from ${source}. Automatic tax: ${AUTOMATIC_TAX ? "on" : "off"}.`);
  const out: Record<string, unknown> = {
    mode: "test",
    redirect_after_payment: REDIRECT_URL,
    automatic_tax: AUTOMATIC_TAX,
    prices: {} as Record<string, string>,
    payment_links: {} as Record<string, string>,
    updated_at: new Date().toISOString(),
  };
  for (const o of OFFERS) {
    const { price, created } = await ensurePrice(stripe, o);
    const { link, created: linkCreated } = await ensurePaymentLink(stripe, o, price.id);
    (out.prices as Record<string, string>)[o.lookupKey] = price.id;
    (out.payment_links as Record<string, string>)[o.lookupKey] = link.url;
    console.log(`${o.productName}: price ${price.id} (${created ? "created" : "existing"}), link ${link.url} (${linkCreated ? "created" : "existing"})`);
  }
  writeFileSync(resolve(process.cwd(), "stripe-links.json"), JSON.stringify(out, null, 2) + "\n");
  console.log("Wrote stripe-links.json");
}

const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
if (isMain) {
  const [cmd, ...rest] = process.argv.slice(2);
  const run =
    cmd === "invoice"
      ? (() => {
          const [email, business, key] = rest;
          if (!email || !business || !key) throw new Error('Usage: npm run stripe-setup -- invoice <email> "<business>" <lookup_key>');
          return createInvoice(email, business, key).then((r) => console.log(JSON.stringify(r, null, 2)));
        })()
      : setup();
  run.catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
