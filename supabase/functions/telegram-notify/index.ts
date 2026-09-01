// ============================================================
// Lexstore — Telegram order notifications
// ------------------------------------------------------------
// Triggered by a Supabase database webhook (pg_net) on every
// INSERT into the `orders` table — NOT called directly from the
// site. This keeps the bot token out of client-side code entirely;
// it only ever lives in this function's Supabase secrets.
//
// The webhook is expected to send the standard Supabase webhook
// payload: { type: "INSERT", table: "orders", record: {...} }
// and to carry a shared secret in the `x-webhook-secret` header
// (configured on the trigger side) so this endpoint can't be
// called by anyone who merely finds the URL.
// ============================================================

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET");

interface OrderItem {
  id: string;
  name: string;
  qty: number;
  price: number;
}

interface Order {
  order_number: string;
  name: string;
  phone: string;
  delivery_type: "delivery" | "pickup";
  address: string | null;
  comment: string | null;
  items: OrderItem[];
  total: number;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatOrder(order: Order): string {
  const items = Array.isArray(order.items) ? order.items : [];
  const lines = [
    `🛒 <b>Новый заказ Lexstore № ${escapeHtml(order.order_number)}</b>`,
    "",
    `Имя: ${escapeHtml(order.name)}`,
    `Телефон: ${escapeHtml(order.phone)}`,
    order.delivery_type === "delivery"
      ? `Доставка: ${escapeHtml(order.address || "—")}`
      : "Самовывоз",
    "",
    "Товары:",
    ...items.map(
      (it) => `— ${escapeHtml(it.name)} × ${it.qty} = ${it.price * it.qty} Br.`,
    ),
    "",
    `<b>Итого: ${escapeHtml(order.total)} Br.</b>`,
  ];
  if (order.comment) {
    lines.push("", `Комментарий: ${escapeHtml(order.comment)}`);
  }
  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (WEBHOOK_SECRET) {
    const got = req.headers.get("x-webhook-secret");
    if (got !== WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  if (!BOT_TOKEN || !CHAT_ID) {
    console.error("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not configured");
    return new Response("Not configured", { status: 500 });
  }

  let payload: { record?: Order } & Partial<Order>;
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const order = (payload.record ?? payload) as Order;
  if (!order || !order.order_number) {
    return new Response("Missing order data", { status: 400 });
  }

  const text = formatOrder(order);

  const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "HTML" }),
  });

  if (!tgRes.ok) {
    console.error("Telegram API error:", await tgRes.text());
    return new Response("Telegram send failed", { status: 502 });
  }

  return new Response("OK", { status: 200 });
});
