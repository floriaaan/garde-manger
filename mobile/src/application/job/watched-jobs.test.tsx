import { render } from '@testing-library/react-native'
import { isJobWatched, useWatchJob } from './watched-jobs.js'

function Watcher({ id }: { id?: string }) {
  useWatchJob(id)
  return null
}

test('a job is watched while a screen shows it, and only then', async () => {
  const view = await render(<Watcher id="job-1" />)
  expect(isJobWatched('job-1')).toBe(true)

  await view.unmount()
  expect(isJobWatched('job-1')).toBe(false)
})
