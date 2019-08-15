describe('AsyncFlow: FlowState', () => {
  const AsyncFlow = require('../src/AsyncFlow');
  const createAsyncFlow = AsyncFlow.createAsyncFlow;
  const AFTask = AsyncFlow.AFTask;

  class StatTask extends AFTask {
    constructor({symbol, flow}) {
      super({
        func: async () => {
          const state = flow.getFlowState();
          if (state[symbol] === undefined) {
            state[symbol] = 1;
          } else {
            state[symbol] += 1;
          }
          flow.setFlowState(state);
        }
      });
    }
  }

  it('Should call state listener', async (done) => {
    const flow = createAsyncFlow({name: 'flow'});

    const listener = ({state}) => {
      flow.removeStateListener(listener);
      expect(state.a).toBe(3);
      done();
    };

    flow.addStateListener((state) => state.a > 2, listener);

    flow.start();

    flow.addTask(new StatTask({symbol: 'a', flow}));
    flow.addTask(new StatTask({symbol: 'b', flow}));
    flow.addTask(new StatTask({symbol: 'c', flow}));
    flow.addTask(new StatTask({symbol: 'a', flow}));
    flow.addTask(new StatTask({symbol: 'c', flow}));
    flow.addTask(new StatTask({symbol: 'c', flow}));
    flow.addTask(new StatTask({symbol: 'a', flow}));
  });

  it('Should await for promise is resolved', async (done) => {
    const flow = createAsyncFlow({name: 'flow'});

    (async () => {
      const {state} = await flow.promiseForState((state) => state.a > 2);
      expect(state.a).toBe(3);
      done();
    })();

    flow.start();

    flow.addTask(new StatTask({symbol: 'a', flow}));
    flow.addTask(new StatTask({symbol: 'b', flow}));
    flow.addTask(new StatTask({symbol: 'c', flow}));
    flow.addTask(new StatTask({symbol: 'a', flow}));
    flow.addTask(new StatTask({symbol: 'c', flow}));
    flow.addTask(new StatTask({symbol: 'c', flow}));
    flow.addTask(new StatTask({symbol: 'a', flow}));
  });
});
