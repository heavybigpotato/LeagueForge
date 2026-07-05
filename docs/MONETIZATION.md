# Monetization — Google AdSense, done properly

LeagueForge ships with **Google AdSense** integration: the most widely used ad
network, run by a real company (Google), with policy-filtered ads (no adult /
shock / deceptive content allowed by [Google Publisher Policies](https://support.google.com/publisherpolicies/answer/10502938))
and real monthly payouts to your bank account.

The integration is **off by default**. Until you put your own publisher id in
the config, the app shows **zero ads, loads zero ad code, and asks for no
consent** — nothing fake, nothing dormant phoning home.

## How the money flows

1. Google shows ads in your app → advertisers pay Google.
2. Google credits your AdSense account (you can watch earnings in the dashboard).
3. Once you pass the payout threshold (€70 / $100), Google wires the money to
   the bank account **you configure in AdSense → Payments info**.
   - That is where your IBAN goes: **AdSense → Payments → Manage payment methods → Add bank account**.
   - **Never put your IBAN in this repository** — the repo is public, and the
     code has no use for it. Payouts are configured entirely inside your
     Google account.

## Step-by-step setup

### 1. Get a domain (required)

AdSense approves **sites you own at a domain level**. A `github.io` subpath
(`heavybigpotato.github.io/LeagueForge`) will not be approved. Buy a domain
(~€10/year at any registrar), then in the repo settings enable
**GitHub Pages → Custom domain** and point the DNS `CNAME` at
`heavybigpotato.github.io`. HTTPS is automatic.

### 2. Create the AdSense account

1. Go to [adsense.google.com](https://adsense.google.com) → **Get started** with your Google account.
2. Enter your site (the custom domain), country **France**, accept the terms.
3. Complete the identity + address verification Google asks for (they mail a
   PIN letter for the final payment verification).
4. Connect your site: AdSense gives you a snippet/verification method —
   putting your `ca-pub-…` id in this app (step 4 below) and deploying also
   serves as the code-on-site check.

### 3. Add ads.txt

Copy `public/ads.txt.example` to `public/ads.txt`, replace the placeholder
with **your** publisher id, commit, deploy. This one-line file tells
advertisers your inventory is legitimately yours (an IAB standard; AdSense
warns and can limit earnings without it).

### 4. Configure the app

In `src/core/config.ts`:

```ts
export const ADSENSE = {
  clientId: 'ca-pub-XXXXXXXXXXXXXXXX',   // your publisher id
  slots: {
    home: '1111111111',      // create these in AdSense → Ads → By ad unit
    discover: '2222222222',  // ("Display ad", responsive) — one per surface
    league: '3333333333',
  },
}
```

Rebuild and deploy. From that moment:

- First-time visitors see a **consent prompt** (required in the EU). Ads load
  only after "Allow ads". Decliners simply never get ad code — fully legal,
  no dark patterns.
- Ads render inside native-styled cards labeled **Sponsored**, placed at the
  bottom of the Home, Discover, and League screens — never over content.

### 5. Keep the ads "good"

In the AdSense dashboard → **Brand safety → Content → Blocking controls** you
can additionally block categories you don't want (gambling, dating, politics,
etc.) and turn off "sensitive categories" wholesale. Google already filters
illegal/adult/misleading ads by policy; blocking controls tighten it further.

### 6. EU consent (when you grow)

The built-in consent gate is deliberately conservative: **no consent → no ad
code at all**, which is compliant everywhere. When you want higher EEA
revenue, enable Google's **certified CMP** (AdSense → Privacy & messaging →
create a GDPR message). Google then handles the full TCF consent flow itself;
you can remove the built-in banner at that point.

## What to expect

- Approval takes days to a few weeks; Google wants to see real content and
  some traffic. Launch first, apply once the app has users.
- Revenue is traffic-driven (roughly €1–€10 per 1,000 views depending on
  audience/geo). Ads pay for hosting-scale money at small traffic — it grows
  with the app.
- Alternatives if AdSense declines a small site: Ezoic (low entry), Carbon Ads
  (design-friendly, invite), Media.net. The `AdSlot` component isolates the
  integration, so swapping networks touches one file.
