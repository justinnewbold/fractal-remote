import { useEffect, useState } from 'react'
import { Alert, BackHandler, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native'

import { color, font, mono, radius, space, TAP, MODES, getMode, setMode } from '../lib/theme'
import { APP_VERSION } from '../lib/version'
import { AFFILIATION } from '../lib/affiliation'
import { isOlder } from '../lib/versions'
import { setDemo, useDemo, useDemoUnit, setDemoUnit } from '../lib/demo'
import { UNITS as DEMO_UNITS } from '../lib/demoUnits'
import { getDebugLog } from '../lib/debugLog'
import { tick } from '../lib/feedback'
import { usePurchase } from '../lib/purchases'
import { applyNow, checkNow, describeRunning, useUpdates } from '../lib/updates'
import {
  changePassword,
  currentAccount,
  deleteAccount,
  hostConflict,
  pickHost,
  remoteChosenHost,
  remoteHosts,
  sendPasswordReset
} from '../lib/relay'
import { useRig } from '../lib/rig'
import { fcReadable } from '../lib/footswitches'
import Footswitches from '../components/Footswitches'
import {
  SIZES,
  clampSize,
  loadFit,
  loadIcons,
  loadSceneLayout,
  loadSceneOrder,
  loadSize,
  saveFit,
  saveIcons,
  saveSceneLayout,
  saveSceneOrder,
  saveSize,
  SCENE_LAYOUTS
} from '../lib/gigSize'
import { REPLAY } from '../lib/onboarding'
import { sync, useStored } from '../lib/store'
import { isPairAccount } from '../lib/pairing'
import { mayDrive } from '../lib/unlock-rule'
import { useComputerElsewhere } from '../lib/useComputerElsewhere'
import { quitEditor } from '../lib/editors'
import { isAdmin } from '../lib/admin'
import AccessTool from '../components/AccessTool'
import AccountsTool from '../components/AccountsTool'
import SalesTool from '../components/SalesTool'
import Lamp from '../components/Lamp'
import { ChainCards, TipCard } from '../components/Walk'
import { linkChain } from '../lib/link-chain'
import playIcon from '../../assets/icons/play.png'
import laptopIcon from '../../assets/icons/laptop.png'
import mailIcon from '../../assets/icons/mail.png'
import phoneIcon from '../../assets/icons/phone.png'
import sendIcon from '../../assets/icons/send.png'
import setupIcon from '../../assets/icons/setup.png'
import Note from '../components/Note'
import PasswordBox from '../components/PasswordBox'
import Press from '../components/Press'
import { stopLooper } from '../components/Looper'
import { findLooper } from '../lib/looper'
import SceneArrange from '../components/SceneArrange'
import EdgeBack from '../components/EdgeBack'
import Sheet from '../components/Sheet'

const face = Platform.select(mono)

const ofDeviceName = (s) => s.deviceName
const ofFirmware = (s) => s.firmware

const ofUnitState = (s) => s.unit
const ofAllBlocks = (s) => s.allBlocks
const ofCapabilities = (s) => s.capabilities

/**
 * Everything that isn't playing.
 *
 * Folded off the stage screen on purpose: which Mac, which account, and a new
 * password are all things done about once, and none of them should be within
 * reach of a thumb that is looking for the next scene.
 */
/* The sections below that write to the unit are the ones the browser keeps
   under "Unit" in its own Setup: renaming is bench work, not something a thumb
   crosses between songs, which is exactly why neither app puts it on Play. */
export default function Settings({
  onUnlock,
  onOpenConnect,
  link,
  macName,
  hostVersion,
  onBack,
  onReconnect,
  onSignOut,
  onOpenGear,
  onReplay,
  onOpenLog,
  onOpenFixes,
  onOpenReport,
  onSignIn,
  /* The page to open on, and who to tell when it changes — see App.js's
     openSettings. */
  startPage = null,
  onPage
}) {
  const deviceName = useRig(ofDeviceName)
  const firmware = useRig(ofFirmware)
  const unitState = useRig(ofUnitState)
  const [account, setAccount] = useState(null)
  /* A computer on this wifi signed into another account — the likeliest
     reason nothing answers, and until now one nothing on this page could see. */
  const elsewhere = useComputerElsewhere(link === 'no-answer')
  /*
   * Whether the account service has answered yet.
   *
   * `account` is null both before the question is asked and when nobody is
   * signed in, and those are opposite answers. Without this the line below
   * has to guess during the first frame, and the old code guessed "Signed
   * in." — which is how a demo with no session at all came to say it was
   * signed in.
   */
  const [asked, setAsked] = useState(false)
  const [hosts, setHosts] = useState(remoteHosts())
  const [chosen, setChosen] = useState(remoteChosenHost())
  /*
   * The account line opens a small sheet of the things done about once —
   * change the password, or have a reset link sent. "Change it to where the
   * box isn't just showing New password": it sat open on this page for
   * everyone who came to change the tile size.
   */
  const [accountMenu, setAccountMenu] = useState(false)
  /* A scene being dragged on the Appearance page holds the page still — see
     components/SceneArrange. */
  const [held, setHeld] = useState(false)
  /* The account's email, when there is a real one: a pairing code's account
     is not somebody's email and is not called one. */
  const signedInAs = account?.email && !isPairAccount(account.email) ? account.email : null
  const [changing, setChanging] = useState(false)
  /* Delete account: Apple's 5.1.1(v). A sheet that says what goes, then one
     more tap — never one tap from the page. */
  const [deleting, setDeleting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    currentAccount()
      .then((a) => alive && setAccount(a))
      .catch(() => {})
      .finally(() => alive && setAsked(true))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    setHosts(remoteHosts())
    setChosen(remoteChosenHost())
  }, [link])

  const conflict = hostConflict(hosts, chosen)
  /* What the Stop the looper row last did, in words, in place of its hint. */
  const allBlocks = useRig(ofAllBlocks)
  /* A unit whose switches can be read — see the Footswitches page. */
  const switchesReadable = fcReadable(useRig(ofCapabilities))
  const [looperSaid, setLooperSaid] = useState(null)
  async function stopTheLooper() {
    const looper = findLooper(allBlocks)
    if (!looper) {
      setLooperSaid('This preset has no looper, so nothing is looping')
      return
    }
    setLooperSaid('Stopping…')
    try {
      await stopLooper(looper.effectId)
      setLooperSaid('Stopped')
    } catch (e) {
      setLooperSaid(`Didn’t stop — ${e?.message || 'the unit did not answer'}`)
    }
  }

  const unitDown = link === 'connected' && (unitState === 'missing' || unitState === 'silent')
  const lamp = unitDown ? 'fault' : link === 'connected' ? 'live' : link === 'no-answer' ? 'fault' : 'idle'

  /**
   * Which page of Setup is open, or null for the list of them.
   *
   * SETUP IS A LIST OF DOORS, not a scroll of everything at once. That is the
   * browser's shape and it was arrived at the hard way — "I wanna overhaul this
   * whole settings set-up screen" — and the phone had the pile it replaced, with
   * eight scene-name boxes as the FIRST thing you saw. Nobody opens Setup to
   * rename scene 6.
   *
   * Each row carries the one fact you would have opened it to learn: which unit
   * and whether it answers, which Mac the phone is on, what size the tiles are.
   */
  /*
   * Behind only when the computer SAID a version and it is older. A computer
   * that says nothing used to be counted as behind — "Still getting the
   * message saying the Mac version is off, but is definitely on the right
   * version" — and telling somebody to update an app that is current is worse
   * than saying nothing. A missing version is its own case, said as such:
   * the Mac app writes it every few minutes, and since 7.295.0 its own menu
   * bar line says what the phones hear.
   */
  const demo = useDemo()
  /* Which one, and told when it changes. Read as `demoUnit()` this never
     redrew, so the five buttons stayed lit on whichever unit the app started
     as however many times they were pressed. */
  const unit = useDemoUnit()
  const behind = !!hostVersion && isOlder(hostVersion, APP_VERSION) === true

  const [page, setPage] = useState(startPage)
  useEffect(() => {
    onPage?.(page)
  }, [page, onPage])
  const purchase = usePurchase()
  const updates = useUpdates()
  /* Which bundle is running, asked once when Setup opens. It settles "did an
     update ever land" without anybody comparing numbers off two screens. */
  useEffect(() => {
    describeRunning()
  }, [])

  const linkWord =
    link === 'connected'
      ? `Connected to ${macName || 'your computer'}`
      : link === 'joining'
        ? 'Finding your computer'
        : link === 'no-answer'
          ? 'Your computer isn’t answering'
          : 'Not connected'

  /*
   * TWO WAYS OUT OF EVERY PAGE, and they go to different places on purpose.
   *
   * "Add the done button to all submenus, and if they click done, it takes
   * them directly back to the play screen, no matter how deep they are in the
   * submenus. Swiping back should always take them to the previous screen."
   *
   * Back is one step — a submenu to the list, the list to Play. Done is the
   * whole way out from any depth. A submenu had only Back, so leaving from
   * three levels in meant tapping out one level at a time; the list had only
   * Done, so there was no step back from it at all. Both now have both.
   *
   * The submenu head is two rows rather than three things crammed across one:
   * Back and Done on the top, the title under them with the width to itself.
   * "Rename presets and scenes" is four words that will not share a line with
   * two buttons on a phone.
   */
  /*
   * WHICH PAGE A BACK GOES TO, which was not a question until now.
   *
   * Every page came off the front list, so back was always the front list and
   * the button could say "‹ Settings" without thinking. Troubleshooting is
   * inside About now, and a back that walked past the page you came from
   * would be the app forgetting where you were standing.
   *
   * One entry, because there is one nested page. It is a map rather than an
   * `if` so the next one is a line rather than a branch.
   */
  const PARENT = { offline: 'link', access: 'developer', sales: 'developer', accounts: 'developer' }
  const UP_LABEL = { link: '‹ Phone & computer', developer: '‹ Developer' }
  const upFrom = (p) => PARENT[p] || null
  const upLabel = (p) => UP_LABEL[PARENT[p]] || '‹ Settings'

  const head = (title, onDone) =>
    onDone === 'back' ? (
      <View style={{ gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
          <Press label={upLabel(page)} height={40} onPress={() => setPage(upFrom(page))} />
          <Press label="Done" height={40} onPress={onBack} />
        </View>
        <Text accessibilityRole="header" style={{ color: color.silk, fontSize: font.title, fontWeight: '700' }}>
          {title}
        </Text>
      </View>
    ) : (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
        <Text accessibilityRole="header" style={{ color: color.silk, fontSize: font.title, fontWeight: '700' }}>
          {title}
        </Text>
        <Press label="Done" height={40} onPress={onBack} />
      </View>
    )

  /* One step up, whatever that means from where you are standing. The swipe
     and the Back button are the same errand, so they ask the same function. */
  const goBack = () => (page === null ? onBack?.() : setPage(upFrom(page)))
  /* Android's back, one page up, the same as the swipe and the Back button —
     heard here before App.js hears it, because only this screen knows it has
     pages inside it. */
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack()
      return true
    })
    return () => sub.remove()
  })

  return (
    <EdgeBack onBack={goBack}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: space.xxl }}
      keyboardShouldPersistTaps="handled"
      scrollEnabled={!held}
    >
      {page === null ? (
        <>
          {head('Settings')}
          {/*
            SETTINGS, IN GROUPS.

            "Think of anything that can be made so that the user has an easier
            time quickly locating settings they wanna check out. As right now
            I don't think it's very clear." Ten rows of the same weight meant
            reading every one to find anything. Now the account sits on top as
            a card, and the rest is under five headings that say what each
            group is for: the rig, the play screen, help, about, and — on his
            account only — developer.

            Two rows left. Renaming presets and scenes is part of the preset,
            so it went to the Edit screen beside it. Troubleshooting came up
            out of About, where it was two taps deep on the evening it is
            needed most.
          */}
          <AccountCard
            asked={asked}
            email={signedInAs}
            paired={isPairAccount(account?.email)}
            unlocked={purchase.unlocked}
            demo={demo}
            onPress={() => {
              setNote(null)
              setError(null)
              setPage('account')
            }}
          />

          <Group title="My rig">
            {/*
              One row for the whole chain: this phone, the computer, and the
              unit plugged into it — the status says how far along it gets.
            */}
            <SetupRow
              title="Phone & computer"
              status={
                demo
                  ? `Demo — simulated ${DEMO_UNITS.find((u) => u.key === unit)?.name || 'unit'}`
                  : link !== 'connected'
                    ? linkWord
                    : unitState === 'missing'
                      ? 'Computer connected · no unit'
                      : unitState === 'silent'
                        ? `Computer connected · ${deviceName || 'unit'} not answering`
                        : `${deviceName || 'Unit'} · connected`
              }
              onPress={() => setPage('link')}
            />
            {/*
              THE LOOPER'S EMERGENCY STOP. "There needs to be something in
              settings … for when it keeps playing." It carries on across a
              preset change when the next preset has a Looper block too, and
              this stops it on one tap from wherever the player is.
            */}
            {/* What each switch does, read off the unit — the browser's
                Footswitches panel, here. Only where the switches can be read. */}
            {(link === 'connected' || demo) && switchesReadable ? (
              <SetupRow title="Footswitches" status="What each switch does" onPress={() => setPage('footswitches')} />
            ) : null}
            {link === 'connected' || demo ? (
              <SetupRow
                title="Stop the looper"
                status={looperSaid || 'If a loop keeps playing'}
                onPress={stopTheLooper}
              />
            ) : null}
          </Group>

          <Group title="Help">
            {/* Up from inside About: the page needed most on a bad evening
                is now one tap from Settings, not two. */}
            {onOpenFixes || onOpenLog || onOpenReport ? (
              <SetupRow
                title="Troubleshooting"
                status="What to try, the log, and telling us"
                onPress={() => setPage('trouble')}
              />
            ) : null}
            {/* What each model on the unit really is — something to look up
                while playing, so it sits with the help rather than first. */}
            {onOpenGear ? (
              <SetupRow title="Amp & pedal names" status="What each model on your unit really is" onPress={onOpenGear} />
            ) : null}
            {onReplay ? <SetupRow title={REPLAY} status="The setup, from the start" onPress={onReplay} /> : null}
          </Group>

          <Group title="About">
            {/*
              The version, and an update waiting says so here, where the list
              is read, instead of one page further in.
            */}
            <SetupRow
              title="About"
              status={updates.phase === 'ready' ? 'Update ready — tap to restart into it' : `v${APP_VERSION}`}
              onPress={() => (updates.phase === 'ready' ? applyNow() : setPage('about'))}
            />
          </Group>

          {/* Justin's own tools, on his account only — see lib/admin.js. One
              row for all three: "we should probably just make that into one
              menu called developer". */}
          {isAdmin(account?.email) ? (
            <Group title="Developer">
              <SetupRow title="Developer" status="Access, sales, and accounts" onPress={() => setPage('developer')} />
            </Group>
          ) : null}

          {/* Last: "Move the Play Screen section down to the bottom of the list." */}
          <Group title="Play screen">
            <SetupRow
              title="Tiles & scenes"
              status="Tile size, effect pictures, scene layout"
              onPress={() => setPage('appearance')}
            />
            {/* Light or dark right here: one tap, not a page to open for it. */}
            <View style={{ paddingVertical: space.md }}>
              <Appearance />
            </View>
          </Group>
        </>
      ) : null}

      {/* -------------------------------------------------------- account */}
      {page === 'account' ? (
        <>
          {head('Account', 'back')}
          {/* Everything about who this is, in one place. It was the bottom of
              Phone & computer, which nobody would think to open to change a
              password. */}
          <View style={{ gap: space.md }}>
            {isPairAccount(account?.email) || !account?.email ? (
              <>
                <Text style={{ color: color.silkDim, fontSize: font.small }}>
                  {!asked
                    ? 'Checking…'
                    : isPairAccount(account?.email)
                      ? 'Paired with your computer, no account. What you save stays on this phone.'
                      : 'Not signed in on this device.'}
                </Text>
                {asked && onSignIn ? <Press label="Sign in with an email and password" onPress={onSignIn} /> : null}
              </>
            ) : (
              <TipCard
                icon={mailIcon}
                label="SIGNED IN"
                body={`${account.email}\nTap for password options`}
                onPress={() => {
                  setNote(null)
                  setError(null)
                  setAccountMenu(true)
                }}
              />
            )}

            {note ? <Note>{note}</Note> : null}
            {error ? <Note tone="fault">{error}</Note> : null}

            <Press label="Sign out on this phone" onPress={onSignOut} />
            <Text style={{ color: color.silkFaint, fontSize: font.micro, lineHeight: 18 }}>
              The computer stays signed in — signing out here must not drop the link mid-set.
            </Text>

            {/* Apple Guideline 5.1.1(v): an account made in the app can be
                deleted in the app. On this page, and named plainly, so it is
                found where an account is looked for. */}
            {signedInAs ? (
              <Press
                label="Delete account"
                sub="Remove this account and everything saved under it"
                onPress={() => {
                  setNote(null)
                  setError(null)
                  setDeleting(true)
                }}
              />
            ) : null}
          </View>

          <Sheet open={deleting} onClose={() => (busy ? null : setDeleting(false))} title="Delete account" note={account?.email || ''}>
            <Text style={{ color: color.silk, fontSize: font.small, lineHeight: 21 }}>
              This deletes your account for good: your sign-in, your set lists, bug reports you sent from it and
              everything else stored under it. It happens straight away and cannot be undone. Any computer signed in
              to this account is signed out.
            </Text>
            <Text style={{ color: color.silkDim, fontSize: font.small, lineHeight: 21 }}>
              {`The full version you bought stays with your ${Platform.OS === 'ios' ? 'Apple ID' : 'Google account'}. Restore a purchase brings it back on a new account.`}
            </Text>
            <Press
              label={busy ? 'Deleting…' : 'Delete my account'}
              tone="live"
              disabled={busy}
              onPress={async () => {
                setBusy(true)
                try {
                  await deleteAccount()
                  setDeleting(false)
                  Alert.alert('Account deleted', `${account?.email || 'Your account'} has been deleted, and you are signed out.`)
                  onSignOut?.()
                } catch (err) {
                  setDeleting(false)
                  setError(err.message)
                } finally {
                  setBusy(false)
                }
              }}
            />
            <Press label="Keep my account" disabled={busy} onPress={() => setDeleting(false)} />
          </Sheet>

          {/*
            THE FULL VERSION, AND THE WAY BACK TO ONE ALREADY PAID FOR.

            The Restore a purchase Apple requires, for somebody who paid and
            is on a new handset — and gone once the app is unlocked: "the
            unlock full version needs to disappear if it has been unlocked."
          */}
          <View style={{ gap: 0 }}>
            {purchase.unlocked ? null : (
              <SetupRow
                title="Unlock the full version"
                status={purchase.price ? `Drive a real rig · ${purchase.price}` : 'Drive a real rig, or restore a purchase'}
                onPress={onUnlock}
              />
            )}
          </View>

          <Sheet open={accountMenu} onClose={() => setAccountMenu(false)} title="Your account" note={account?.email || ''}>
            <Press
              label="Change password"
              sub="Type a new one here, twice"
              onPress={() => {
                setAccountMenu(false)
                setChanging(true)
              }}
            />
            <Press
              label={busy ? 'Sending…' : 'Email me a link to reset it'}
              sub="For when the old one is forgotten"
              disabled={busy}
              onPress={async () => {
                setBusy(true)
                try {
                  await sendPasswordReset(account.email)
                  setAccountMenu(false)
                  setNote(`A link to set a new password is on its way to ${account.email}.`)
                } catch (err) {
                  setAccountMenu(false)
                  setError(err.message)
                } finally {
                  setBusy(false)
                }
              }}
            />
          </Sheet>

          <PasswordBox
            open={changing}
            onChange={async (next) => {
              await changePassword(next)
              setNote('Password changed.')
            }}
            onClose={() => setChanging(false)}
          />
        </>
      ) : null}

      {/* ------------------------------------------------------ developer */}
      {page === 'developer' && isAdmin(account?.email) ? (
        <>
          {head('Developer', 'back')}
          <View style={{ gap: 0 }}>
            <SetupRow title="Give someone access" status="Look someone up, or unlock them" onPress={() => setPage('access')} />
            <SetupRow title="Sales at a glance" status="Today, this week, all time" onPress={() => setPage('sales')} />
            <SetupRow title="Everyone with an account" status="Who has signed up" onPress={() => setPage('accounts')} />
          </View>
        </>
      ) : null}

      {/* ------------------------------------------------------ appearance */}
      {page === 'footswitches' ? (
        <>
          {head('Footswitches', 'back')}
          <Footswitches />
        </>
      ) : null}

      {page === 'appearance' ? (
        <>
          {head('Tiles & scenes', 'back')}
          <View style={{ gap: space.md }}>
            <Section>Stage tiles</Section>
            <TileSize onScrollLock={setHeld} />
          </View>
        </>
      ) : null}

      {/* -------------------------------------------------- troubleshooting */}
      {page === 'trouble' ? (
        <>
          {head('Troubleshooting', 'back')}
          <Text style={{ color: color.silkDim, fontSize: font.small, lineHeight: 20 }}>
            In order: try the fixes, read the log if they did not help, then tell us and the log
            goes with it.
          </Text>
          <View style={{ gap: 0 }}>
            {onOpenFixes ? (
              <SetupRow
                title="Fixes"
                status="What to try when it isn’t working"
                onPress={onOpenFixes}
              />
            ) : null}
            {/* Called Log, because that is what it opens. It said "Help &
                fixes" — the name of the row directly above it, which opens
                something else entirely. */}
            {onOpenLog ? (
              <SetupRow
                title="Log"
                status={`${getDebugLog().length} line${getDebugLog().length === 1 ? '' : 's'} in the log`}
                onPress={onOpenLog}
              />
            ) : null}
            {/* Last of the three, and the one that goes the other way: Fixes
                and the log are things to read, this is the thing to send when
                neither helped. */}
            {onOpenReport ? (
              <SetupRow
                title="Feedback"
                status="Something broken, or something you want"
                onPress={onOpenReport}
              />
            ) : null}
          </View>
        </>
      ) : null}

      {/* ------------------------------------------------------ phone & mac */}
      {page === 'link' ? (
        <>
          {head('Phone & computer', 'back')}

          <View style={{ gap: space.md }}>
            <Section>The link</Section>
            {/*
              THE CHAIN, AS CARDS. "I thought we updated this to a new
              format… always make sure you're updating all the platforms."
              The unit, the computer and this phone, each with a lamp, joined
              by the two wires from How it works — and the words come from
              lib/link-chain, the same file the browser's page draws from.
              The unit's firmware and both version numbers live on the cards
              now; they were three separate lines under a lamp.
            */}
            <ChainCards
              cards={linkChain({
                here: 'phone',
                demo,
                unit: {
                  name: demo ? DEMO_UNITS.find((u) => u.key === unit)?.name || 'FM3' : deviceName,
                  firmware,
                  state: unitState
                },
                computer: { name: macName, version: hostVersion, link },
                phone: {
                  version: APP_VERSION,
                  email: account?.email && !isPairAccount(account.email) ? account.email : null
                }
              })}
            />

            {/* What to do about a unit that is missing or silent, under the
                card that says so. The usual reason besides the cable is
                Fractal's own editor holding the unit — named, per unit where
                it is known (lib/editors.js). */}
            {link === 'connected' && !demo && (unitState === 'missing' || unitState === 'silent') ? (
              <Note tone="fault">
                {unitState === 'missing'
                  ? `${quitEditor(deviceName)} This finds the unit again by itself once it is free.`
                  : `A frozen unit looks like this. ${quitEditor(deviceName)}`}
              </Note>
            ) : null}

            {/*
              The demo says what it is and offers the way out, first, because
              everything under it is about a computer this is not talking to.
            */}
            {demo ? (
              <>
                <Note tone="warn">
                  {`This is the demo — a simulated ${
                    DEMO_UNITS.find((u) => u.key === unit)?.name || 'FM3'
                  }. Every screen works and nothing reaches hardware. It also answers instantly, so anything still slow in here is this app rather than the line to a computer.`}
                </Note>
                {/*
                  Which unit, because the demo was an FM3 and only an FM3 —
                  and an AM4 owner opening it saw eight scene tiles their unit
                  has not got. Each of these holds its own real factory bank:
                  the preset names and the scene names the unit ships with.
                */}
                <Section>Which unit</Section>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                  {DEMO_UNITS.map((u) => (
                    <Press
                      key={u.key}
                      label={u.name}
                      tone="signal"
                      on={u.key === unit}
                      height={44}
                      style={{ paddingHorizontal: space.md }}
                      onPress={() => setDemoUnit(u.key)}
                    />
                  ))}
                </View>
                {/*
                  THE WAY OUT IS FOR SOMEBODY WHO HAS PAID.

                  "Someone should only be able to exit a demo if they've
                  already purchased the app or paid."

                  It used to be here for everybody, and for somebody who has
                  not paid it was a door to an empty room: the live app with
                  no unlock is a screen that cannot drive anything. The demo
                  IS the app until it is bought.

                  Nobody is shut in. Heading for Sign in ends the demo too —
                  see App.js's toSignIn — and the sign-in screen offers the
                  demo again, so the way out for somebody who has not paid is
                  the one they would take anyway.

                  The same words as the bar, because it is the same errand and
                  two words for one action is how the two ends drifted apart
                  everywhere else in this app.
                */}
                {purchase.unlocked ? (
                  <TipCard icon={playIcon} label="EXIT DEMO" body="Back to your own rig" onPress={() => setDemo(false)} />
                ) : null}
              </>
            ) : purchase.unlocked ? (
              /*
                THE WAY IN, FOR SOMEBODY WHO HAS PAID.

                "It would be a good idea for somebody that wants to maybe view
                what it looks like having an AxeFX 3 or another model they
                don't have yet to play around with it."

                The demo is hidden from everybody who has bought the app —
                it is not on the walkthrough they have been past, and signing
                in ends it — so this is the door he asked to keep. Here rather
                than on the front list because this page is what the phone is
                talking to, and the demo is a thing to talk to.

                ONE WORD, not the sign-in screen's three. "If they are
                already signed in and the app is unlocked, instead of saying
                try the demo, have it just say Demo."

                The two are not the same sentence because the two readers are
                not the same person. "Try the Demo" is an offer, made to
                somebody who has not paid and is deciding — try it, see what
                it does. By the time this button is on screen that decision is
                made: they are signed in, they own the app, and the demo is
                simply one of the things it has. A place, not a pitch.

                And no heading over it, which he confirmed. A heading here
                would be a sentence I wrote rather than one he did, and the
                button already says what it does.
              */
              <TipCard icon={playIcon} label="DEMO" onPress={() => setDemo(true)} />
            ) : null}

            {/*
              What the computer is running, and whether that is behind.

              "Does the Mac app need to be updated to the latest version? Or
              would that affect how the app performs?" It would: that app holds
              the cable to the unit and does every read this phone asks for, so
              an old one is slow here in a way that looks exactly like this app
              being slow. The number was already being sent and nobody looked at
              it.
            */}
            {link === 'connected' && !demo && behind ? (
              <Note tone="warn">
                The app on the computer is behind this one. Update it there — it is the part that
                holds the cable to your unit, and an old one is slow here in a way that looks like
                this app being slow.
              </Note>
            ) : null}
            {link === 'connected' && !demo && !hostVersion ? (
              <Note>
                The computer didn’t say which version it is running: its app is older than 7.205.0, or
                it could not write its name for the phone. If the computer is on 7.295.0 or newer, its menu bar icon has a line saying what the
                phones hear about its version, and that line says what is wrong.
              </Note>
            ) : null}

            {/* A computer on this wifi on another account is the reason, and it is
                said instead — see useComputerElsewhere. */}
            {link === 'no-answer' && elsewhere ? (
              <Note tone="fault">
                {account?.email && !isPairAccount(account.email)
                  ? `The computer on this wifi is signed into a different account. This phone is signed in as ${account.email}. Sign the Fractal app on the computer in with ${account.email}, or sign this phone out below and into the computer’s account.`
                  : 'The computer on this wifi is signed into a different account than this phone. Sign both into the same account.'}
              </Note>
            ) : link === 'no-answer' ? (
              <Note tone="warn">
                Open the Fractal app on the computer and make sure the computer is awake. This keeps trying on
                its own.
              </Note>
            ) : null}
            {/* Which account this is — his words: "make sure you're connected
                to your computer using and then show the user's email
                address". A computer signed in as somebody else is the
                likeliest reason nothing answers. */}
            {link === 'no-answer' && account?.email && !isPairAccount(account.email) ? (
              <Note>{`Make sure you’re connected to your computer using ${account.email}.`}</Note>
            ) : null}

            {/*
              The way in to getting a computer on the other end at all.

              It was a row of its own on the front of Setup, called
              "Connecting a computer", sitting between two rows about a
              computer that was already connected. It belongs here, on the
              page about the line to that computer — and it stays offered even
              once the line is up, because the second computer somebody wants
              to add is one they add on an evening when the first one works.
            */}
            {onOpenConnect ? (
              <TipCard icon={laptopIcon} label="CONNECT A COMPUTER" body="How do I connect a computer?" onPress={onOpenConnect} />
            ) : null}

            {/*
              PLAYING WITH NO INTERNET, told to the people who paid for the app.
              
              "Let's make that some kind of option in the app or to tell people
              how to do it to connect without internet and give instructions to
              people that have already unlocked it."

              The route is real and it is the only one that works in a room with
              no signal, but it was advertised in the wrong place: the website's
              signed-out screen, headed "no account, no code", where it read as
              a way around paying. It is off that screen now. This is where it
              belongs instead — behind the unlock, told to somebody who has
              already bought the thing.

              AND IT IS NOT THIS APP THAT DOES IT, which is the part that has to
              be said plainly rather than implied. Everything here goes through
              the relay, which is on the internet; there is no code in this app
              that speaks to a computer over wifi, and pretending otherwise
              would have somebody trying it on a stage. What works is the phone's
              WEB BROWSER on the computer's own page, so that is what the
              instructions say to open.

              `mayDrive` rather than `purchase.unlocked` on purpose: it also says
              yes when the store could not be reached, and a person whose signal
              is bad is exactly the person who needs to read this.
            */}
            {/*
              A card of its own, like Connect a computer, opening a page of its
              own. "Let's make the how to connect without internet its own
              button… the text on it right now is extremely small and hard to
              read, so it would be nice to have it bigger and everything on its
              own page." The words are the same; they are on page 'offline'.
            */}
            {mayDrive(purchase) ? (
              <TipCard
                icon={phoneIcon}
                label="PLAYING WITH NO INTERNET"
                body="How do I play with no internet?"
                onPress={() => setPage('offline')}
              />
            ) : null}

            {/*
              Only while there is something to try. "The Try now button is
              there and if you click it it does — I'm not sure why it's even
              there if we're already all connected." It looks for the computer
              again, which on a live link is a button that does nothing you
              can see. Said as what it does, too.
            */}
            {link !== 'connected' ? <Press label="Look for the computer again" onPress={onReconnect} /> : null}
          </View>

          {hosts.length > 1 ? (
            <View style={{ gap: space.md }}>
              <Section>Which computer</Section>
              {conflict ? <Note tone="fault">{conflict}</Note> : null}
              {hosts.map((name, i) => (
                <Press
                  key={`${name}-${i}`}
                  label={name}
                  tone="live"
                  on={name === chosen}
                  onPress={async () => {
                    await pickHost(name)
                    setChosen(remoteChosenHost())
                  }}
                />
              ))}
            </View>
          ) : null}

          {/* Who this is signed in as moved to its own Account page, off the
              top of Settings: "change password" under "Phone & computer" was
              somewhere nobody would look. */}
        </>
      ) : null}

      {/* ---------------------------------------------------------- access */}
      {page === 'access' && isAdmin(account?.email) ? (
        <>
          {head('Give someone access', 'back')}
          <AccessTool />
        </>
      ) : null}

      {/* ----------------------------------------------------------- sales */}
      {page === 'sales' && isAdmin(account?.email) ? (
        <>
          {head('Sales at a glance', 'back')}
          <SalesTool />
        </>
      ) : null}

      {/* -------------------------------------------------------- accounts */}
      {page === 'accounts' && isAdmin(account?.email) ? (
        <>
          {head('Everyone with an account', 'back')}
          <AccountsTool />
        </>
      ) : null}

      {/* ----------------------------------------------------------- about */}
      {/* -------------------------------------------------------- offline */}
      {/*
        PLAYING WITH NO INTERNET, on a page of its own, one step to a card and
        at a size that can be read — see the card on Phone & computer.

        AND IT IS NOT THIS APP THAT DOES IT, which is the part that has to be
        said plainly rather than implied. Everything here goes through the
        relay, which is on the internet; there is no code in this app that
        speaks to a computer over wifi. What works is the phone's WEB BROWSER
        on the computer's own page, so that is what the steps say to open.

        Behind `mayDrive` like the card, because it is told to the people who
        paid — see the note that used to sit on the link page.
      */}
      {page === 'offline' && mayDrive(purchase) ? (
        <>
          {head('Playing with no internet', 'back')}
          <Text style={{ color: color.silk, fontSize: font.body + 1, lineHeight: 24 }}>
            This app reaches your computer over the internet, so it needs a signal. For a room that
            has none, there is another way round and it does not use this app.
          </Text>
          <View style={{ gap: space.md }}>
            <TipCard icon={sendIcon} label="1  SAME WIFI" body="Put the phone on the same wifi as the computer." />
            <TipCard
              icon={laptopIcon}
              label="2  OPEN THE CODE"
              body="On the computer, open the Fractal app’s Settings → Phone & computer → Playing with no internet."
            />
            <TipCard
              icon={phoneIcon}
              label="3  POINT THE CAMERA"
              body="Point the phone’s camera at the code there — it opens in the phone’s web browser."
            />
            <TipCard
              icon={setupIcon}
              label="OR TYPE THE ADDRESS"
              body="The same address is in the computer’s menu bar (the system tray on Windows), next to the Fractal icon, to type instead."
            />
          </View>
          <Text style={{ color: color.silk, fontSize: font.body + 1, lineHeight: 24 }}>
            You get the same screens, and no part of it goes near the internet.
          </Text>
          <Note size={font.body}>
            What you change there is kept by that browser rather than in your account, so it does not
            follow you to this app or to another phone.
          </Note>
        </>
      ) : null}

      {page === 'about' ? (
        <>
          {head('About', 'back')}
          <Text style={{ color: color.silk, fontSize: font.body, fontFamily: face }}>
            {`Fractal Remote v${APP_VERSION}`}
          </Text>

          {/*
            INSIDE ABOUT, not beside it.

            "Move walkthrough, updates and troubleshooting INSIDE of the
            'About' menu."

            They were moved under About an hour ago, which was the smaller
            version of the same instruction: they are the rows you go looking
            for on an evening when something is wrong, or once, ever. Under it
            they still cost five lines of a list somebody opens to do
            something else. In it they cost one.

            What is left on the front page is the four things Setup is opened
            FOR, and one door to everything else.
          */}
          <View style={{ gap: 0 }}>
          {/*
            * WHAT IS RUNNING, AND HOW TO GET THE NEWEST.
            *
            * "I have not yet successfully had a single over-the-air update
            * work correctly. They never come through, so I keep refreshing
            * the android app, closing it, force closing it, reopening it
            * over and over again."
            *
            * They were arriving. What was missing was any way to SEE it,
            * plus one detail that makes a working app look stuck: this app
            * never waits for a download at launch — app.json sets
            * fallbackToCacheTimeout to 0, so it starts on the bundle it
            * already has, fetches the new one in the BACKGROUND, and runs it
            * the NEXT time it opens.
            *
            * First launch downloads. Second launch shows it. Somebody
            * force-closing once, seeing the same number and concluding
            * nothing happened was one restart short, with nothing on screen
            * to say so.
            *
            * That default is right for a stage and is not what changes here.
            * This says what is going on, and offers the restart instead of
            * waiting for it to happen by accident.
            */}
          <SetupRow
            title="Updates"
            status={
              updates.phase === 'ready'
                ? 'Ready — tap to restart into it'
                : updates.phase === 'downloading'
                  ? 'Downloading…'
                  : updates.phase === 'checking'
                    ? 'Checking…'
                    : updates.phase === 'current'
                      ? 'Up to date'
                      : updates.phase === 'off'
                        ? 'Not available in this build'
                        : updates.error
                          ? 'Could not check — tap to try again'
                          : `Running ${updates.source === 'update' ? 'an update' : 'the installed build'} · tap to check`
            }
            onPress={() => (updates.phase === 'ready' ? applyNow() : checkNow())}
          />
          </View>

          <View style={{ gap: space.md }}>
            <Section>What stays at the computer</Section>
            <Note>
              Saving to a slot, backups, restores, firmware and raw SysEx are refused from a
              distance — by your computer, not by this app. A phone on a dark stage should not be able to
              overwrite a preset you spent a week on.
            </Note>
          </View>
          {/*
            Reachable from inside the app, which is the point of writing them.
            A store requires a privacy policy at a URL and the licences we ship
            under require their notices travel with the software; neither is
            satisfied by a file nobody can open from the thing it describes.
          */}
          <View style={{ gap: space.md }}>
            <Section>The small print</Section>
            {/* Said in the app, not only in a file somebody would have to go
                looking for. Same string as the browser — shared/affiliation.mjs. */}
            <Note>{AFFILIATION}</Note>
            <Press
              label="Privacy"
              sub="What this sends, and what it never does"
              onPress={() => Linking.openURL('https://fractal.newbold.cloud/privacy.html')}
            />
            <Press
              label="Licences"
              sub="The open-source work this is built on"
              onPress={() => Linking.openURL('https://fractal.newbold.cloud/notices.txt')}
            />
          </View>
        </>
      ) : null}
    </ScrollView>
    </EdgeBack>
  )
}

