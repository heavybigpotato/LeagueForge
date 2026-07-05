import { useEffect, useState } from 'react'
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { StoreProvider, useStore } from './store/store'
import { Avatar, Toasts } from './ui/components'
import { BrandMark, Icon } from './ui/icons'
import { OnboardingScreen } from './ui/OnboardingScreen'
import { HomeScreen } from './ui/HomeScreen'
import { CreateLeagueScreen } from './ui/CreateLeagueScreen'
import { LeagueScreen } from './ui/LeagueScreen'
import { LeagueSettingsScreen } from './ui/LeagueSettingsScreen'
import { LeagueActivityScreen } from './ui/LeagueActivityScreen'
import { CreateTeamScreen } from './ui/CreateTeamScreen'
import { TeamScreen } from './ui/TeamScreen'
import { MatchScreen } from './ui/MatchScreen'
import { LiveScoreboardScreen } from './ui/LiveScoreboardScreen'
import { JoinScreen } from './ui/JoinScreen'
import { DiscoverScreen } from './ui/DiscoverScreen'
import { ProfileScreen } from './ui/ProfileScreen'
import { DataCenterScreen } from './ui/DataCenterScreen'
import { PrivacyScreen, TermsScreen } from './ui/LegalScreens'
import { useProState } from './store/pro'
import { ROUTES } from './core/config'

export default function App() {
  return (
    <StoreProvider>
      <Gate />
    </StoreProvider>
  )
}

/** Everything behind this gate can rely on a signed-in account. */
function Gate() {
  const { signedIn } = useStore()
  const hash = useHash()
  if (!signedIn) {
    // Legal pages must be readable before an account exists (the onboarding
    // footer links to them), so handle their hashes without the router.
    if (hash.startsWith(`#${ROUTES.privacy}`) || hash.startsWith(`#${ROUTES.terms}`)) {
      return (
        <div className="phone">
          <main className="content">{hash.startsWith(`#${ROUTES.privacy}`) ? <PrivacyScreen /> : <TermsScreen />}</main>
        </div>
      )
    }
    return <OnboardingScreen />
  }
  return <MainApp />
}

/** Live view of location.hash for the pre-sign-in screens (no router yet). */
function useHash(): string {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash
}

/** Reset scroll to the top whenever the route changes — a fresh screen. */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])
  return null
}

function MainApp() {
  const { accent } = useProState()
  return (
      <HashRouter>
        <ScrollToTop />
        <div className="phone" data-accent={accent}>
          <TopBar />
          <main className="content">
            <Routes>
              <Route path="/" element={<HomeScreen />} />
              <Route path="/create-league" element={<CreateLeagueScreen />} />
              <Route path="/league/:leagueId" element={<LeagueScreen />} />
              <Route path="/league/:leagueId/settings" element={<LeagueSettingsScreen />} />
              <Route path="/league/:leagueId/activity" element={<LeagueActivityScreen />} />
              <Route path="/create-team" element={<CreateTeamScreen />} />
              <Route path="/discover" element={<DiscoverScreen />} />
              <Route path="/team/:teamId" element={<TeamScreen />} />
              <Route path="/match/:matchId" element={<MatchScreen />} />
              <Route path="/match/:matchId/live" element={<LiveScoreboardScreen />} />
              <Route path="/join" element={<JoinScreen />} />
              <Route path="/join/:code" element={<JoinScreen />} />
              <Route path="/profile" element={<ProfileScreen />} />
              <Route path={ROUTES.dataCenter} element={<DataCenterScreen />} />
              <Route path={ROUTES.privacy} element={<PrivacyScreen />} />
              <Route path={ROUTES.terms} element={<TermsScreen />} />
            </Routes>
          </main>
          <Toasts />
          <nav className="bottomnav">
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon name="home" size={20} />
              Home
            </NavLink>
            <NavLink to="/discover" className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon name="compass" size={20} />
              Discover
            </NavLink>
            <NavLink to="/join" className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon name="ticket" size={20} />
              Join
            </NavLink>
            <NavLink to="/profile" className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon name="user" size={20} />
              Profile
            </NavLink>
          </nav>
        </div>
      </HashRouter>
  )
}

function TopBar() {
  const { currentUser } = useStore()
  return (
    <header className="topbar">
      <BrandMark size={24} />
      <span className="wordmark">
        League<em>Forge</em>
      </span>
      <span className="spacer" />
      <span className="who">
        @{currentUser.username}
        <Avatar user={currentUser} size="sm" />
      </span>
    </header>
  )
}
