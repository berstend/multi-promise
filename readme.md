# multi-promise

> Run multiple promises in parallel with a strategy

## Motivation

Assume you want to run multiple promises in parallel, how would you go about it?

There's `Promise.all` but this will bail out on the first error, which might not be what you want.

In case you're only interested in one of the results you could consider `Promise.race`, but you can't choose if you want a fulfilled or rejected promise.

To add another requirement to the mix: How about canceling all other promises when one is finished?

`MultiPromise` is a higher level abstraction that makes handling a bunch of promises more fun to work with.

## Features

- Run multiple promises in parallel with a custom strategy
  - Built in: `firstSuccess`, `firstError`, `waitForAll`, `bailOnError`
- Optional: `determineSuccessFn` to check if fulfilled promises are really a success
- Optional: `transformResultFn` to return exactly the result you need
- Optional: `cleanupFn` to cancel/abort other promises
- Optional: `timeout` to define a global timeout for all tasks
- Optional: Add an `id` to each task to make later business logic easier
- Generic: Use any kind of promises (no assumptions are being made)
- Written in Typescript but works with JS (Node, Browser) as well
- Lightweight, fast, no dependencies

## Installation

`yarn add multi-promise`

or

`npm install --save multi-promise`

## Usage

```typescript
// TypeScript
import { MultiPromise } from 'multi-promise'

// ES6 JavaScript
import { MultiPromise } from 'multi-promise'

// Legacy JavaScript
const MultiPromise = require('multi-promise').MultiPromise
```

## Example

Let's say you want to issue 5 requests in parallel and get the first successful result. You also want some say in what success means, as a non-rejected promise (e.g. statusCode 200) could still mean failure in your business logic. Once a successful request has been made all other running requests should be aborted (no one likes sockets being kept open, right?)

```es6
const { MultiPromise } = require('multi-promise')
const rp = require('request-promise')

// define defaults for the request library
const rpx = rp.defaults({
  timeout: 20 * 1000,
  resolveWithFullResponse: true,
  time: true,
  simple: false,
  json: true
})

async function main() {
  const mp = new MultiPromise()

  // add tasks with an optional id
  // note the use of a wrapper function to not prematurely run the promises
  mp.add(task => rpx({ uri: 'https://invalid.ripe' }), { id: 'ripe' })
  mp.add(task => rpx({ uri: 'https://invalid2.ripe' }))
  mp.add(task => rpx({ uri: 'https://httpbin.org/delay/3' }), { id: 'foobar1' })
  mp.add(task => rpx({ uri: 'https://example.com' }), { id: 'example' })
  mp.add(task => rpx({ uri: 'https://httpbin.org/delay/9' }), { id: 'foobar2' })

  // optional: specify a success callback to conditionally reject promises
  // the example.com request will succeed first, but we don't like it :-)
  // we can either throw or return false here to reject a fulfilled promise
  mp.determineSuccessFn = (task, response) => {
    if (response.body.toString().includes('example'))
      throw new Error('Example is bad')
  }

  // optional: transform the result property of a fulfilled promise
  // the first argument is always the task itself,
  // the following arguments are specific to your promises
  mp.transformResultFn = (task, response) => ({
    statusCode: response.statusCode,
    headers: response.headers,
    body: response.body
  })

  // optional: clean up once we're finished
  // in this case we call `.cancel()` on the request promise
  // for all requests that are not finished yet (this will release the sockets)
  mp.cleanupFn = tasks => {
    tasks.filter(task => !task.isFinished).forEach(task => { task.handle.cancel()) })
  }

  // run all promises in parallel with a strategy
  // in this case return the first successful promise
  const results = await mp.firstSuccess()
  console.log(results)
  // => [ { id: 'foobar1', result: { statusCode: 200, headers: [Object], body: [Object] } } ]
}
main()
```

## Strategies

##### .firstSuccess()

Return first successful promise, don't mind erroneous ones

##### .firstError()

Return first erroneous promise, ignore successful ones

##### .waitForAll() (`default`)

Return all promises, don't stop on errors

##### .bailOnError()

Stop on erroneous promises (`Promise.all` behaviour)

## Debug

```bash
DEBUG=multi-promise node ...
```

## License

MIT
