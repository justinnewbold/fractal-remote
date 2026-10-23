import { describeLink } from './link'
import { FULL, BUILT_AT } from './version'
import { platform } from './platform'

/**
 * The head of the browser's log: what Copy Logs puts at the top of a paste,
 * and what a report now starts with, from one place.
 *
 * It lived inside the Debug log's Copy Logs, and a report had none of it:
 * "Is this all the information the logs send?" A report sent from the Debug
 * log or the Feedback form starts with the same head now, so the email and a
 * paste say the same things. Its first key is `app`, which is how the email
 * tells a log with a head from one an older app sent.
 *
 * The browser keeps nothing from the page's last run, so it has no runs
 * before to send (the phone has; mobile/src/lib/logKeep.js).
 */
export function logHeader({ device, link } = {}) {
  return {
    app: `${FULL} — built ${BUILT_AT} UTC`,
    unit: device?.short || device?.name || 'none',
    model: device?.model,
    /*
     * Over the relay the report also says WHICH Mac app answered. The
     * phone runs today's web build the moment it reloads; the Mac runs
     * whatever was installed, and a fix that lives in the Mac app is not
     * on until that app has been restarted into it — which the report
     * could not show, so "still broken" and "not updated yet" read alike.
     */
    link: link?.role
      ? `${link.role} · ${describeLink(link).note || ''}${
          link.role === 'remote' && link.link === 'connected'
            ? ` · computer app ${link.macVersion ? `v${link.macVersion}` : 'older than 7.190.0 (does not say)'}`
            : ''
        }`
      : undefined,
    /* With more than one computer on the account, which answered and which is driven (the phone's lib/logHead.js too). */
    computers:
      link?.role === 'remote' && link.hosts?.length > 1 ? `${link.hosts.join(', ')}; driving ${link.chosenHost || 'none of them'}` : undefined,
    platform: platform(),
    screen: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : undefined,
    browser: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
  }
}
