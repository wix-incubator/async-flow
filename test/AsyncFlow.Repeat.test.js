describe('AsyncFlow: Repeat', () => {
  const AsyncFlow = require('../src/AsyncFlow');
  const createAsyncFlow = AsyncFlow.createAsyncFlow;
  const AFTask = AsyncFlow.AFTask;

  class IncTask extends AFTask {
    constructor({repeatingInterval}) {
      super({repeatingInterval});
    }

    async taskFunc(value) {
      return value + 1;
    }
  }

  it('Should repeat task until cancel', async (done) => {
    const flow = createAsyncFlow({name: 'flow', initValue: 0});
    const task = new IncTask({repeatingInterval: 20});
    flow.addFlowIsEmptyListener(({result}) => {
      if (result === 3) {
        flow.cancelTask(task);
        setTimeout(() => {
          expect(flow.hasScheduledTasks()).toBe(false);
          done();
        }, 50);
      }
    });

    flow.addTask(task);
    flow.start();
  });

});
