describe('AsyncFlow', () => {
  const afManager = require('./AFManager').afManager();
  const AsyncFlow = require('./AsyncFlow');
  const createAsyncFlow = AsyncFlow.createAsyncFlow;
  const RunningState = AsyncFlow.RunningState;
  const OnErrorPolicy = AsyncFlow.OnErrorPolicy;
  const AFTask = require('./AFTask').AFTask;

  function createTask({action, interval, onSuccess, onError, onErrorPolicy}) {
    return new AFTask({
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
    });
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

  it('Should synchronize two flows independently', (done) => {
    let string = '';

    const flow1 = createAsyncFlow({afManager, name: 'flow1'});
    flow1.addTask(createTask({
      action: () => {
        string += 'a'
      }, interval: 100
    }));
    flow1.addTask(createTask({
      action: () => {
        string += 'b'
      }, interval: 10
    }));
    flow1.addTask(createTask({
      action: () => {
        string += 'c'
      }, interval: 50, onSuccess: () => {
        expect(string).toBe('xyzabc');
        done();
      }
    }));

    const flow2 = createAsyncFlow({afManager, name: 'flow2'});
    flow2.addTask(createTask({
      action: () => {
        string += 'x'
      }, interval: 20
    }));
    flow2.addTask(createTask({
      action: () => {
        string += 'y'
      }, interval: 20
    }));
    flow2.addTask(createTask({
      action: () => {
        string += 'z'
      }, interval: 20
    }));

    flow1.start();
    flow2.start();
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
        string += 'c';
      }, interval: 50
    }));
    flow.start();
  });

  it('Should be stopped after exception if onErrorPolicy is STOP (default)', (done) => {
    const flow = createAsyncFlow({name: 'flow'});
    let string = '';
    const errorMsg = 'Test Exception';
    flow.addTask(createTask({
      action: () => {
        string += 'a';
      }, interval: 100
    }));
    flow.addTask(createTask({
      action: () => {
        throw errorMsg;
      }, interval: 10, onError: (error) => {
        flow.addRunningStateListener((runningState) => {
          expect(flow.getRunningState()).toBe(RunningState.STOPPED);
          done();
        });
      }
    }));
    flow.addTask(createTask({
      action: () => {
        string += 'c';
      }, interval: 50
    }));
    flow.start();
  });

  it('Should be paused after exception if onErrorPolicy is PAUSE', (done) => {
    const flow = createAsyncFlow({name: 'flow', onErrorPolicy: OnErrorPolicy.PAUSE});
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
        flow.addRunningStateListener((runningState) => {
          expect(flow.getRunningState()).toBe(RunningState.PAUSED);
          done();
        });
      }
    }));
    flow.addTask(createTask({
      action: () => {
        string += 'c';
      }, interval: 50
    }));
    flow.start();
  });

  it('Should retry operation immediately after exception if onErrorPolicy is RETRY_FIRST', (done) => {
    const flow = createAsyncFlow({name: 'flow', onErrorPolicy: OnErrorPolicy.RETRY_FIRST});
    let string = '';
    let step = 0;
    const errorMsg = 'Test Exception';
    flow.addTask(createTask({
      action: () => {
        string += 'a'
      }, interval: 100
    }));
    flow.addTask(createTask({
      action: () => {
        step++;
        if (step === 1) {
          throw errorMsg;
        } else {
          string += 'b';
        }
      }, interval: 10
    }));
    flow.addTask(createTask({
      action: () => {
        string += 'c';
      }, interval: 50, onSuccess: () => {
        expect(string).toBe('abc');
        done();
      }
    }));
    flow.start();
  });

  it('Should retry operation in the end of que after exception if onErrorPolicy is RETRY_LAST', (done) => {
    const flow = createAsyncFlow({name: 'flow', onErrorPolicy: OnErrorPolicy.RETRY_LAST});
    let string = '';
    let step = 0;
    const errorMsg = 'Test Exception';
    flow.addTask(createTask({
      action: () => {
        string += 'a';
      }, interval: 100
    }));
    flow.addTask(createTask({
      action: () => {
        step++;
        if (step === 1) {
          throw errorMsg;
        } else {
          string += 'b';
        }
      }, interval: 10, onSuccess: () => {
        expect(string).toBe('acb');
        done();
      }
    }));
    flow.addTask(createTask({
      action: () => {
        string += 'c';
      }, interval: 50
    }));
    flow.start();
  });

});
