/*
 * SIRI: THE BUILT-IN PHRASES ("Scene 3 in Fractal Remote").
 *
 * WHERE THIS FILE GOES INTO. Apple reads App Intents only from the app's own
 * target, never from a CocoaPods module like those in mobile/modules. Every file in
 * this _shared folder is linked by @bacons/apple-targets into the iPhone app as
 * well as into the watch app around it (its README, "_shared"; the
 * membershipExceptions it writes for the main target in
 * build/with-xcode-changes.js), so these intents are the iPhone app's. The
 * watch compiles the file too, and mobile/watch-ci builds the watch folder on
 * its own, which is why everything below sits inside #if os(iOS): on the watch
 * the file is empty. Siri on the watch would need phrases of its own, inside
 * the watch app.
 *
 * A THIN PIPE. This file holds only what a build has to carry and an update
 * cannot change:
 *   - the phrases, every one with the app's own name (Apple's applicationName
 *     token, so "Fractal Remote" as the app is called), and no other name for
 *     the app: no "Fractal", no "FM3" (guideline 2.5.11(ii), and Fractal
 *     Audio's letter);
 *   - the two fixed lists Siri can hear inside a phrase: scenes 1 to 8 and
 *     the kinds of pedal (Apple allows one choice from a fixed list in a
 *     phrase, never an open number, so the tempo and the preset number are
 *     asked for after the phrase);
 *   - that every command brings the app to the front;
 *   - the hand-off: each command, and when it arrived, goes to the JavaScript
 *     through FractalSiriPipe (mobile/modules/fractal-siri, where THE CONTRACT
 *     is written out), and the JavaScript's words come back for Siri.
 * Everything else is the JavaScript's (mobile/src/lib/siriPipe.js and the
 * handler that uses it), so an update can fix it: Play on screen, the
 * 1.5-second tap rule counted from `at`, Tuner off from any screen and never
 * dropped, each unit's tempo range and scene count, exactly one pedal of a
 * kind, the AM4's boost, the demo, and every word Siri says. With no answer
 * from the JavaScript within a few seconds, the pipe tells Siri "Not sent."
 * itself.
 *
 * NINE APP SHORTCUTS of Apple's ten, one kept free (songs by name, later).
 *
 * iOS 16 SAFE, ON PURPOSE. The app still installs on iOS 16.4, and Apple's
 * forums report that iOS 16 runs an app's appShortcuts even when the provider
 * is marked iOS 17 only, crashing on whatever iOS 17 code is in it (thread
 * 747409, FB13711844). So nothing here is newer than iOS 16: no spoken
 * synonyms on the lists and no short titles, both iOS 17. The one newer
 * piece, supportedModes, is a requirement only iOS 26 asks for; older systems
 * read openAppWhenRun instead.
 *
 * FROZEN BY THE BUILD. The intents' and parameters' names and the lists' raw
 * values are what a shortcut somebody builds in the Shortcuts app refers to,
 * so renaming one breaks their shortcut. Add; never rename.
 */
#if os(iOS)
import AppIntents
internal import FractalSiri

/* Hands one command to the JavaScript and turns its words into Siri's. */
private func handOff(_ command: String, number: Int? = nil, word: String? = nil) async -> IntentDialog {
  let words = await FractalSiriPipe.shared.ask(command, number: number, word: word)
  return IntentDialog("\(words)")
}

/* The scenes, as Siri hears them in "Scene 3 in Fractal Remote". */
enum SceneNumber: String, AppEnum {
  case one = "1"
  case two = "2"
  case three = "3"
  case four = "4"
  case five = "5"
  case six = "6"
  case seven = "7"
  case eight = "8"

  static let typeDisplayRepresentation: TypeDisplayRepresentation = "Scene"
  static let caseDisplayRepresentations: [SceneNumber: DisplayRepresentation] = [
    .one: "1",
    .two: "2",
    .three: "3",
    .four: "4",
    .five: "5",
    .six: "6",
    .seven: "7",
    .eight: "8"
  ]

  var number: Int { Int(rawValue) ?? 0 }
}

/* The kinds of pedal, as Siri hears them in "Delay on in Fractal Remote". Boost is an AM4 amp's. */
enum PedalKind: String, AppEnum {
  case delay
  case drive
  case reverb
  case chorus
  case flanger
  case phaser
  case tremolo
  case pitch
  case wah
  case compressor
  case filter
  case rotary
  case gate
  case boost

