import { EventEmitter } from 'events'

/** Enable debug output with DEBUG=multi-promise node ... */
const debug = require('debug')('multi-promise')

interface MultiPromiseTask {
  /** User chosen task id of any type */
  id?: any
  /** Numerical task index, auto-generated */
  index?: number
  /** Anonymous task function returning a promise */
  fn: (dummy?: any) => any
  /** Promise handle */
  handle?: Promise<any>
  isFinished?: boolean
  isSuccess?: boolean
  isError?: boolean
  addToResults?: boolean
  result?: any
  error?: any
}

interface MultiPromiseAddOptions {
  /** User chosen task id of any type */
  id?: MultiPromiseTask['id']
}

interface MultiPromiseStrategy {
  (task: MultiPromiseTask, tasks: [MultiPromiseTask]): boolean | undefined
}

// Strategies decide when to finish
class MultiPromiseStrategies {
  public static FirstSuccess (
    task: MultiPromiseTask,
    tasks: [MultiPromiseTask]
  ) {
    if (task.isError) task.addToResults = false
    if (task.isSuccess) return true
  }
  public static FirstError (task: MultiPromiseTask, tasks: MultiPromiseTask[]) {
    if (task.isSuccess) task.addToResults = false
    if (task.isError) return true
  }
  public static BailOnError (task: MultiPromiseTask, tasks: MultiPromiseTask[]) {
    if (task.isError) return true
  }
  public static WaitForAll (task: MultiPromiseTask, tasks: MultiPromiseTask[]) {
    const finishedCount = tasks.filter(t => t.isFinished).length
    if (finishedCount === tasks.length) return true
  }
}

export interface MultiPromiseOptions {
  timeout?: number
  returnUnfinished?: boolean
  strategyFn?: MultiPromiseStrategy
  determineSuccessFn?: Function
  transformResultFn?: Function
  cleanupFn?: Function
}

declare interface MultiPromise {
  on (
    event: 'finished',
    listener: (results: Array<MultiPromiseTask>) => void
  ): this

  emit (event: 'finished', results: Array<MultiPromiseTask>): boolean

  emit (
    event: 'progress',
    task: MultiPromiseTask,
    tasks: Array<MultiPromiseTask>
  ): boolean

  emit (event: 'timeout'): boolean
}

class MultiPromise extends EventEmitter implements MultiPromise {
  public tasks: Array<MultiPromiseTask>
  public timeout: number | null
  public returnUnfinished: boolean

  public strategyFn: MultiPromiseStrategy | null
  public determineSuccessFn: Function | null
  public transformResultFn: Function | null
  public cleanupFn: Function | null

  private isFinished: boolean
  private finishedPromise: Promise<Array<MultiPromiseTask>>

  constructor (options: MultiPromiseOptions = {}) {
    super()
    this.tasks = []
    this.timeout = options.timeout || null
    this.returnUnfinished = options.returnUnfinished || false

    this.strategyFn = options.strategyFn || null
    this.determineSuccessFn = options.determineSuccessFn || null
    this.transformResultFn = options.transformResultFn || null
    this.cleanupFn = options.cleanupFn || null

    this.isFinished = false
    this.finishedPromise = new Promise(resolve =>
      this.on('finished', result => resolve(result))
    )
  }

  public add (fn: (dummy?: any) => any, opts: MultiPromiseAddOptions = {}) {
    const task = {} as MultiPromiseTask
    task.fn = fn
    task.id = opts.id
    task.isFinished = false
    this.tasks.push(task)
    return this
  }

  public async run (strategy?: MultiPromiseStrategy) {
    if (strategy) this.strategyFn = strategy
    return this.startTasks()
  }

  public async firstSuccess () {
    return this.run(MultiPromiseStrategies.FirstSuccess)
  }

  public async firstError () {
    return this.run(MultiPromiseStrategies.FirstError)
  }

  public async bailOnError () {
    return this.run(MultiPromiseStrategies.BailOnError)
  }

  public async waitForAll () {
    return this.run(MultiPromiseStrategies.WaitForAll)
  }

  async startTasks () {
    if (!this.tasks.length) {
      debug('no tasks to run')
      this.finish()
    }
    debug('starting %i tasks', this.tasks.length)
    this.tasks.forEach((task, index) => {
      try {
        task.index = index
        task.handle = task
          .fn()
          .then((...args: [any]) => {
            this.onSuccess.apply(this, [task, ...args])
          })
          .catch((...args: [any]) => {
            this.onError.apply(this, [task, ...args])
          })
      } catch (error) {
        this.onError.apply(this, [task, error])
      }
      debug('started task #%i (%s)', index, task.id)
    })
    if (this.timeout) {
      debug('enabled global timeout of %i', this.timeout)
      setTimeout(this.onTimeout.bind(this), this.timeout)
    }
    return this.finishedPromise
  }

  private onSuccess (task: MultiPromiseTask, ...args: any[]) {
    if (this.determineSuccessFn) {
      const isError =
        this.determineSuccessFn.apply(this, [task, ...args]) === false
      if (isError) {
        throw new Error('Task not deemed succesful by determineSuccessFn')
      }
    }
    task.isSuccess = true
    this.onResult.apply(this, [task, null, ...args])
  }

  private onError (task: MultiPromiseTask, error: any) {
    task.isError = true
    this.onResult.apply(this, [task, error])
  }

  private onResult (task: MultiPromiseTask, error: any, ...args: any[]) {
    if (this.isFinished) return
    task.isFinished = true
    debug('finished task #%i (%s): %o', task.index, task.id, {
      isError: !!task.isError
    })

    let result = args.length ? args : null
    if (!error && this.transformResultFn) {
      result = this.transformResultFn.apply(this, [task, ...args])
    }

    if (error) task.error = error
    if (result) task.result = result

    task.addToResults = true

    this.emit('progress', task, this.tasks)

    if (this.strategyFn) {
      const shouldFinish = this.strategyFn.apply(this, [task, this.tasks])
      if (shouldFinish) {
        debug('current strategy whishes to finish')
        return this.finish()
      }
    }

    // Fallback to make sure we return at latest when we're done
    const allDone = MultiPromiseStrategies.WaitForAll(task, this.tasks)
    if (allDone) return this.finish()
  }

  private onTimeout () {
    debug('timeout after %i', this.timeout)
    this.emit('timeout')
    this.finish()
  }

  private finish () {
    if (this.isFinished) return
    this.isFinished = true
    if (this.cleanupFn) this.cleanupFn.apply(this, [this.tasks])

    const results = this.returnUnfinished
      ? this.tasks
      : this.tasks.filter(t => t.addToResults).filter(t => t.isFinished)

    debug('finished with %i results', results.length)
    this.emit('finished', results)
  }
}

export { MultiPromise, MultiPromiseStrategies }
