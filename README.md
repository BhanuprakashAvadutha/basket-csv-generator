# basket-csv-generator

[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)

Research note → broker-ready basket CSV in 10 seconds using Claude API.

> **Note:** Sanitized excerpt of a private production system I built at a SEBI-registered research firm. The full codebase is proprietary; this repo shows the core logic and design decisions.

**Problem solved:** Building 21-column broker CSVs by hand from research notes took 4–5 min per basket, with a non-zero error rate. Wrong CE/PE → real-money mistake. Wrong date format → upload fails.

## How it works

```
Research note (plain text)
        │
        ▼
Claude API (structured extraction)
        │
        ▼ Pydantic/Zod validation
        │
        ▼
21-column broker CSV (Zerodha/Upstox/AngelOne format)
        │
        ▼
Direct upload to broker basket
```

## Example

**Input:**
```
Buy 100 shares of Reliance at market. Also buy 1 lot of Nifty 21000 CE 
December expiry at 85. Both CNC. Stop loss Nifty option at 40.
```

**Output (basket.csv):**
```csv
tradingsymbol,exchange,transaction_type,order_type,quantity,price,trigger_price,...
RELIANCE,NSE,BUY,MARKET,100,0,0,...
NIFTY24DEC21000CE,NFO,BUY,LIMIT,50,85,0,...
NIFTY24DEC21000CE,NFO,SELL,SL,50,40,40,...
```

## API

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "research_note": "Buy 100 Reliance at market CNC",
    "broker": "zerodha",
    "product_type": "CNC"
  }' \
  --output basket.csv
```

## Running it

This excerpt contains the API route (`src/app/api/generate/route.ts`) only. To run it, drop the route into a Next.js 15 app with `@anthropic-ai/sdk` and `zod` installed and set `ANTHROPIC_API_KEY`.

## Supported brokers

| Broker | CSV Format | Status |
|--------|-----------|--------|
| Zerodha | 21-column Kite format | ✅ |
| Upstox | Upstox basket format | 🚧 |
| AngelOne | SmartAPI format | 🚧 |

## Tech stack

- **Next.js 15** (App Router)
- **Anthropic Claude API** (claude-sonnet-4) — structured extraction
- **Zod** — runtime validation of extracted orders
- **Vercel** — deployment

## License

MIT
