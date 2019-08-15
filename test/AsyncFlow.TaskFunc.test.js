describe('AsyncFlow: taskFunc', () => {
  const AsyncFlow = require('../src/AsyncFlow');
  const createAsyncFlow = AsyncFlow.createAsyncFlow;
  const AFTask = AsyncFlow.AFTask;

  class SymbolTask extends AFTask {
    constructor({symbol, interval}) {
      super({});

      this.symbol = symbol;
      this.interval = interval;
    }

    taskFunc(string) {
      let resolve;
      let reject;

      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });

      setTimeout(() => {
        try {
          resolve(string + this.symbol);
        } catch (error) {
          reject(error);
        }
      }, this.interval);

      return promise;
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
