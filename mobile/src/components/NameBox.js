import { useEffect, useRef, useState } from 'react'
import { Modal, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { color, font, radius, space, TAP } from '../lib/theme'
import { ANY_WAY_UP, clearSides } from '../lib/screenShape'
import { NAME_LABELS, NAME_MAX, cleanName, nameProblem } from '../lib/account-name'
import Note from './Note'
import Press from './Press'

/**
 * The name on the account, typed or changed after the account was made.
 *
 * "Now that we have names available to use under edit profile, let's have
 * the ability to add a name to people that haven't previously." (Justin, 7
 * November 2026.) Accounts made before 5 November were never asked; this is
 * where they add one, and where anybody changes theirs. The same two fields
 * and the same rules as Create account (shared/account-name.mjs), kept on
 * the account itself the same way (relay.js changeName): optional since 8
 * November 2026, so either may be left empty, and emptying one and saving
 * takes that name off the account. Up high like the
 * password box, so the keyboard cannot reach it. A solid panel rather than
 * frosted glass: the glass is kept to the six pop-ups that had it (the
 * Classic look is held to them, test/glass.mjs and test/glass-classic.mjs),
 * and a box opened once to type a name needs no blur behind it.
 */
/** The dim over the screen behind it. */
const DIM = 'rgba(0, 0, 0, 0.55)'

export default function NameBox({ open, first: wasFirst = '', last: wasLast = '', onSave, onClose }) {
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const { height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const field = useRef(null)
  const second = useRef(null)

  useEffect(() => {
    if (!open) return
    setFirst(wasFirst || '')
    setLast(wasLast || '')
    setBusy(false)
    setError(null)
  }, [open, wasFirst, wasLast])

  const commit = async () => {
    const problem = nameProblem({ first, last })
    if (problem) {
      setError(problem)
      return
    }
    /* Nothing changed (an empty box on an account with no name, say): close, send nothing, say nothing. */
    if (cleanName(first) === cleanName(wasFirst) && cleanName(last) === cleanName(wasLast)) {
      onClose()
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSave({ first, last })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const box = {
    minHeight: TAP,
    backgroundColor: color.chassis,
    borderWidth: 1,
    borderColor: color.live,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    color: color.silk,
    fontSize: font.lead
  }

  return (
    <Modal visible={!!open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent supportedOrientations={ANY_WAY_UP}>
      {/* Neither the glass nor the panel is one element to a screen reader, or
          VoiceOver reads the whole box as a single Close button and never
          reaches the fields inside it (as TopBar's note learned). Cancel is
          its way out. */}
      <Pressable accessible={false} onPress={onClose} style={{ flex: 1 }}>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            paddingTop: Math.max(space.xxl, height * 0.1),
            ...clearSides(insets, space.xl),
            backgroundColor: DIM
          }}
        >
          <Pressable
            accessible={false}
            onPress={() => field.current?.focus()}
            style={{
              width: '100%',
              maxWidth: 420,
              gap: space.md,
              padding: space.lg,
              borderRadius: radius.lg * 2,
              borderWidth: 1,
              borderColor: color.rule,
              backgroundColor: color.panel
            }}
          >
            <Text style={{ color: color.silkFaint, fontSize: font.micro, letterSpacing: 1.5 }}>YOUR NAME</Text>

            <TextInput
              ref={field}
              autoFocus
              value={first}
              onChangeText={(t) => {
                setFirst(t)
                setError(null)
              }}
              placeholder={NAME_LABELS.first}
              placeholderTextColor={color.silkFaint}
              accessibilityLabel={NAME_LABELS.first}
              autoCapitalize="words"
              autoComplete="given-name"
              textContentType="givenName"
              maxLength={NAME_MAX}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => second.current?.focus()}
              style={box}
            />
            <TextInput
              ref={second}
              value={last}
              onChangeText={(t) => {
                setLast(t)
                setError(null)
              }}
              placeholder={NAME_LABELS.last}
              placeholderTextColor={color.silkFaint}
              accessibilityLabel={NAME_LABELS.last}
              autoCapitalize="words"
              autoComplete="family-name"
              textContentType="familyName"
              maxLength={NAME_MAX}
              returnKeyType="done"
              onSubmitEditing={commit}
              style={box}
            />

            {error ? <Note tone="fault">{error}</Note> : null}

            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Press grow label="Cancel" onPress={onClose} />
              <Press grow label={busy ? 'Saving…' : 'Save'} tone="signal" on disabled={busy} onPress={commit} />
            </View>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  )
}
