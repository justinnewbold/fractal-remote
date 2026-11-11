import { Text, View } from 'react-native'

import { color, font, space } from '../lib/theme'
import { WATCH_PAGE_NAMES, watchPagesUsual } from '../lib/watch-link'
import { hideWatchPage, moveWatchPage, useWatchPages, usualWatchPages } from '../lib/watchPages'
import Press from './Press'

/*
 * THE WATCH'S PAGES, on Settings → Apple Watch: which are shown, and in
 * what order.
 *
 * "On the watch, can we add a way for a user to select which order their
 * pages show up in on the Watch app?" and, asked about hiding one, "Yes,
 * add hiding pages." (Justin, 11 November 2026.)
 *
 * The list reads top to bottom as the watch does: the shown pages in their
 * order, numbered, each with Hide beside its name and Move up and Move down
 * under it; then the hidden ones, faint, each with Show. The first in the
 * list is the page the watch opens on, and the list says so. Once anything
 * has been changed there is one button back to every page in the usual
 * order.
 *
 * THE LAST SHOWN PAGE CANNOT BE HIDDEN: its Hide is switched off, and a line
 * says why. (The rule refuses it as well, lib/watch-link watchPageHid, and
 * the watch reads "every page hidden" as none.)
 *
 * DRAWN ONLY FOR A WATCH THAT HAS SAID IT DOES THIS (lib/watchPages `can`,
 * from the watch's own hello). A watch from before the build that carries
 * this draws its four in the usual order whatever it is sent, and a setting
 * that does nothing is worse than none: for that watch this draws nothing
 * at all.
 *
 * Buttons, never a drag: a row dragged up a page that scrolls is the thing
 * that goes wrong under a thumb, and five rows are few enough to step.
 *
 * The words are these, in one place, so the tests can hold them
 * (test/watch-pages.mjs).
 */
export const WATCH_ORDER_HEAD = 'Watch pages'
export const WATCH_ORDER_LEAD = 'Choose which pages your Apple Watch shows, and their order. The first one is the page the watch opens on.'
export const WATCH_ORDER_FIRST = 'Opens first'
export const WATCH_ORDER_UP = 'Move up'
export const WATCH_ORDER_DOWN = 'Move down'
export const WATCH_ORDER_HIDE = 'Hide'
export const WATCH_ORDER_SHOW = 'Show'
export const WATCH_ORDER_HIDDEN = 'Hidden'
export const WATCH_ORDER_LAST = 'Your watch always keeps one page, so the last one stays.'
export const WATCH_ORDER_USUAL = 'Show every page in the usual order'
export const WATCH_ORDER_WHEN = 'Your watch takes a change the next time the Play screen is open on your iPhone.'

/* The Hide and Show buttons: beside the page's name, one width so the names line up. */
const SWITCH_WIDE = 96

export default function WatchPageOrder() {
  const { order, hidden, can } = useWatchPages()
  if (!can) return null
  const shown = order.filter((page) => !hidden.includes(page))
  const last = shown.length === 1
  return (
    <View style={{ gap: space.md }}>
      <Text accessibilityRole="header" style={{ color: color.silkFaint, fontSize: font.micro, letterSpacing: 1.5, textTransform: 'uppercase' }}>
        {WATCH_ORDER_HEAD}
      </Text>
      <Text style={{ color: color.silk, fontSize: font.body, lineHeight: 24 }}>{WATCH_ORDER_LEAD}</Text>
      {shown.map((page, i) => {
        const name = WATCH_PAGE_NAMES[page]
        return (
          <View key={page} style={{ gap: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
                <Text style={{ color: color.silk, fontSize: font.body, fontWeight: '700' }}>{`${i + 1}. ${name}`}</Text>
                {i === 0 ? <Text style={{ color: color.silkFaint, fontSize: font.micro }}>{WATCH_ORDER_FIRST}</Text> : null}
              </View>
              <View style={{ width: SWITCH_WIDE }}>
                <Press
                  label={WATCH_ORDER_HIDE}
                  height={44}
                  disabled={last}
                  accessibilityLabel={`Hide ${name} on your watch`}
                  onPress={() => hideWatchPage(page, true)}
                />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <Press
                  label={WATCH_ORDER_UP}
                  height={44}
                  disabled={i === 0}
                  accessibilityLabel={`Move ${name} up`}
                  onPress={() => moveWatchPage(page, -1)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Press
                  label={WATCH_ORDER_DOWN}
                  height={44}
                  disabled={i === shown.length - 1}
                  accessibilityLabel={`Move ${name} down`}
                  onPress={() => moveWatchPage(page, 1)}
                />
              </View>
            </View>
          </View>
        )
      })}
      {last ? <Text style={{ color: color.silkFaint, fontSize: font.micro, lineHeight: 18 }}>{WATCH_ORDER_LAST}</Text> : null}
      {hidden.length
        ? order
            .filter((page) => hidden.includes(page))
            .map((page) => {
              const name = WATCH_PAGE_NAMES[page]
              return (
                <View key={page} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
                    <Text style={{ color: color.silkFaint, fontSize: font.body, fontWeight: '700' }}>{name}</Text>
                    <Text style={{ color: color.silkFaint, fontSize: font.micro }}>{WATCH_ORDER_HIDDEN}</Text>
                  </View>
                  <View style={{ width: SWITCH_WIDE }}>
                    <Press label={WATCH_ORDER_SHOW} height={44} accessibilityLabel={`Show ${name} on your watch`} onPress={() => hideWatchPage(page, false)} />
                  </View>
                </View>
              )
            })
        : null}
      {watchPagesUsual(order, hidden) ? null : <Press label={WATCH_ORDER_USUAL} height={44} onPress={usualWatchPages} />}
      <Text style={{ color: color.silkFaint, fontSize: font.micro, lineHeight: 18 }}>{WATCH_ORDER_WHEN}</Text>
    </View>
  )
}