/**
 * One row of Setup: a name, one line of live status, and a way in.
 *
 * The browser's own row, in this app's materials. Each carries the one fact you
 * would have opened it to learn, so the list answers most questions without
 * anybody tapping anything.
 */
function SetupRow({ title, status, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={status ? `${title}, ${status}` : title}
      onPress={() => {
        tick()
        onPress()
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        minHeight: TAP + 8,
        paddingHorizontal: space.md,
        paddingVertical: space.md,
        borderBottomWidth: 1,
        borderBottomColor: color.rule,
        backgroundColor: pressed ? color.panelHi : 'transparent'
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: color.silk, fontSize: font.lead, fontWeight: '600' }}>{title}</Text>
        {/* Green, like the browser's: each of these is a live answer rather
            than small print, and `ok` is already what both apps use for a
            thing said in words they are sure of. */}
        {status ? (
          <Text numberOfLines={1} style={{ color: color.ok, fontSize: font.small }}>
            {status}
          </Text>
        ) : null}
      </View>
      <Text style={{ color: color.silkFaint, fontSize: font.lead }}>›</Text>
    </Pressable>
  )
}

/**
 * How big the stage tiles are.
 *
 * Five steps, the browser's own, because they are about a thumb rather than
 * about a window: Smallest is for somebody who wants the whole rig on one
 * screen and Largest for somebody playing in the dark. Kept under the same key
 * as the browser's, so a phone and a laptop on one account agree.
 */
