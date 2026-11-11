import { Text, View } from 'react-native'

import { color, font, space } from '../lib/theme'
import { TUNER_MUTES } from '../lib/twoSides'
import { setTunerStays, useWatchPages } from '../lib/watchPages'
import Press from './Press'

/*
 * WHETHER THE WATCH'S TUNER STAYS ON WHEN ITS PAGE IS LEFT, on Settings →
 * Apple Watch, under the pages.
 *
 * "Can we make a setting in the Watch app settings, where a user can decide
 * whether or not the tuner stays on when they exit or was it turned off some
 * people wanna play while their tuner stays up on their screen ... Could we
 * make out a setting? That they turn on and off?" (Justin, 11 November 2026.)
 *
 * One switch, OFF unless it is turned on, and off is what the watch has
 * always done: swiping away from its Tuner page stops the tuner. On, a swipe
 * away no longer stops it (lib/watch-link, THE TUNER, AND LEAVING ITS PAGE).
 *
 * THE WORDS UNDER IT SAY THE CATCH, and no more than happens. A unit set to
 * mute while it tunes is muted for as long as the tuner is on, so a tuner
 * left on is a rig left silent until somebody stops it: said with the
 * phone's own sentence for that (lib/twoSides TUNER_MUTES, the line under
 * Stop tuner beside Play). They say what stops it, and that hiding the Tuner
 * page still does. They do NOT say the tuner "stays on" for good or that the
 * watch keeps showing the note: the watch's reading needs the iPhone awake
 * (the tips on this page say so), and some units let go of their own tuner
 * by themselves once the phone has gone to sleep.
 *
 * DRAWN ONLY FOR A WATCH THAT HAS SAID IT KNOWS HOW (lib/watchPages
 * `canStay`, from its hello's `stay`). A watch from before that build stops
 * the tuner when its page is left whatever it is sent, and a switch that
 * does nothing is worse than none.
 */
export const WATCH_TUNER_HEAD = 'Tuner on your watch'
export const WATCH_TUNER_STAYS_ON = 'Stays on when you swipe away: on'
export const WATCH_TUNER_STAYS_OFF = 'Stays on when you swipe away: off'
export const WATCH_TUNER_NOTE_OFF = 'Off: swiping away from the Tuner page on your watch stops the tuner.'
export const WATCH_TUNER_NOTE_ON = `On: swiping to another page on your watch doesn’t stop the tuner. Stop it with Stop tuning on the watch, or from your iPhone or the unit. ${TUNER_MUTES} If it does, your sound stays muted until the tuner is stopped. Hiding the Tuner page still stops it.`

export default function WatchTunerStays() {
  const { stays, canStay } = useWatchPages()
  if (!canStay) return null
  return (
    <View style={{ gap: space.md }}>
      <Text accessibilityRole="header" style={{ color: color.silkFaint, fontSize: font.micro, letterSpacing: 1.5, textTransform: 'uppercase' }}>
        {WATCH_TUNER_HEAD}
      </Text>
      <Press label={stays ? WATCH_TUNER_STAYS_ON : WATCH_TUNER_STAYS_OFF} tone="live" on={stays} onPress={() => setTunerStays(!stays)} />
      <Text style={{ color: color.silkDim, fontSize: font.small, lineHeight: 20, paddingHorizontal: space.sm }}>{stays ? WATCH_TUNER_NOTE_ON : WATCH_TUNER_NOTE_OFF}</Text>
    </View>
  )
}
