import test from 'ava'

import { MultiPromise } from '../src/index'

test('should return nothing with no tasks', async t => {
  const mp = new MultiPromise()
  const results = await mp.run()

  t.true(results instanceof Array)
  t.is(results.length, 0)
})

test('should return a single result', async t => {
  const mp = new MultiPromise()
  mp.add(task => new Promise(resolve => { resolve('foobar') })) // prettier-ignore
  const results = await mp.run()

  t.true(results instanceof Array)
  t.is(results.length, 1)
  t.deepEqual(results[0].result, ['foobar'])
})

test('should return multiple results', async t => {
  const mp = new MultiPromise()
  mp.add(task => new Promise(resolve => { resolve('foobar') })) // prettier-ignore
  mp.add(task => new Promise(resolve => { resolve('foobar2') })) // prettier-ignore
  mp.add(task => new Promise(resolve => { resolve('foobar3') })) // prettier-ignore
  const results = await mp.run()

  t.true(results instanceof Array)
  t.is(results.length, 3)
  t.deepEqual(results[2].result, ['foobar3'])
})

test('should return firstSuccess', async t => {
  const mp = new MultiPromise()
  mp.add(task => new Promise((resolve, reject) => { reject('foobar1') })) // prettier-ignore
  mp.add(task => new Promise((resolve, reject) => { resolve('foobar2') })) // prettier-ignore
  mp.add(task => new Promise((resolve, reject) => { reject('foobar3') })) // prettier-ignore
  const results = await mp.firstSuccess()

  t.true(results instanceof Array)
  t.is(results.length, 1)
  t.deepEqual(results[0].result, ['foobar2'])
})

test('should return firstError', async t => {
  const mp = new MultiPromise()
  mp.add(task => new Promise((resolve, reject) => { reject('foobar1') })) // prettier-ignore
  mp.add(task => new Promise((resolve, reject) => { resolve('foobar2') })) // prettier-ignore
  mp.add(task => new Promise((resolve, reject) => { reject('foobar3') })) // prettier-ignore
  const results = await mp.firstError()

  t.true(results instanceof Array)
  t.is(results.length, 1)
  t.deepEqual(results[0].error, 'foobar1')
})

test('should return waitForAll', async t => {
  const mp = new MultiPromise()
  mp.add(task => new Promise((resolve, reject) => { reject('foobar1') }), { id: 'group1' }) // prettier-ignore
  mp.add(task => new Promise((resolve, reject) => { reject('foobar2') }), { id: 'group1' }) // prettier-ignore
  mp.add(task => new Promise((resolve, reject) => { resolve('foobar3') }), { id: 'group2' }) // prettier-ignore
  mp.add(task => new Promise((resolve, reject) => { resolve('foobar4') }), { id: 'group2' }) // prettier-ignore
  const results = await mp.waitForAll()

  t.true(results instanceof Array)
  t.is(results.length, 4)

  t.deepEqual(results[0].id, 'group1')
  t.deepEqual(results[1].id, 'group1')
  t.deepEqual(results[2].id, 'group2')
  t.deepEqual(results[3].id, 'group2')
})