/**
 * Stage tiles: a stepper and a tick box, the same two controls as the browser.
 *
 * "Update the mobile app's tile size screen to look like this with the +/-
 * buttons instead of the tab buttons."
 *
 * Five buttons in a wrapping row said five things at once and took two lines
 * to do it. A stepper says the one thing that matters — what it is set to
 * now — and the two ways to change it sit either side of the answer.
 *
 * FIT IS A TICK BOX UNDER IT, NOT A SIXTH STEP, because it is not a size: it
 * is the screen deciding instead of you. While it is on the stepper reads
 * "Fit to screen" and its buttons go quiet, which is the honest way to show a
 * control whose value is being overridden — greying them says "not now"
 * where hiding them would say "never".
 *
 * On out of the box. It is the right answer for everybody who has not got an
 * opinion yet, which is everybody on the first launch.
 */
function TileSize({ onScrollLock }) {
  useStored()
  const now = loadSize(sync)
  const fit = loadFit(sync, true)
  const icons = loadIcons(sync)
  const layout = loadSceneLayout(sync)
  const step = (by) => saveSize(clampSize(now + by), sync)
  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Press
          label="−"
          accessibilityLabel="Smaller tiles"
          height={TAP}
          disabled={fit || now <= 0}
          style={{ paddingHorizontal: space.lg }}
          onPress={() => step(-1)}
        />
        <Text
          style={{
            flex: 1,
            textAlign: 'center',
            color: color.silk,
            fontSize: font.lead,
            fontWeight: '700'
          }}
        >
          {fit ? 'Fit to screen' : SIZES[now]?.name || SIZES[0].name}
        </Text>
        <Press
          label="+"
          accessibilityLabel="Bigger tiles"
          height={TAP}
          disabled={fit || now >= SIZES.length - 1}
          style={{ paddingHorizontal: space.lg }}
          onPress={() => step(1)}
        />
      </View>
      <Note>
        Bigger tiles are easier to hit without looking; smaller ones fit more of the rig on screen.
        This device remembers it.
      </Note>
      <Choice
        on={fit}
        label="Fit everything on one screen"
        sub="Sizes the scenes and effects so the whole rig is on screen at once, with no scrolling. Bigger presets get smaller buttons, never under a thumb’s width. Overrides the size above while it is on."
        onPress={() => saveFit(!fit, sync)}
      />
      {/* "Is it something that could be turned on and off?" */}
      <Choice
        on={icons}
        label="Show effect pictures"
        sub="A small picture on each effect in the chain — a flame for drive, a wave for chorus — above its letters. Off leaves the letters alone."
        onPress={() => saveIcons(!icons, sync)}
      />
      {/*
        WHERE THE SCENES SIT. "Make an option in settings to select on the left
        side one, two, three, four for the scenes, and on the right side five,
        six, seven, eight, instead of them just going across like a snake."
        One choice of four, not four boxes: only one of them can be true.
      */}
      <Section>Scene layout</Section>
      {SCENE_LAYOUTS.map((l) => (
        <Choice
          key={l.id}
          role="radio"
          on={layout === l.id}
          label={l.name}
          sub={l.sub}
          onPress={() => saveSceneLayout(l.id, sync)}
        />
      ))}
      {layout === 'mine' ? <ArrangeScenes onScrollLock={onScrollLock} /> : null}
    </View>
  )
}

