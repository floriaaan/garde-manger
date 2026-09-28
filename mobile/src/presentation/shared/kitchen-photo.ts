/**
 * The pre-auth funnel's photos. `KITCHEN_PHOTO` (singular) is the one
 * sign-in/sign-up's `AuthPhotoBackground` uses — a single, static ground.
 * `KITCHEN_PHOTOS` is the fuller set the welcome screen cross-fades
 * through; its first entry is the same photo, so a device that never
 * advances past slide one (Reduce Motion, or just bad luck on timing) still
 * shows the exact image the auth screens carry forward, keeping the "one
 * continuous moment" claim true even in that case.
 *
 * All three: Unsplash License (free for commercial use, no attribution
 * required). Photos are bundled so this screen works offline and makes no
 * direct request to an external service.
 */
export const KITCHEN_PHOTOS = [
  // Kelly Moon — a kitchen window, sun through the blinds. unsplash.com/photos/FH1t3LsPg5c
  require('../../../assets/images/kitchen-window.jpg'),
  // Marisol Benitez — a warm pile of fresh vegetables. unsplash.com/photos/QvkAQTNj4zk
  require('../../../assets/images/fresh-vegetables.jpg'),
  // Linus Belanger — morning light over a kitchen sink. unsplash.com/photos/siZbxDGY2mA
  require('../../../assets/images/kitchen-sink.jpg'),
]

export const KITCHEN_PHOTO = KITCHEN_PHOTOS[0]
