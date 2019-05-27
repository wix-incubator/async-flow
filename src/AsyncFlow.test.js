describe('AsyncFlow', () => {
  const afManager = require('./AFManager').afManager();
  const createAsyncFlow = require('./AsyncFlow').createAsyncFlow;

  function createTask({action, interval, onSuccess, onError, onErrorPolicy}) {
    return {
      func: () => {
        let resolve;

        const promise = new Promise((r) => resolve = r);
        setTimeout(function () {
          const result = action();
          resolve(result);
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
    const flow = createAsyncFlow({afManager, name: 'flow1'});
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

  it('Should can be paused and continue', () => {

  });

  it('Should not be able to run after stop', () => {

  });

  it('Should call onError method on exception', () => {

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
