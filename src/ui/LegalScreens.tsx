import { ROUTES } from '../core/config'

/**
 * Plain-language legal pages, honest about how the app actually works:
 * local-first storage, no server accounts, no ads, optional one-time
 * purchase handled entirely by an external payment provider.
 * Reachable both signed-in (router) and signed-out (hash fallback in App).
 */

const LAST_UPDATED = 'July 2026'

function BackHome() {
  return (
    <a className="backlink" href={`#${ROUTES.home}`}>← Back</a>
  )
}

export function PrivacyScreen() {
  return (
    <div className="legal">
      <BackHome />
      <div className="kicker" style={{ marginTop: 10 }}>Legal</div>
      <h1>Privacy Policy</h1>
      <p className="faint">Last updated: {LAST_UPDATED}</p>

      <h2>The short version</h2>
      <p>
        LeagueForge stores everything you create — accounts, leagues, teams, matches, photos — <strong>only on your own
        device</strong>, in your browser&rsquo;s local storage. We run no server, operate no database, and receive none of
        your data. There is no analytics or tracking code in the app itself.
      </p>

      <h2>What is stored, and where</h2>
      <ul>
        <li><strong>Account details</strong> (username, email, optional phone, a salted password hash) — stored locally on your device, never transmitted.</li>
        <li><strong>League and match data</strong>, including any photos you attach as evidence — stored locally on your device.</li>
        <li><strong>Backups</strong> — created only when you tap Export, saved wherever you choose. You are responsible for backups you share.</li>
      </ul>
      <p>
        Because data lives on the device, anyone with access to your unlocked device and browser profile can access it.
        Use your device&rsquo;s lock screen and don&rsquo;t enter real passwords you use elsewhere.
      </p>

      <h2>No ads, no trackers</h2>
      <p>
        LeagueForge shows <strong>no advertising</strong> and loads no third-party scripts, cookies, or trackers. Nothing
        about your usage is measured or shared.
      </p>

      <h2>Purchases (LeagueForge Pro)</h2>
      <p>
        If the optional <strong>LeagueForge Pro</strong> upgrade is offered in your build, payment happens entirely on the
        payment provider&rsquo;s own secure checkout page — the app never sees or stores your card or bank details. The
        provider processes your payment data under its own privacy policy and emails you a license key. The key you enter
        is stored only on your device.
      </p>

      <h2>Your rights (GDPR / CCPA)</h2>
      <p>
        You are in full control of your data: it is on your device. <strong>Access/portability</strong> — use Export in the
        Data Center. <strong>Erasure</strong> — use &ldquo;Erase all data on this device&rdquo; in the Data Center, or clear
        the site&rsquo;s storage in your browser. Since we hold nothing about you, there is nothing for us to disclose,
        sell, or delete on a server. We do not sell personal information.
      </p>

      <h2>Children</h2>
      <p>
        LeagueForge is not directed at children under 13 (or the age of digital consent where you live), and you must be
        at least that old to use it.
      </p>

      <h2>Changes & contact</h2>
      <p>
        Material changes to this policy will appear in the app with an updated date. Questions:{' '}
        <a href="https://github.com/heavybigpotato/LeagueForge/issues" target="_blank" rel="noreferrer">open an issue on the project page</a>.
      </p>
    </div>
  )
}

export function TermsScreen() {
  return (
    <div className="legal">
      <BackHome />
      <div className="kicker" style={{ marginTop: 10 }}>Legal</div>
      <h1>Terms of Use</h1>
      <p className="faint">Last updated: {LAST_UPDATED}</p>

      <h2>What LeagueForge is</h2>
      <p>
        LeagueForge is a local-first tool for organizing recreational sports leagues: rosters, fixtures, scores, standings,
        and records. All data is stored on your own device — see the <a href={`#${ROUTES.privacy}`}>Privacy Policy</a>.
      </p>

      <h2>Your responsibilities</h2>
      <ul>
        <li>You must be 13 or older (or the age of digital consent where you live).</li>
        <li>You are responsible for the content you enter (names, photos, notes) and for having the right to share it — especially photos of other people.</li>
        <li>Don&rsquo;t use the app for anything unlawful, harassing, or infringing.</li>
        <li>Back up your data. Device loss, browser resets, or clearing site data will erase it; we cannot recover anything for you.</li>
      </ul>

      <h2>No warranty</h2>
      <p>
        The app is provided <strong>&ldquo;as is&rdquo;, without warranty of any kind</strong>. To the maximum extent
        permitted by law, the operator is not liable for lost data, disputes between players, or any indirect or
        consequential damages. Some jurisdictions don&rsquo;t allow certain exclusions, so parts of this may not apply to you.
      </p>

      <h2>Purchases</h2>
      <p>
        LeagueForge Pro is an optional, one-time cosmetic upgrade (theme packs and a Supporter badge). It is a digital good
        delivered immediately as a license key: by purchasing and activating it you consent to immediate delivery, which
        under EU consumer rules can waive the 14-day withdrawal right for digital content. Refund requests are handled by
        the payment provider and the operator in good faith. The unlock is per-device; keep your key with your receipt.
        Core features — leagues, teams, matches, standings — are free and stay free.
      </p>

      <h2>Changes</h2>
      <p>
        These terms may be updated as the app evolves; continued use after an update means you accept the new terms.
      </p>
    </div>
  )
}
