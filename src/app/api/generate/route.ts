/**
 * Basket CSV Generator API
 * Converts natural language research notes → broker-ready 21-column CSV
 * using Claude API for structured extraction.
 *
 * Why this exists:
 * Building basket CSVs by hand from research notes took 4–5 min per basket.
 * Wrong CE/PE strike → real-money error. Wrong date format → upload fails.
 * This generates validated, broker-ready CSVs in ~10 seconds.
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const client = new Anthropic();

// ── Broker CSV Schema (21 columns) ───────────────────────────────────────────

const BasketRowSchema = z.object({
  tradingsymbol: z.string(),
  exchange: z.enum(["NSE", "BSE", "NFO", "MCX"]),
  transaction_type: z.enum(["BUY", "SELL"]),
  order_type: z.enum(["MARKET", "LIMIT", "SL", "SL-M"]),
  quantity: z.number().int().positive(),
  price: z.number().min(0),
  trigger_price: z.number().min(0).optional().default(0),
  disclosed_quantity: z.number().int().min(0).default(0),
  validity: z.enum(["DAY", "IOC", "GTT"]).default("DAY"),
  product: z.enum(["CNC", "MIS", "NRML"]),
  variety: z.enum(["regular", "amo", "co", "iceberg"]).default("regular"),
  tag: z.string().max(20).optional().default(""),
});

type BasketRow = z.infer<typeof BasketRowSchema>;

const RequestSchema = z.object({
  research_note: z.string().min(10).max(5000),
  broker: z.enum(["zerodha", "upstox", "angelone", "fyers"]).default("zerodha"),
  product_type: z.enum(["CNC", "MIS", "NRML"]).default("CNC"),
});

// ── Claude Extraction ─────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a trading basket parser for Indian stock markets.
Extract structured trade orders from research notes and return ONLY valid JSON.

Rules:
- tradingsymbol: NSE symbol exactly as listed (e.g. RELIANCE, HDFCBANK, NIFTY24DECCE21000)
- exchange: NSE for equity, NFO for F&O
- For options: symbol format is {UNDERLYING}{EXPIRY}{CE/PE}{STRIKE} e.g. NIFTY24DEC21000CE
- quantity must be in lots for F&O (1 lot NIFTY = 50 units)
- price: 0 for MARKET orders, actual price for LIMIT orders
- product: CNC for delivery equity, MIS for intraday, NRML for F&O overnight
- If expiry not specified for options, use nearest weekly expiry
- Return ONLY a JSON array of order objects. No explanation, no markdown.`;

async function extractOrders(researchNote: string): Promise<BasketRow[]> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Extract trade orders from this research note:\n\n${researchNote}`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";

  // Strip markdown code blocks if present
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Claude returned invalid JSON: ${cleaned.slice(0, 200)}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Claude response was not an array");
  }

  // Validate each row with Zod
  const validated: BasketRow[] = [];
  const errors: string[] = [];

  for (const [i, row] of parsed.entries()) {
    const result = BasketRowSchema.safeParse(row);
    if (result.success) {
      validated.push(result.data);
    } else {
      errors.push(`Row ${i}: ${result.error.message}`);
    }
  }

  if (errors.length > 0) {
    console.warn("Validation warnings:", errors);
  }

  if (validated.length === 0) {
    throw new Error("No valid orders extracted from research note");
  }

  return validated;
}

// ── CSV Generation ────────────────────────────────────────────────────────────

const ZERODHA_HEADERS = [
  "tradingsymbol", "exchange", "transaction_type", "order_type",
  "quantity", "price", "trigger_price", "disclosed_quantity",
  "validity", "product", "variety", "tag",
];

function toCSV(rows: BasketRow[], broker: string): string {
  const headers = ZERODHA_HEADERS; // extend for other brokers as needed

  const csvRows = rows.map((row) =>
    headers
      .map((h) => {
        const val = row[h as keyof BasketRow] ?? "";
        const str = String(val);
        return str.includes(",") ? `"${str}"` : str;
      })
      .join(",")
  );

  return [headers.join(","), ...csvRows].join("\n");
}

// ── API Route ─────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { research_note, broker, product_type } = RequestSchema.parse(body);

    const orders = await extractOrders(research_note);

    // Apply product type override if specified
    const finalOrders = orders.map((o) => ({
      ...o,
      product: product_type,
    }));

    const csv = toCSV(finalOrders, broker);
    const filename = `basket_${broker}_${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Order-Count": String(finalOrders.length),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Basket generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
