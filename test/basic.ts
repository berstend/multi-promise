import test from 'ava'

import { MultiPromise } from '../src/index'

test('is class', t => {
  t.is(typeof MultiPromise, 'function')
})

test('should have the basic class members', async t => {
  const instance = new MultiPromise()

  t.true(instance.add instanceof Function)
  t.true(instance.waitForAll instanceof Function)
  t.true(instance.firstSuccess instanceof Function)
  t.true(instance.firstError instanceof Function)
  t.true(instance.bailOnError instanceof Function)
})
