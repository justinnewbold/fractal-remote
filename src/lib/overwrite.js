/**
 * Whether a save is about to write over somebody's preset, and so needs a
 * second tap.
 *
 * "Save has no overwrite guard." Worse than reported: every slot counted as
 * holding something whether or not its name had ever been read, so a slot
 * nobody had asked about was shown as "an empty slot" — and over the relay
 * that is most of them. Saving over the loaded slot under a new name said
 * nothing at all. The button wrote on the first tap either way.
 *
 * The tester's rule, which is the one here: guard when the slot holds a
 * preset under another name, AND when what it holds is not known. Only a slot
 * known to be empty, or known to hold this same preset, saves on one tap.
 *
 * Pure, so the rule can be run without a browser.
 */

/** The unit keeps 31 characters, and a name typed in another case is the same preset. */
const same = (a, b) =>
  String(a || '').trim().slice(0, 31).toLowerCase() === String(b || '').trim().slice(0, 31).toLowerCase()

/**
 * - `target`: the slot the save writes.
 * - `loaded`: the slot the unit is on.
 * - `loadedName`: what the loaded slot was called when it was loaded, or null
 *   when that is not known. The buffer came out of that slot, so this is what
 *   the slot still holds until the save lands — whatever the buffer has been
 *   renamed to since.
 * - `holds`: `{ name, known }` for the target, as looked up, or null while
 *   the look-up is out.
 * - `saveAs`: the name the save will write.
 *
 * Returns `{ need, name }`. `need` is 'none' (one tap is enough), 'confirm'
 * (another preset is there: `name`), 'unknown' (it could not be read) or
 * 'checking' (still asking). Everything but 'none' takes a second tap.
 */
export function overwriteCheck({ target, loaded, loadedName, holds, saveAs }) {
  if (!Number.isInteger(target)) return { need: 'none', name: '' }
  let known = false
  let name = ''
  if (target === loaded && typeof loadedName === 'string') {
    known = true
    name = loadedName
  } else if (holds && holds.number === target) {
    known = !!holds.known
    name = holds.name || ''
  } else {
    return { need: 'checking', name: '' }
  }
  if (!known) return { need: 'unknown', name: '' }
  const was = name.trim()
  if (!was) return { need: 'none', name: '' }
  if (same(was, saveAs)) return { need: 'none', name: was }
  return { need: 'confirm', name: was }
}

/** The second tap's words, on the button that takes it. */
export const overwriteAsk = (check, target) =>
  check.need === 'confirm' ? `Overwrite “${check.name}”?` : `Overwrite slot ${target}?`
