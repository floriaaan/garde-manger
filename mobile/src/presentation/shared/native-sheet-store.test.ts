import { router } from 'expo-router'
import { nativeSheetStore as store } from './native-sheet-store.js'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }))

afterEach(() => {
  const sheet = store.getSnapshot()
  if (sheet) store.dismissed(sheet.session)
  jest.clearAllMocks()
})

test('updates a second step without opening another native presentation', () => {
  const owner = Symbol()
  const onClose = jest.fn()
  store.show({ owner, onClose, content: 'choisir' })
  const session = store.getSnapshot()!.session
  store.show({ owner, onClose, content: 'confirmer' })
  expect(router.push).toHaveBeenCalledTimes(1)
  expect(store.getSnapshot()).toMatchObject({ content: 'confirmer', session })
  store.dismissed(session)
  expect(onClose).toHaveBeenCalledTimes(1)
  expect(router.back).not.toHaveBeenCalled()
})

test('cancel dismisses once and the native dismissal cannot close the next sheet', () => {
  const first = { owner: Symbol(), onClose: jest.fn(), content: 'première' }
  store.show(first)
  const session = store.getSnapshot()!.session
  store.close(first.owner)
  expect(first.onClose).toHaveBeenCalledTimes(1)
  expect(router.back).toHaveBeenCalledTimes(1)
  const second = { owner: Symbol(), onClose: jest.fn(), content: 'suivante' }
  store.show(second)
  store.dismissed(session)
  expect(store.getSnapshot()?.owner).toBe(second.owner)
  expect(second.onClose).not.toHaveBeenCalled()
  store.close(first.owner)
  expect(router.back).toHaveBeenCalledTimes(1)
})
