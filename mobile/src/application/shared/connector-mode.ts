/** Kept at the app boundary so fake auth never invokes native credential UI. */
export const isFakeConnector = process.env.EXPO_PUBLIC_CONNECTOR === 'fake'
