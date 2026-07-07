# Monetization — LeagueForge Pro (in-app purchase)

LeagueForge earns money through **one honest in-app purchase**: a one-time
"LeagueForge Pro" upgrade (accent theme packs + Supporter badge), sold through
a hosted checkout and delivered as a license key. No ads, no tracking, no
subscriptions, and the core app — leagues, teams, matches, standings — stays
completely free (which also keeps it clean under EU consumer law).

The purchase surface is **off by default**: until you paste a real checkout
link into the config, the app shows no Pro card, no teaser, no dead button.

## How the money flows

1. A player taps **Get Pro** in the app → lands on your product's checkout
   page (hosted by the payment provider — the app never touches card data).
2. The provider charges them, handles VAT/sales tax, and emails them the
   license key you attached to the product.
3. They type the key into the app → Pro unlocks on their device.
4. The provider pays out to the bank account **you configure in the
   provider's dashboard**. That is where your IBAN goes — never in this repo.

## Recommended provider: Gumroad (or Lemon Squeezy)

Both are **merchants of record**: they are legally the seller, so *they*
handle EU VAT, US sales tax, invoices, and chargebacks — the single biggest
legal simplification available to a solo operator. Gumroad is free to start
(they take a cut per sale), needs no company, and supports payouts to French
bank accounts.

### Setup (~15 minutes, once, free)

1. **Create the account** — [gumroad.com](https://gumroad.com) → sign up →
   fill in payout details (**Settings → Payments → your IBAN**) and the tax
   info they ask for. Only you can do this step (identity + bank ownership).
2. **Create the product** — "LeagueForge Pro", price €4.99 (or what you like),
   type: digital product. Enable **"Generate a unique license key per sale"**
   *or* paste a batch of keys you mint yourself (step 3) into the product's
   content so each buyer receives one.
3. **Mint license keys** — in this repo:

   ```bash
   # first: change PRO.keySecret in src/core/config.ts to something private
   npm run pro:key          # one key
   npm run pro:key -- 25    # a batch of 25
   ```

   Paste the batch into the Gumroad product (or send one manually per sale).
   Keys are `LFPRO-XXXXX-XXXXX-XXXXX`, verified offline by the app.
4. **Turn the store on** — in `src/core/config.ts` set:

   ```ts
   export const PRO = {
     checkoutUrl: 'https://YOURNAME.gumroad.com/l/leagueforge-pro',
     keySecret: 'your-new-private-secret',
     price: '4.99',
     currency: '€',
   }
   ```

   Commit and deploy. The Pro card appears on the Profile screen.

## What buyers get (and the design rule behind it)

Accent theme packs (Ember, Ocean, Rose, Gold), a **Supporter** badge, and
warm fuzzies. Deliberately **cosmetic only**: a local-first app cannot
server-enforce entitlements, so gating competitive features would punish
honest users without stopping determined ones. Cosmetics monetize goodwill —
the model that works for community software.

## Honest limits, stated plainly

- License checking is **honor-level**: the verification secret ships in the
  client, as it must in any backend-less app. Fine for cosmetics; it is not
  DRM and the docs/UI never pretend otherwise.
- The unlock is **per device** (stored in that browser's local storage). A
  buyer can reuse their key on their other devices; tell them to keep it.
- Payouts, refunds, VAT, and receipts all live at the provider. Your total
  ongoing work: occasionally mint a fresh key batch.