/**
 * ARRANGE SCENES, for "My own order".
 *
 * "And actually, can you make it so you can grab and drop the scenes wherever
 * you want them on the screen? Because that would be cool." Here rather than
 * on Play, so a mis-drag mid-song cannot happen. One order for every preset;
 * a preset with fewer scenes keeps the ones it has in the same order, and
 * gigSize mends the rest.
 */
function ArrangeScenes({ onScrollLock }) {
  const order = loadSceneOrder(sync)
  return (
    <View style={{ gap: space.md }}>
      <Section>Arrange scenes</Section>
      <Note>Tap a scene, then tap the one to swap it with. Or drag one onto another. This order is used for every preset.</Note>
      <SceneArrange order={order} onChange={(next) => saveSceneOrder(next, sync)} onScrollLock={onScrollLock} />
      <Press label="Put them back in order" onPress={() => saveSceneOrder([0, 1, 2, 3, 4, 5, 6, 7], sync)} />
    </View>
  )
}

/**
 * A tick box with a sentence under it.
 *
 * The browser has a real checkbox and this end has none, so it is drawn:
 * a square that fills when it is on, the way the one on the computer does.
 * `accessibilityRole` is checkbox rather than button, because that is what it
 * is — a screen reader should say "checked", not "selected".
 */