  static let typeDisplayRepresentation: TypeDisplayRepresentation = "Pedal"
  static let caseDisplayRepresentations: [PedalKind: DisplayRepresentation] = [
    .delay: "Delay",
    .drive: "Drive",
    .reverb: "Reverb",
    .chorus: "Chorus",
    .flanger: "Flanger",
    .phaser: "Phaser",
    .tremolo: "Tremolo",
    .pitch: "Pitch",
    .wah: "Wah",
    .compressor: "Compressor",
    .filter: "Filter",
    .rotary: "Rotary",
    .gate: "Gate",
    .boost: "Boost"
  ]
}

struct GoToSceneIntent: AppIntent {
  static let title: LocalizedStringResource = "Go to a scene"
  static let description = IntentDescription("Switches to a scene, the same as tapping its tile on the Play screen.")
  static let openAppWhenRun: Bool = true
#if compiler(>=6.2)
  @available(iOS 26.0, *)
  static var supportedModes: IntentModes { .foreground(.immediate) }
#endif

  @Parameter(title: "Scene", requestValueDialog: IntentDialog("Which scene?"))
  var scene: SceneNumber

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let dialog = await handOff("scene", number: scene.number)
    return .result(dialog: dialog)
  }
}

struct NextSongIntent: AppIntent {
  static let title: LocalizedStringResource = "Next song"
  static let description = IntentDescription("Goes to the next song, the same as the Next button on the Play screen.")
  static let openAppWhenRun: Bool = true
#if compiler(>=6.2)
  @available(iOS 26.0, *)
  static var supportedModes: IntentModes { .foreground(.immediate) }
#endif

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let dialog = await handOff("next")
    return .result(dialog: dialog)
  }
}

struct PreviousSongIntent: AppIntent {
  static let title: LocalizedStringResource = "Previous song"
  static let description = IntentDescription("Goes to the previous song, the same as the Previous button on the Play screen.")
  static let openAppWhenRun: Bool = true
#if compiler(>=6.2)
  @available(iOS 26.0, *)
  static var supportedModes: IntentModes { .foreground(.immediate) }
#endif

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let dialog = await handOff("previous")
    return .result(dialog: dialog)
  }
}

struct TunerOnIntent: AppIntent {
  static let title: LocalizedStringResource = "Tuner on"
  static let description = IntentDescription("Opens the tuner on the Play screen. The tuner mutes your rig.")
  static let openAppWhenRun: Bool = true
#if compiler(>=6.2)
  @available(iOS 26.0, *)
  static var supportedModes: IntentModes { .foreground(.immediate) }
#endif

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let dialog = await handOff("tunerOn")
    return .result(dialog: dialog)
  }
}

struct TunerOffIntent: AppIntent {
  static let title: LocalizedStringResource = "Tuner off"
  static let description = IntentDescription("Closes the tuner, which unmutes your rig.")
  static let openAppWhenRun: Bool = true
#if compiler(>=6.2)
  @available(iOS 26.0, *)
  static var supportedModes: IntentModes { .foreground(.immediate) }
#endif

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let dialog = await handOff("tunerOff")
    return .result(dialog: dialog)
  }
}

struct SetTempoIntent: AppIntent {
  static let title: LocalizedStringResource = "Set the tempo"
  static let description = IntentDescription("Sets the tempo, the same as typing it in the tempo box on the Play screen.")
  static let openAppWhenRun: Bool = true
#if compiler(>=6.2)
  @available(iOS 26.0, *)
  static var supportedModes: IntentModes { .foreground(.immediate) }
#endif

  /* 24 to 250: every unit with a tempo takes that and no more (shared/tempo.mjs UNIT_BPM). */
  @Parameter(title: "Tempo", controlStyle: .field, inclusiveRange: (24, 250), requestValueDialog: IntentDialog("What tempo?"))
  var bpm: Int

  func perform() async throws -> some IntentResult & ProvidesDialog {
    guard bpm >= 24, bpm <= 250 else {
      throw $bpm.needsValueError(IntentDialog("What tempo, from 24 to 250?"))
    }
    let dialog = await handOff("tempo", number: bpm)
    return .result(dialog: dialog)
  }
}

struct LoadPresetIntent: AppIntent {
  static let title: LocalizedStringResource = "Load a preset"
  static let description = IntentDescription("Loads a preset by the number the Play screen shows for it.")
  static let openAppWhenRun: Bool = true
#if compiler(>=6.2)
  @available(iOS 26.0, *)
  static var supportedModes: IntentModes { .foreground(.immediate) }
#endif

