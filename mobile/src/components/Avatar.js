import { Image, View } from 'react-native'

import { color } from '../lib/theme'

/**
 * The account's photo in a small circle, or a person's silhouette in it when
 * there is no photo: "[People] that don't have the picture just have a
 * picture of a silhouette of a person" (Justin, 7 November 2026).
 *
 * The silhouette is drawn with three plain shapes, a round head over rounded
 * shoulders, cut off by the circle, rather than a picture: no new file in the
 * app, nothing to tint, and it is the same shape at any size. The circle is a
 * plain panel with the page's own thin edge, the same in both looks, so it
 * reads as a picture's frame on the frosted bar and on Classic's alike.
 *
 * Draws nothing a screen reader stops on: the button it sits in says what it
 * is ("Your account").
 */
export default function Avatar({ uri = null, size = 24 }) {
  const head = Math.round(size * 0.4)
  const body = Math.round(size * 0.74)
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1,
        borderColor: color.rule,
        backgroundColor: color.panelHi,
        overflow: 'hidden',
        alignItems: 'center'
      }}
    >
      {uri ? (
        <Image source={{ uri }} accessible={false} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
      ) : (
        <>
          <View style={{ marginTop: Math.round(size * 0.16), width: head, height: head, borderRadius: head / 2, backgroundColor: color.silkDim }} />
          <View
            style={{
              marginTop: Math.round(size * 0.05),
              width: body,
              height: body,
              borderTopLeftRadius: body / 2,
              borderTopRightRadius: body / 2,
              backgroundColor: color.silkDim
            }}
          />
        </>
      )}
    </View>
  )
}
