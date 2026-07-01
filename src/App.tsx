import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import { StoreProvider, useStore } from './store/store'
import { Toasts } from './ui/components'
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
              <span className="icon">🏆</span>Leagues
            </NavLink>
            <NavLink to="/join" className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="icon">🎟️</span>Join
            </NavLink>
            <NavLink to="/profile" className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="icon">👤</span>Profile
            </NavLink>
          </nav>
        </div>
      </HashRouter>
    </StoreProvider>
  )
}

function TopBar() {
  const { currentUser } = useStore()
  return (
    <header className="topbar">
      <span className="brand">
        League<span className="forge">Forge</span>
      </span>
      <span className="spacer" />
      <span className="faint">@{currentUser.username}</span>
      <span className="avatar">{currentUser.username.slice(0, 2).toUpperCase()}</span>
    </header>
  )
}
