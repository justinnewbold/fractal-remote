import { useState } from 'react'
import { Text, TextInput, View } from 'react-native'

import { color, font, radius, space, TAP } from '../lib/theme'
import { IR_HINT, USER_IRS_NOTE, findIrs } from '../lib/cab-pick'
import Note from './Note'
import Press from './Press'

/*
 * How many rows the list draws: a thumb cannot read a thousand, and drawing
 * them is a screen that stutters while you try. The same cap the model list
 * uses, with the rest counted under it.
 */
const SHOWN = 40

/**
 * Choosing a cab block's IR by name — the browser's IrPicker, on the phone.
 *
 * "Pick a cab IR by name." The IR number and the bank are off the knobs, and
 * until this nothing had taken their place. The banks come from the cab state
 * and the names from the unit's IR list, in the unit's order (see irBanks in
 * lib/cab-pick.js); the pick itself is the block panel's, which writes it and
 * offers the Undo.
 */
export default function IrPicker({ banks, now, onPick, disabled }) {
  const [open, setOpen] = useState(false)
  const [bank, setBank] = useState(null)
  const [hunt, setHunt] = useState('')

  const onBank = bank ?? now?.bank ?? banks[0]?.value ?? null
  const chosen = banks.find((b) => b.value === onBank)
  const typed = !!hunt.trim()
  const { rows, more } = open ? findIrs(banks, hunt, onBank, SHOWN) : { rows: [], more: 0 }

  return (
    <View style={{ gap: space.sm }}>
      <Press
        caption="IR"
        label={now?.playing ? now.name : 'Pick an IR'}
        sub={open ? 'Close' : now?.playing ? now.bankName : 'Tap to choose'}
        disabled={disabled}
        onPress={() => {
          if (!open) {
            setHunt('')
            setBank(null)
          }
          setOpen((v) => !v)
        }}
      />
      {now && !now.playing ? <Text style={{ color: color.silkDim, fontSize: font.small }}>{IR_HINT}</Text> : null}
      {open ? (
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {banks.map((b) => (
              <Press
                key={b.value}
                label={b.name}
                tone="signal"
                height={44}
                on={b.value === onBank && !typed}
                onPress={() => {
                  setBank(b.value)
                  setHunt('')
                }}
              />
            ))}
          </View>
          <TextInput
            value={hunt}
            onChangeText={setHunt}
            placeholder="Find an IR by name or number"
            placeholderTextColor={color.silkFaint}
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel="Find an IR"
            style={{
              minHeight: TAP,
              paddingHorizontal: space.md,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: color.rule,
              backgroundColor: color.panel,
              color: color.silk,
              fontSize: font.body
            }}
          />
          {chosen?.user && !typed ? <Note>{USER_IRS_NOTE}</Note> : null}
          {rows.map((r) => (
            <Press
              key={r.key}
              label={r.name}
              /* Which bank, when a search reaches across all of them. */
              sub={typed ? r.bankName : undefined}
              tone="signal"
              on={!!now?.playing && r.bank === now.bank && r.ir === now.ir}
              onPress={() => {
                setOpen(false)
                setHunt('')
                onPick({ bank: r.bank, ir: r.ir, name: r.name })
              }}
            />
          ))}
          {more > 0 ? (
            <Text style={{ color: color.silkDim, fontSize: font.micro }}>
              {`${more} more — type a name or a number to narrow it down.`}
            </Text>
          ) : null}
          {!rows.length ? <Note>Nothing named like that.</Note> : null}
        </View>
      ) : null}
    </View>
  )
}
