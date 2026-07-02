import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

/**
 * Real, scannable QR code pointing at the in-app join deep link. On the
 * hosted build this resolves to e.g.
 * https://<host>/<base>#/join/ABC12345 — scanning it on a phone opens the
 * app with the code pre-filled.
 */
export function InviteQR({ code }: { code: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const target = `${window.location.origin}${window.location.pathname}#/join/${code}`
    if (ref.current) {
      QRCode.toCanvas(ref.current, target, {
        width: 132,
        margin: 1,
        color: { dark: '#0b0d10', light: '#f2f4f7' },
      }).catch(() => {
        /* canvas unavailable — the code + link above still work */
      })
    }
  }, [code])

  return <canvas ref={ref} className="qrcanvas" aria-label={`QR code for invite ${code}`} />
}
