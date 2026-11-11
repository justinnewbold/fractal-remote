/*
 * WHO HAS SET HOW THE DEVICE PLAYS SOUND, so two things that make sound do
 * not undo each other.
 *
 * The metronome plays out loud with the ringer switched off, on purpose (a
 * metronome nobody can hear is no metronome), and says so to the system once
 * when it first clicks. The preset wheel's click is the other way round: it
 * is a nicety, so it is silent when the device is. Both settings are the
 * whole app's, not a player's, so whichever spoke last would win.
 *
 * So the metronome marks that it has spoken (`markLoud`), and the wheel only
 * sets its quiet mode while it has not (`isLoud`). A wheel click with the
 * metronome's mode in force is heard in silent mode too, which is the lesser
 * wrong: the other way round the metronome would go quiet mid-song.
 *
 * Nothing here imports anything.
 */
let loud = false

/** The metronome has asked to be heard with the ringer off. */
export const markLoud = () => {
  loud = true
}

/** Whether it has, since the app started. */
export const isLoud = () => loud
