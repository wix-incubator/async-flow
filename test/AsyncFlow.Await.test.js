describe('AsyncFlow: Await', () => {
  const AsyncFlow = require('../src/AsyncFlow');
  const createAsyncFlow = AsyncFlow.createAsyncFlow;
  const AFTask = AsyncFlow.AFTask;
  const OnErrorAction = AsyncFlow.OnErrorAction;
  const MergingPolicy = AsyncFlow.MergingPolicy;
  const AFTaskMerger = AsyncFlow.AFTaskMerger;

  class Task extends AFTask {
    constructor({result, error, type, repeating}) {
      const func = async () => {
        if (error) {
          throw error;
        }

        return result;
      };

      const params = {func, merger: AFTaskMerger.BASIC};
      if (repeating) {
        params.repeatingInterval = 20;
      }

      super(params);

      this._type = type;
    }

    isTaskEqual(task) {
      return this._type === task._type;
    }
  }

  it('Should await until task is done: success', async () => {
    const flow = createAsyncFlow({name: 'flow'});
    flow.start();
    const {result} = await flow.addTask(new Task({result: 'example'}));
    expect(result).toBe('example');
  });

  it('Should await until task is done: error', async () => {
    const flow = createAsyncFlow({name: 'flow'});
    flow.start();
    const {result, error} = await flow.addTask(new Task({result: 'example', error: 'SomeError!'}));
    expect(result).toBe(undefined);
    expect(error).toBe('SomeError!');
  });

  it('Should do nothing on throwOnError if succeed', async () => {
    const flow = createAsyncFlow({name: 'flow'});
    flow.start();
    let x;
    try {
      const {result} = (await flow.addTask(new Task({result: 'example'}))).throwOnError();
      expect(result).toBe('example');
      x = 1;
    } catch (e) {
      x = 2;
    }

    expect(x).toBe(1);
  });

  it('Should throw exception on throwOnError if error occurred', async () => {
    const flow = createAsyncFlow({
      name: 'flow',
      onErrorPolicy: {action: OnErrorAction.RETRY_AFTER_PAUSE, attempts: 2, delay: 10}
    });

    flow.start();

    let promise = flow.addTask(new Task({result: 'example', error: 'SomeError!'}));
    while (promise) {
      try {
        (await promise).throwOnError();
      } catch (e) {
        expect(e.error).toBe('SomeError!');
        promise = e.promise;
      }
    }
  });

  it('Should throw exception on canceled task if flag is set on', async () => {
    const flow = createAsyncFlow({
      name: 'flow',
      onErrorPolicy: {action: OnErrorAction.RETRY_AFTER_PAUSE, attempts: 2, delay: 10}
    });

    const task = new Task({result: 'example', error: 'SomeError!'});
    let currentPromise = flow.addTask(task);
    flow.cancelTask(task);

    flow.start();

    while (currentPromise) {
      try {
        const {result, currentPromise: promise} = (await currentPromise).throwOnError({throwIfCanceled: true});
      } catch (e) {
        expect(e.canceled).toBe(true);
        currentPromise = e.promise;
        expect(currentPromise).toBeUndefined();
      }
    }
  });

  it('Should work with repeating tasks', async (done) => {
    const flow = createAsyncFlow({name: 'flow'});

    const task = new Task({result: 'example', repeating: true});
    let currentPromise = flow.addTask(task);

    flow.start();

    let i = 0;

    while (currentPromise) {
      try {
        const {result, currentPromise: promise} = (await currentPromise).throwOnError({throwIfCanceled: true});
        expect(result).toBe('example');
        i++;
        if (i === 3) {
          flow.cancelTask(task);
        }
      } catch (e) {
        currentPromise = e.promise;
        done();
      }
    }
  });

  it('Should correctly work in multiple awaits case', async () => {
    const flow = createAsyncFlow({name: 'flow', mergingPolicy: MergingPolicy.TAIL});

    let promise1 = flow.addTask(new Task({result: '1', type: 'mergingTask'}));
    let promise2 = flow.addTask(new Task({result: '2', type: 'mergingTask'}));

    expect(promise1).toEqual(promise2);

    flow.start();

    const val1 = (await promise1).result;
    const val2 = (await promise2).result;

    expect(val1).toBe('1');
    expect(val2).toBe('1'); // after merging the second task result is overridden by first one
  });

  it ('', async () => {
    let currentPromise = flow.addTask(task);
    while (currentPromise) {
      try {
        const {result, currentPromise: promise} = (await currentPromise).throwOnError({throwIfCanceled: true});
      } catch (e) {
        currentPromise = e.promise;
      }
    }

  });

});
