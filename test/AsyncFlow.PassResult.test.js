describe('AsyncFlow: Pass results', () => {
  const AsyncFlow = require('../src/AsyncFlow');
  const createAsyncFlow = AsyncFlow.createAsyncFlow;
  const AFTask = AsyncFlow.AFTask;

  class SymbolTask extends AFTask {
    constructor({symbol, interval, onSuccess, onError, onErrorPolicy}) {
      const func = (string) => {
        let resolve;
        let reject;

        const promise = new Promise((res, rej) => {
          resolve = res;
          reject = rej;
        });
        setTimeout(function () {
          try {
            resolve(string + symbol);
          } catch (error) {
            reject(error);
          }
        }, interval);

        return promise;
      };

      super({func, onSuccess, onError, onErrorPolicy});

      this.symbol = symbol;
      this.interval = interval;
    }
  }

  it('Should pass result value to next task', async (done) => {
    const flow = createAsyncFlow({name: 'flow', initValue: ''});

    flow.addFlowIsEmptyListener(({result}) => {
      expect(result).toBe('abc');
      done();
    });

    flow.addTask(new SymbolTask({symbol: 'a', interval: 30}));
    flow.start();
    flow.addTask(new SymbolTask({symbol: 'b', interval: 10}));
    flow.addTask(new SymbolTask({symbol: 'c', interval: 20}));
  });

});
