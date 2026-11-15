import { useEffect, useState } from 'react'
import { TextInput, View } from 'react-native'

import { color, space } from '../lib/theme'
import { BLOCK_TO_ADD, FIND_A_BLOCK, NOTHING_FOUND, blocksListed, menuLabel, menuSaid, pickedOf } from '../lib/blockMenu'
import Note from './Note'
import Press from './Press'
import Sheet from './Sheet'

/**
 * THE BLOCK TO ADD, AS A MENU THAT OPENS AND SCROLLS (lib/blockMenu has the
 * report, and which blocks are listed and in what order).
 *
 * One button, its name over the block it is on, as a block's list settings
 * are drawn (components/BlockSettings). A tap brings the list up over the
 * page in the app's sheet: the find box stays at the top, the rows scroll
 * under it, and nothing on the page behind moves. A tap on a row picks it
 * and shuts the list.
 *
 * It draws and asks; what a pick does is the editor's (`onPick`): put the
 * block after a card, or keep it for the empty space tapped next.
 *
 * `up` and `onUp`: whether the list is up, kept by whoever draws this
 * rather than here. A card's Add is a tap that asks for the list, so the
 * editor brings it up with that tap and does not ask for a second one; shut
 * without a pick, the button is left under the card to open it again. The
 * list is never up merely because this was drawn: a menu that comes back
 * under a card (a row that had filled, with room again) stays shut. Left
 * out, the menu keeps it itself, and opens on its button alone.
 *
 * @param {{ page: number, name: string }[]} palette  every block the unit can add
 * @param {{ page: number, name: string }[]} kinds    one of each kind, what the list shows with nothing typed
 * @param {number|null} [chosen]   the page of the block picked, if this menu keeps one
 * @param {string} title           the list's heading
 * @param {string} [note]          one line under the heading: what a pick will do
 * @param {string} [label]         the button's name
 * @param {object} fieldLook       the find box's look: the editor's own, which it has always drawn (screens/Edit ChainEditor)
 * @param {boolean} [up]           the list is up (with onUp)
 * @param {(up: boolean) => void} [onUp]
 */
export default function BlockMenu({ palette, kinds, chosen = null, title, note = null, label = BLOCK_TO_ADD, fieldLook, disabled = false, up = false, onUp = null, onPick }) {
  const [own, setOwn] = useState(false)
  const open = onUp ? !!up : own
  const setOpen = onUp || setOwn
  const [find, setFind] = useState('')
  /*
   * Taken off the page with its list still up (the row filled while it was
   * open, so the words took the menu's place): the keeper is told the list
   * is down, or the next menu drawn under that card would come up by itself.
   */
  useEffect(() => () => onUp?.(false), [onUp])
  const picked = pickedOf(palette, chosen)
  const rows = blocksListed(palette, kinds, find)
  const close = () => {
    setOpen(false)
    setFind('')
  }
  return (
    <>
      <Press
        label={label}
        sub={menuSaid(picked)}
        height={52}
        disabled={disabled}
        accessibilityLabel={menuLabel(label, picked)}
        onPress={() => {
          setFind('')
          setOpen(true)
        }}
      />
      <Sheet
        open={open}
        onClose={close}
        title={title}
        note={note}
        tall
        head={
          <TextInput
            value={find}
            onChangeText={setFind}
            placeholder={FIND_A_BLOCK}
            placeholderTextColor={color.silkFaint}
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel="Find a block to add"
            style={fieldLook}
          />
        }
      >
        <View style={{ gap: space.sm }}>
          {rows.map((b) => (
            <Press
              key={b.page}
              label={b.name}
              tone="signal"
              on={!!picked && b.page === picked.page}
              disabled={disabled}
              onPress={() => {
                close()
                onPick(b)
              }}
            />
          ))}
          {!rows.length ? <Note>{NOTHING_FOUND}</Note> : null}
        </View>
      </Sheet>
    </>
  )
}