  @Parameter(title: "Preset number", controlStyle: .field, requestValueDialog: IntentDialog("Which preset number?"))
  var number: Int

  func perform() async throws -> some IntentResult & ProvidesDialog {
    guard number >= 0 else {
      throw $number.needsValueError(IntentDialog("Which preset number?"))
    }
    let dialog = await handOff("preset", number: number)
    return .result(dialog: dialog)
  }
}

struct PedalOnIntent: AppIntent {
  static let title: LocalizedStringResource = "Turn a pedal on"
  static let description = IntentDescription("Turns a pedal on in the preset on the Play screen. On an AM4, Boost turns the amp's boost on.")
  static let openAppWhenRun: Bool = true
#if compiler(>=6.2)
  @available(iOS 26.0, *)
  static var supportedModes: IntentModes { .foreground(.immediate) }
#endif

  @Parameter(title: "Pedal", requestValueDialog: IntentDialog("Which pedal?"))
  var pedal: PedalKind

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let dialog = await handOff("pedalOn", word: pedal.rawValue)
    return .result(dialog: dialog)
  }
}

struct PedalOffIntent: AppIntent {
  static let title: LocalizedStringResource = "Turn a pedal off"
  static let description = IntentDescription("Turns a pedal off in the preset on the Play screen. On an AM4, Boost turns the amp's boost off.")
  static let openAppWhenRun: Bool = true
#if compiler(>=6.2)
  @available(iOS 26.0, *)
  static var supportedModes: IntentModes { .foreground(.immediate) }
#endif

  @Parameter(title: "Pedal", requestValueDialog: IntentDialog("Which pedal?"))
  var pedal: PedalKind

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let dialog = await handOff("pedalOff", word: pedal.rawValue)
    return .result(dialog: dialog)
  }
}

struct FractalRemoteShortcuts: AppShortcutsProvider {
  @AppShortcutsBuilder
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: GoToSceneIntent(),
      phrases: [
        "Scene \(\.$scene) in \(.applicationName)",
        "Go to scene \(\.$scene) in \(.applicationName)",
        "\(.applicationName) scene \(\.$scene)"
      ]
    )
    AppShortcut(
      intent: NextSongIntent(),
      phrases: [
        "Next song in \(.applicationName)",
        "Go to the next song in \(.applicationName)",
        "\(.applicationName) next song"
      ]
    )
    AppShortcut(
      intent: PreviousSongIntent(),
      phrases: [
        "Previous song in \(.applicationName)",
        "Go to the previous song in \(.applicationName)",
        "\(.applicationName) previous song"
      ]
    )
    AppShortcut(
      intent: TunerOnIntent(),
      phrases: [
        "Tuner on in \(.applicationName)",
        "Open the tuner in \(.applicationName)",
        "\(.applicationName) tuner on"
      ]
    )
    AppShortcut(
      intent: TunerOffIntent(),
      phrases: [
        "Tuner off in \(.applicationName)",
        "Close the tuner in \(.applicationName)",
        "\(.applicationName) tuner off"
      ]
    )
    AppShortcut(
      intent: SetTempoIntent(),
      phrases: [
        "Set the tempo in \(.applicationName)",
        "Change the tempo in \(.applicationName)",
        "\(.applicationName) set the tempo"
      ]
    )
    AppShortcut(
      intent: LoadPresetIntent(),
      phrases: [
        "Load a preset in \(.applicationName)",
        "Change the preset in \(.applicationName)",
        "\(.applicationName) load a preset"
      ]
    )
    AppShortcut(
      intent: PedalOnIntent(),
      phrases: [
        "\(\.$pedal) on in \(.applicationName)",
        "Turn on \(\.$pedal) in \(.applicationName)",
        "Turn \(\.$pedal) on in \(.applicationName)",
        "\(.applicationName) \(\.$pedal) on"
      ]
    )
    AppShortcut(
      intent: PedalOffIntent(),
      phrases: [
        "\(\.$pedal) off in \(.applicationName)",
        "Turn off \(\.$pedal) in \(.applicationName)",
        "Turn \(\.$pedal) off in \(.applicationName)",
        "\(.applicationName) \(\.$pedal) off"
      ]
    )
  }
}
#endif