function Choice({ on, label, sub, onPress, role = 'checkbox' }) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ checked: !!on }}
      accessibilityLabel={label}
      onPress={() => {
        tick()
        onPress?.()
      }}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: radius.sm,
          borderWidth: on ? 0 : 1,
          borderColor: color.rule,
          backgroundColor: on ? color.signal : color.panel,
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {on ? (
          <Text style={{ color: color.onSignal, fontSize: font.body, fontWeight: '700' }}>✓</Text>
        ) : null}
      </View>
      <View style={{ flex: 1, gap: space.xs }}>
        <Text style={{ color: color.silk, fontSize: font.body }}>{label}</Text>
        <Text style={{ color: color.silkDim, fontSize: font.small, lineHeight: font.small * 1.5 }}>
          {sub}
        </Text>
      </View>
    </Pressable>
  )
}

function Section({ children }) {
  return (
    <Text
      accessibilityRole="header"
      style={{
        color: color.silkFaint,
        fontSize: font.micro,
        letterSpacing: 1.5,
        textTransform: 'uppercase'
      }}
    >
      {children}
    </Text>
  )
}

/** A heading and the rows under it — one group of Settings. */
function Group({ title, children }) {
  return (
    <View style={{ gap: space.xs }}>
      <Section>{title}</Section>
      <View style={{ gap: 0 }}>{children}</View>
    </View>
  )
}

