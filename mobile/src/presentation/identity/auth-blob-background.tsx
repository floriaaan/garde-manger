import { useId } from 'react'
import { Animated } from 'react-native'
import { Defs, RadialGradient, Rect, Stop, Svg } from 'react-native-svg'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { useBlobDrift } from '../shared/hover.js'

const AUTH_BLOB_RANGE: [number, number] = [-20, 100]
const [BLOB_DRIFT_MIN, BLOB_DRIFT_MAX] = AUTH_BLOB_RANGE
const BLOB_DRIFT_Y = 12

/**
 * Same two soft off-center radial blobs as the dashboard's `BlobBackground`,
 * so the whole app shares one ground — including its slow `useBlobDrift`
 * movement now, for the same reason. The flat `gradientBottom` fill is its
 * own static layer, not part of the animated group, and the gradient layer
 * overhangs its box on every side — cross-wired (`left: -BLOB_DRIFT_MAX`,
 * `right: BLOB_DRIFT_MIN`), since the leftward overhang is what has to
 * absorb the *rightward* travel and vice versa — see `BlobBackground`'s
 * comment for the full reasoning and why both matter: without them the
 * moving layer's own edge is what's visible sliding in and out, not the
 * blob.
 * `top`/`bottom` set together (rather than a fixed `height`, which
 * `BlobBackground`'s band needs but this full-bleed layer doesn't) makes
 * Yoga stretch it to the screen's height plus `2 * BLOB_DRIFT_Y` on its own.
 *
 * Ids are `useId()`-generated, not hardcoded strings, because sign-in and
 * sign-up both mount this component and both live in the same `(auth)`
 * Stack navigator, which keeps prior screens in the tree (for back-swipe)
 * rather than unmounting them — two `<RadialGradient id="authBlob1">`
 * elements in one DOM collide, and `fill="url(#authBlob1)"` resolves to
 * whichever one the browser picks, which is how sign-up rendered blank.
 */
export function AuthBlobBackground({ ground, active = true }: { ground?: string; active?: boolean } = {}) {
  const palette = useSoftPalette()
  const id1 = useId()
  const id2 = useId()
  const drift = useBlobDrift({ active, rangeX: AUTH_BLOB_RANGE, amplitudeY: BLOB_DRIFT_Y, duration: 7000 })
  const groundColor = ground ?? palette.gradientBottom
  return (
    <>
      <Svg
        width="100%"
        height="100%"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}
      >
        <Rect x="0" y="0" width="100%" height="100%" fill={groundColor} />
      </Svg>
      <Animated.View
        style={{
          position: 'absolute',
          top: -BLOB_DRIFT_Y,
          bottom: -BLOB_DRIFT_Y,
          left: -BLOB_DRIFT_MAX,
          right: BLOB_DRIFT_MIN,
          pointerEvents: 'none',
          transform: drift.transform,
        }}
      >
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id={id1} cx="18%" cy="-8%" r="65%">
              <Stop offset="0" stopColor={palette.blobStrong} stopOpacity={0.85} />
              <Stop offset="0.5" stopColor={palette.blobSoft} stopOpacity={0.5} />
              <Stop offset="1" stopColor={groundColor} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id={id2} cx="92%" cy="100%" r="60%">
              <Stop offset="0" stopColor={palette.blobSoft} stopOpacity={0.7} />
              <Stop offset="1" stopColor={groundColor} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id2})`} />
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id1})`} />
        </Svg>
      </Animated.View>
    </>
  )
}
