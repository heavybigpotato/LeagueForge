import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import { StoreProvider, useStore } from './store/store'
import { isVerifiedUser } from './core/types'
import { Avatar, Toasts } from './ui/components'
import { BrandMark, Icon } from './ui/icons'
import { OnboardingScreen } from './ui/OnboardingScreen'
import { HomeScreen } from './ui/HomeScreen'
import { CreateLeagueScreen } from './ui/CreateLeagueScreen'
import { LeagueScreen } from './ui/LeagueScreen'
import { CreateTeamScreen } from './ui/CreateTeamScreen'
import { TeamScreen } from './ui/TeamScreen'
import { MatchScreen } from './ui/MatchScreen'
import { JoinScreen } from './ui/JoinScreen'
import { ProfileScreen } from './ui/ProfileScreen'

export default function App() {
  return (
    <StoreProvider>
      <Gate />
    </StoreProvider>
  )
}

/** Everything behind this gate can rely on a signed-in, verified account. */
function Gate() {
  const { signedIn, currentUser } = useStore()
  if (!signedIn || !isVerifiedUser(currentUser)) return <OnboardingScreen />
  return <MainApp />
}

function MainApp() {
  return (
      <HashRouter>
        <div className="phone">
          <TopBar />
          <main className="content">
            <Routes>
              <Route path="/" element={<HomeScreen />} />
              <Route path="/create-league" element={<CreateLeagueScreen />} />
              <Route path="/league/:leagueId" element={<LeagueScreen />} />
              <Route path="/league/:leagueId/create-team" element={<CreateTeamScreen />} />
              <Route path="/team/:teamId" element={<TeamScreen />} />
              <Route path="/match/:matchId" element={<MatchScreen />} />
              <Route path="/join" element={<JoinScreen />} />
              <Route path="/join/:code" element={<JoinScreen />} />
              <Route path="/profile" element={<ProfileScreen />} />
            </Routes>
          </main>
          <Toasts />
          <nav className="bottomnav">
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon name="home" size={20} />
              Home
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
