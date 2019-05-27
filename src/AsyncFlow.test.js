describe('AsyncFlow', () => {
  const afManager = require('./AFManager').afManager();
  const createAsyncFlow = require('./AsyncFlow').createAsyncFlow;
  const RunningState = require('./AsyncFlow').RunningState;

  function createTask({action, interval, onSuccess, onError, onErrorPolicy}) {
    return {
      func: () => {
        let resolve;
        let reject;

        const promise = new Promise((res, rej) => {
          resolve = res;
          reject = rej;
        });
        setTimeout(function () {
          try {
            const result = action();
            resolve(result);
          } catch (error) {
            reject(error);
          }
        }, interval);

        return promise;
      },

      onSuccess,
      onError,
      onErrorPolicy
    };
  }

  beforeEach(() => {
    afManager.clear();
  });

  it('Should synchronize tasks', async (done) => {
    const flow = createAsyncFlow({name: 'flow'});

    let string = '';
    flow.addTask(createTask({
      action: () => {
        string += 'a'
      }, interval: 100
    }));
    flow.addTask(createTask({
      action: () => {
        string += 'b'
      }, interval: 10
    }));
    flow.addTask(createTask({
      action: () => {
        string += 'c'
      }, interval: 50, onSuccess: () => {
        expect(string).toBe('abc');
        done();
      }
    }));
    flow.start();
  });

  it('Should synchronize two flows independently', () => {

  });

  it('Should can be paused and continue', (done) => {
    const flow = createAsyncFlow({name: 'flow'});
    let string = '';
    flow.addTask(createTask({
      action: () => {
        string += 'a'
      }, interval: 100, onSuccess: () => {
        flow.pause();
        expect(flow.getRunningState()).toBe(RunningState.GOING_TO_PAUSE);
        flow.addRunningStateListener((runningState, name) => {
          expect(runningState).toBe(RunningState.PAUSED);
          flow.removeAllListeners();
          flow.start();
        });
      }
    }));
    flow.addTask(createTask({
      action: () => {
        string += 'b'
      }, interval: 10
    }));
    flow.addTask(createTask({
      action: () => {
        string += 'c'
      }, interval: 50, onSuccess: () => {
        expect(string).toBe('abc');
        done();
      }
    }));
    flow.start();
  });

  it('Should not be able to run after stop', () => {
    const flow = createAsyncFlow({name: 'flow'});
    flow.stop();
    expect(flow.start).toThrow();
  });

  it('Should call onError method on exception', (done) => {
    const flow = createAsyncFlow({name: 'flow'});
    let string = '';
    const errorMsg = 'Test Exception';
    flow.addTask(createTask({
      action: () => {
        string += 'a'
      }, interval: 100
    }));
    flow.addTask(createTask({
      action: () => {
        throw errorMsg;
      }, interval: 10, onError: (error) => {
        expect(error).toBe(errorMsg);
        done();
      }
    }));
    flow.addTask(createTask({
      action: () => {
        string += 'c'
      }, interval: 50
    }));
    flow.start();
  });

  it('Should be stopped after exception if onErrorPolicy is STOP (default)', () => {

  });

  it('Should be paused after exception if onErrorPolicy is PAUSE', () => {

  });

  it('Should retry operation immediately after exception if onErrorPolicy is RETRY_FIRST', () => {

  });

  it('Should retry operation in the end of que after exception if onErrorPolicy is RETRY_LAST', () => {

  });

});
