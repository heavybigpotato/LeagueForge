import { Link } from 'react-router-dom'
import { corruptedBackupRaw, useStore } from '../store/store'
import { exportBackup } from '../store/backup'
import { checkInvariants } from '../core/invariants'
import { ROUTES, SCHEMA_VERSION } from '../core/config'
import { lastSavedAt } from '../store/persistence'
import { localStorageAdapter } from '../adapters/storage'
import { Badge } from './components'
import { Icon } from './icons'
import { ImportBackupButton } from './ImportBackup'

/**
 * Data Portability Center + system health panel. One honest place for
 * everything about where your data lives: it is stored locally on this
 * device (no server, no sync), it can leave as a JSON backup, and its
 * integrity can be checked at any time.
 */
export function DataCenterScreen() {
  const store = useStore()
  const { state } = store
  const violations = checkInvariants(state)
  const savedAt = lastSavedAt()

  const download = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  return (
    <div>
      <Link to={ROUTES.profile} className="backlink"><Icon name="arrowLeft" size={15} /> Profile</Link>
      <div className="kicker" style={{ marginTop: 10 }}>Local-first</div>
      <h1>Data Center</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Everything lives on this device — no server, no sync. Back it up here.
      </p>

      {corruptedBackupRaw && (
        <div className="card" style={{ borderColor: 'rgba(251,111,132,0.5)' }}>
          <strong style={{ color: 'var(--red)' }}>Unreadable saved data found</strong>
          <p className="faint">
            A previous save could not be understood (corrupted or from an incompatible version). It was NOT deleted — download
            it before doing anything else.
          </p>
          <button className="btn danger" onClick={() => download(corruptedBackupRaw!, 'leagueforge-corrupted-backup.json')}>
            Download unreadable data
          </button>
        </div>
      )}

      <h2>System health</h2>
      <div className="card">
        <div className="statgrid">
          <div className="cell"><div className="v">v{SCHEMA_VERSION}</div><div className="k">Schema</div></div>
          <div className="cell"><div className="v">{state.users.length}</div><div className="k">Accounts</div></div>
          <div className="cell"><div className="v">{state.leagues.length}</div><div className="k">Leagues</div></div>
          <div className="cell"><div className="v">{state.teams.length}</div><div className="k">Teams</div></div>
          <div className="cell"><div className="v">{state.matches.length}</div><div className="k">Matches</div></div>
          <div className="cell"><div className="v">{state.auditLog.length}</div><div className="k">Audit</div></div>
        </div>
        <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
          <Badge kind={localStorageAdapter.available ? 'official' : 'disputed'}>
            {localStorageAdapter.available ? 'Storage available' : 'Storage unavailable — in-memory only'}
          </Badge>
          <Badge kind={violations.length === 0 ? 'official' : 'disputed'}>
            {violations.length === 0 ? 'All integrity checks pass' : `${violations.length} integrity issue${violations.length === 1 ? '' : 's'}`}
          </Badge>
        </div>
        {savedAt && <p className="faint" style={{ marginBottom: 0 }}>Last saved {new Date(savedAt).toLocaleString()}.</p>}
        {violations.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {violations.slice(0, 6).map((v, i) => (
              <p className="faint" key={i} style={{ margin: '4px 0', color: 'var(--gold)' }}>
                {v.rule}: {v.detail}
              </p>
            ))}
          </div>
        )}
      </div>

      <h2>Backup</h2>
      <div className="card">
        <p className="faint" style={{ marginTop: 0 }}>
          One JSON file with everything. Imports are previewed before anything changes.
        </p>
        <button
          className="btn primary"
          onClick={() => download(exportBackup(state), `leagueforge-backup-${new Date().toISOString().slice(0, 10)}.json`)}
        >
          <Icon name="send" size={16} /> Export all data
        </button>
        <div style={{ marginTop: 8 }}>
          <ImportBackupButton />
        </div>
      </div>

      <h2>Danger zone</h2>
      <button
        className="btn danger"
        onClick={() => {
          if (window.confirm('Erase ALL LeagueForge data on this device? Export a backup first if in doubt.')) store.eraseDevice()
        }}
      >
        <Icon name="x" size={15} /> Erase all data on this device
      </button>
      <p className="faint" style={{ marginTop: 12 }}>
        Email, SMS, sync, and hosted leagues need a backend. This build is local by design.
      </p>
    </div>
  )
}
