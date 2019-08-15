describe('AsyncFlow: TaskPriority', () => {
  const AsyncFlow = require('../src/AsyncFlow');
  const createAsyncFlow = AsyncFlow.createAsyncFlow;
  const AFTask = AsyncFlow.AFTask;
  const MergingPolicy = AsyncFlow.MergingPolicy
  const AFTaskMerger = AsyncFlow.AFTaskMerger;

  class SymbolTask extends AFTask {
    constructor({symbol, priority, merge}) {
      super({
        func: async (string) => {
          return string + symbol;
        },
        priority,
        merger: merge ? AFTaskMerger.BASIC : AFTaskMerger.NONE
      });

      this.symbol = symbol;
    }

    isTaskEqual(task) {
      return this.symbol === task.symbol;
    }
  }

  it('Should add tasks taking priority into account', async (done) => {
    const flow = createAsyncFlow({name: 'flow', initValue: ''});

    flow.addFlowIsEmptyListener(({result}) => {
      expect(result).toBe('dacfeb');
      done();
    });

    flow.addTask(new SymbolTask({symbol: 'a', priority: 10}));
    flow.addTask(new SymbolTask({symbol: 'b', priority: 100}));
    flow.addTask(new SymbolTask({symbol: 'c', priority: 30}));
    flow.addTask(new SymbolTask({symbol: 'd', priority: 5}));
    flow.addTask(new SymbolTask({symbol: 'e', priority: 80}));
    flow.addTask(new SymbolTask({symbol: 'f', priority: 30}));

    flow.start();
  });

  it('Should merge tasks using priority', async (done) => {
    const flow = createAsyncFlow({name: 'flow', initValue: '', mergingPolicy: MergingPolicy.HEAD});

    flow.addFlowIsEmptyListener(({result}) => {
      expect(result).toBe('dabcf');
      done();
    });

    flow.addTask(new SymbolTask({symbol: 'a', priority: 10, merge: true}));
    flow.addTask(new SymbolTask({symbol: 'b', priority: 100, merge: true}));
    flow.addTask(new SymbolTask({symbol: 'c', priority: 30, merge: true}));
    flow.addTask(new SymbolTask({symbol: 'd', priority: 5, merge: true}));
    flow.addTask(new SymbolTask({symbol: 'b', priority: 20, merge: true}));
    flow.addTask(new SymbolTask({symbol: 'f', priority: 30, merge: true}));

    flow.start();
  });
});
