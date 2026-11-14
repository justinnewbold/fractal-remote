/*
 * TONE3000'S PAGE, INSIDE THE APP.
 *
 * "Have you built out the built-in tone 3000 into our app so you don't have
 * to go to Safari?" (Justin, 14 November 2026.) This is it: TONE3000's own
 * page (sign in, search, listen on its own players, pick) in a web view
 * over the app, with its name across the top and a Close button, the way
 * TONE3000's own example for a phone app does it (react-native/src/t3k/
 * auth.tsx in github.com/tone-3000/api). Picking a tone closes it and the
 * card under it has the tone; nothing leaves the app.
 *
 * THE WEB VIEW IS A NATIVE PIECE, so this draws nothing at all on a copy
 * built without it (lib/tone3000Parts), where the card opens the device's
 * browser as it always has. What the page may load, when it is over and
 * what is said of a failure are lib/tone3000Page's, which a test runs.
 *
 * The settings are their examples', across the three of them:
 *   - the web view's own lasting storage (the default), so a sign-in to
 *     TONE3000 is still there the next time and after the app is closed;
 *   - sound plays in the page, and on a tap with no second tap: "the
 *     hosted catalog's preview players start on a user tap";
 *   - a link that asks for a new window opens in this one;
 *   - the scheme TONE3000 sends the player back by is on the list of
 *     origins, or the web view would hand it to the phone unasked.
 *
 * On Android the phone's Back goes back a page, and closes from the first.
 */
import { useEffect, useMemo, useRef } from 'react'
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { color, font, space, TAP } from '../lib/theme'
import { ANY_WAY_UP, SAFE_EDGES } from '../lib/screenShape'
import { WebView } from '../lib/tone3000Parts'
import { pageFlow, pageOrigins, T3K_PAGE_CLOSE, T3K_PAGE_TITLE } from '../lib/tone3000Page'

const ORIGINS = pageOrigins()

/**
 * `url` is TONE3000's page to show, or null for none. Exactly one of
 * `onReturn(url)` (TONE3000 sent the player back), `onClosed()` and
 * `onFault(words, status)` is called for each page shown, once; whoever is
 * told takes `url` away.
 */
export default function Tone3000Page({ url, onReturn, onClosed, onFault }) {
  const web = useRef(null)
  const canGoBack = useRef(false)
  /* The newest of the three, without starting the page over when the card redraws. */
  const told = useRef({ onReturn, onClosed, onFault })
  told.current = { onReturn, onClosed, onFault }
  const flow = useMemo(
    () =>
      pageFlow({
        onReturn: (back) => told.current.onReturn?.(back),
        onClosed: () => told.current.onClosed?.(),
        onFault: (why, status) => told.current.onFault?.(why, status)
      }),
    [url]
  )
  useEffect(() => {
    canGoBack.current = false
  }, [url])

  if (!WebView) return null

  /* The phone's own way out: Android's Back button, or the sheet dragged away. */
  const out = () => {
    if (Platform.OS === 'android' && canGoBack.current) {
      web.current?.goBack?.()
      return
    }
    flow.close()
  }

  return (
    <Modal visible={!!url} animationType="slide" presentationStyle="fullScreen" supportedOrientations={ANY_WAY_UP} onRequestClose={out}>
      <SafeAreaView style={{ flex: 1, backgroundColor: color.chassis }} edges={SAFE_EDGES}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: space.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.rule }}>
          <Text accessibilityRole="header" style={{ color: color.silk, fontSize: font.body, fontWeight: '700', letterSpacing: 1 }}>
            {T3K_PAGE_TITLE}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${T3K_PAGE_CLOSE} ${T3K_PAGE_TITLE}`}
            onPress={() => flow.close()}
            style={{ minHeight: TAP, minWidth: TAP, paddingHorizontal: space.lg, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: color.live, fontSize: font.body, fontWeight: '600' }}>{T3K_PAGE_CLOSE}</Text>
          </Pressable>
        </View>
        {url ? (
          <WebView
            ref={web}
            source={{ uri: url }}
            originWhitelist={ORIGINS}
            onShouldStartLoadWithRequest={(request) => flow.mayLoad(request?.url)}
            onHttpError={(event) => flow.httpError(event?.nativeEvent?.statusCode, event?.nativeEvent?.url)}
            onError={(event) => flow.loadError(event?.nativeEvent?.url)}
            onNavigationStateChange={(state) => {
              canGoBack.current = !!state?.canGoBack
            }}
            startInLoadingState
            renderLoading={() => <ActivityIndicator color={color.live} style={StyleSheet.absoluteFill} />}
            setSupportMultipleWindows={false}
            javaScriptCanOpenWindowsAutomatically
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            allowsBackForwardNavigationGestures
            style={{ flex: 1, backgroundColor: color.chassis }}
          />
        ) : null}
      </SafeAreaView>
    </Modal>
  )
}