/**
 * Who this is, at the top of Settings: the account, and whether the app is
 * the full version. Tapping it opens the Account page — signing in and out,
 * the password, unlocking or restoring a purchase.
 */
function AccountCard({ asked, email, paired, unlocked, demo, onPress }) {
  const who = !asked ? 'Checking…' : email || (paired ? 'Paired, no account' : 'Not signed in')
  const what = demo ? 'Demo' : unlocked ? 'Full version' : 'Not unlocked yet'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Account, ${who}, ${what}`}
      onPress={() => {
        tick()
        onPress()
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        padding: space.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: color.rule,
        backgroundColor: pressed ? color.panelHi : color.panel
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} ellipsizeMode="middle" style={{ color: email ? color.silk : color.signal, fontSize: font.lead, fontWeight: '600' }}>
          {who}
        </Text>
        <Text numberOfLines={1} style={{ color: color.ok, fontSize: font.small }}>
          {`${what} · v${APP_VERSION}`}
        </Text>
        {/* Said on the card, so Delete account is found from the first page
            of Settings rather than guessed at (Apple 5.1.1(v)). */}
        {email ? (
          <Text numberOfLines={1} style={{ color: color.silkDim, fontSize: font.micro }}>
            Password, sign out, delete account
          </Text>
        ) : null}
      </View>
      <Text style={{ color: color.silkFaint, fontSize: font.lead }}>›</Text>
    </Pressable>
  )
}

/**
 * Light, dark, or the handset's own setting.
 *
 * Auto first, and it is the default: a phone that already knows whether its
 * owner wants light or dark is a better guess than anything this app could
 * make, and somebody who has never thought about it gets the right answer
 * without choosing.
 */
function Appearance() {
  const [mode, setLocal] = useState(getMode())
  const LABEL = { auto: 'Auto', light: 'Light', dark: 'Dark' }
  return (
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      {MODES.map((m) => (
        <Press
          key={m}
          grow
          label={LABEL[m]}
          tone="signal"
          on={m === mode}
          height={TAP}
          onPress={() => {
            setMode(m, sync)
            setLocal(m)
          }}
        />
      ))}
    </View>
  )
}
