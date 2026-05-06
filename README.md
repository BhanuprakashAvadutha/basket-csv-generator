# basket-csv-generator

[![Vercel](https://img.shields.io/badge/deployed-Vercel-black)](https://basket-csv-generator.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)

Research note → broker-ready basket CSV in 10 seconds using Claude API.

**Problem solved:** Building 21-column broker CSVs by hand from research notes took 4–5 min per basket, with a non-zero error rate. Wrong CE/PE → real-money mistake. Wrong date format → upload fails.

**Live demo:** [basket-csv-generator.vercel.app](https://basket-csv-generator.vercel.app)

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
curl -X POST https://basket-csv-generator.vercel.app/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "research_note": "Buy 100 Reliance at market CNC",
    "broker": "zerodha",
    "product_type": "CNC"
  }' \
  --output basket.csv
```

## Local development

```bash
git clone https://github.com/BhanuprakashAvadutha/basket-csv-generator.git
cd basket-csv-generator
npm install
cp .env.example .env.local
# Add ANTHROPIC_API_KEY to .env.local
npm run dev
```

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
