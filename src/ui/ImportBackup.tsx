import { useRef, useState } from 'react'
import { useStore } from '../store/store'
import { validateBackup, type ImportPreview } from '../store/backup'
import { Icon } from './icons'

/**
 * Import flow: pick a file → validate + preview counts → confirm replace.
 * Nothing is applied until the user has seen exactly what the backup holds.
 */
export function ImportBackupButton({ ghost }: { ghost?: boolean }) {
  const store = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    const text = await file.text()
    setPreview(validateBackup(text))
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={(e) => {
          onFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <button className={`btn${ghost ? ' ghost' : ''}`} onClick={() => fileRef.current?.click()}>
        <Icon name="scroll" size={16} /> Import backup
      </button>

      {preview && (
        <div className="card" style={{ marginTop: 10, textAlign: 'left' }}>
          {!preview.ok ? (
            <>
              <strong style={{ color: 'var(--red)' }}>Backup rejected</strong>
              {preview.errors.map((e, i) => (
                <p className="faint" key={i} style={{ marginBottom: 0 }}>{e}</p>
              ))}
              <button className="btn small ghost" style={{ marginTop: 10 }} onClick={() => setPreview(null)}>Dismiss</button>
            </>
          ) : (
            <>
              <strong>Backup preview</strong>
              <p className="faint" style={{ marginTop: 6 }}>
                Schema v{preview.schemaVersion}
                {preview.exportedAt ? ` · exported ${new Date(preview.exportedAt).toLocaleString()}` : ''}
              </p>
              <div className="statgrid" style={{ marginTop: 4 }}>
                <div className="cell"><div className="v">{preview.counts?.users}</div><div className="k">Accounts</div></div>
                <div className="cell"><div className="v">{preview.counts?.leagues}</div><div className="k">Leagues</div></div>
                <div className="cell"><div className="v">{preview.counts?.teams}</div><div className="k">Teams</div></div>
                <div className="cell"><div className="v">{preview.counts?.matches}</div><div className="k">Matches</div></div>
                <div className="cell"><div className="v">{preview.counts?.auditEntries}</div><div className="k">Audit</div></div>
                <div className="cell"><div className="v">{preview.counts?.seasonsArchived}</div><div className="k">Seasons</div></div>
              </div>
              {preview.warnings.length > 0 && (
                <p className="faint" style={{ color: 'var(--gold)' }}>
                  ⚠ {preview.warnings.length} integrity warning{preview.warnings.length === 1 ? '' : 's'} found in this backup — it can
                  still be imported, but review it afterwards in the Data Center.
                </p>
              )}
              <p className="faint">Importing replaces ALL current local data with this backup.</p>
              <div className="btnrow" style={{ marginTop: 8 }}>
                <button
                  className="btn primary"
                  onClick={() => {
                    if (preview.state) store.applyImportedState(preview.state)
                    setPreview(null)
                  }}
                >
                  Replace local data
                </button>
                <button className="btn ghost" onClick={() => setPreview(null)}>Cancel</button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
