describe('AsyncFlow: TaskPriority', () => {
  const AsyncFlow = require('../src/AsyncFlow');
  const createAsyncFlow = AsyncFlow.createAsyncFlow;
  const AFTask = AsyncFlow.AFTask;

  class StatTask extends AFTask {
    constructor({symbol, priority}) {
      super({
        func: async (string) => {
          return string + symbol;
        },
        priority
      });
    }
  }

  it('Should add tasks taking priority into account', async (done) => {
    const flow = createAsyncFlow({name: 'flow', initValue: ''});

    flow.addFlowIsEmptyListener(({result}) => {
      expect(result).toBe('dacfeb');
      done();
    });

    flow.addTask(new StatTask({symbol: 'a', priority: 10}));
    flow.addTask(new StatTask({symbol: 'b', priority: 100}));
    flow.addTask(new StatTask({symbol: 'c', priority: 30}));
    flow.addTask(new StatTask({symbol: 'd', priority: 5}));
    flow.addTask(new StatTask({symbol: 'e', priority: 80}));
    flow.addTask(new StatTask({symbol: 'f', priority: 30}));

    flow.start();
  });

});
