describe('AsyncFlow: FlowStateProj', () => {
  const AsyncFlow = require('../src/AsyncFlow');
  const createAsyncFlow = AsyncFlow.createAsyncFlow;
  const AFTask = AsyncFlow.AFTask;

  class StatTask extends AFTask {
    constructor({symbol, flow, reset}) {
      super({
        func: async () => {
          const state = flow.getFlowState();

          if (reset === true) {
            state[symbol] = 0;
          } else if (state[symbol] === undefined) {
            state[symbol] = 1;
          } else {
            state[symbol] += 1;
          }
          flow.setFlowState(state);
        }
      });
    }
  }

  function runTasks(flow) {
    flow.start();

    flow.addTask(new StatTask({symbol: 'a', flow}));
    flow.addTask(new StatTask({symbol: 'b', flow}));
    flow.addTask(new StatTask({symbol: 'c', flow}));
    flow.addTask(new StatTask({symbol: 'a', flow}));
    flow.addTask(new StatTask({symbol: 'c', flow}));
    flow.addTask(new StatTask({symbol: 'c', flow}));
    flow.addTask(new StatTask({symbol: 'a', flow})); // (a:3, b:1, c:3)

    flow.addTask(new StatTask({symbol: 'a', flow})); // (a:4, b:1, c:3)

    flow.addTask(new StatTask({symbol: 'b', flow}));

    flow.addTask(new StatTask({symbol: 'a', flow, reset: true})); // {a:0, b:2, c:3}
    flow.addTask(new StatTask({symbol: 'a', flow}));
    flow.addTask(new StatTask({symbol: 'b', flow}));
    flow.addTask(new StatTask({symbol: 'c', flow}));
    flow.addTask(new StatTask({symbol: 'a', flow}));
    flow.addTask(new StatTask({symbol: 'c', flow}));
    flow.addTask(new StatTask({symbol: 'a', flow})); // (a:3, b:3, c:5)

  }

  it('Should call state proj listener - FT', async (done) => {
    const flow = createAsyncFlow({name: 'flow'});

    let callCounter = 0;

    const listener = ({state}) => {
      callCounter++;
      switch (callCounter) {
        case 1:
          expect(state.a).toBe(3);
          expect(state.b).toBe(1);
          expect(state.c).toBe(3);
          break;
        case 2:
          expect(state.a).toBe(3);
          expect(state.b).toBe(3);
          expect(state.c).toBe(5);
          done();
          break;
      }
    };

    flow.addStateProjListener(
      (state) => state.a,
      (a) => a > 2,
      listener);

    runTasks(flow);
  });


  it('Should call state proj listener - FT | TT', async (done) => {
    const flow = createAsyncFlow({name: 'flow'});

    let callCounter = 0;

    const listener = ({state}) => {
      callCounter++;
      switch (callCounter) {
        case 1:
          expect(state.a).toBe(3);
          expect(state.b).toBe(1);
          expect(state.c).toBe(3);
          break;
        case 2:
          expect(state.a).toBe(4);
          expect(state.b).toBe(1);
          expect(state.c).toBe(3);
          break;
        case 3:
          expect(state.a).toBe(3);
          expect(state.b).toBe(3);
          expect(state.c).toBe(5);
          done();
          break;
      }
    };

    flow.addStateProjListener(
      (state) => state.a,
      (a) => a > 2,
      listener,
      AsyncFlow.StateProjJump.TT);

    runTasks(flow);
  });

  it('Should call state proj listener - FT | TF', async (done) => {
    const flow = createAsyncFlow({name: 'flow'});

    let callCounter = 0;

    const listener = ({state}) => {
      callCounter++;
      switch (callCounter) {
        case 1:
          expect(state.a).toBe(3);
          expect(state.b).toBe(1);
          expect(state.c).toBe(3);
          break;
        case 2:
          expect(state.a).toBe(0);
          expect(state.b).toBe(2);
          expect(state.c).toBe(3);
          break;
        case 3:
          expect(state.a).toBe(3);
          expect(state.b).toBe(3);
          expect(state.c).toBe(5);
          done();
          break;
      }
    };

    flow.addStateProjListener(
      (state) => state.a,
      (a) => a > 2,
      listener,
      AsyncFlow.StateProjJump.TF);

    runTasks(flow);
  });

  it('Should call state proj listener - FT | TT | TF', async (done) => {
    const flow = createAsyncFlow({name: 'flow'});

    let callCounter = 0;

    const listener = ({state, jump}) => {
      callCounter++;
      switch (callCounter) {
        case 1:
          expect(state.a).toBe(3);
          expect(state.b).toBe(1);
          expect(state.c).toBe(3);
          expect(jump).toBe(AsyncFlow.StateProjJump.FT);
          break;
        case 2:
          expect(state.a).toBe(4);
          expect(state.b).toBe(1);
          expect(state.c).toBe(3);
          expect(jump).toBe(AsyncFlow.StateProjJump.TT);
          break;
        case 3:
          expect(state.a).toBe(0);
          expect(state.b).toBe(2);
          expect(state.c).toBe(3);
          expect(jump).toBe(AsyncFlow.StateProjJump.TF);
          break;
        case 4:
          expect(state.a).toBe(3);
          expect(state.b).toBe(3);
          expect(state.c).toBe(5);
          expect(jump).toBe(AsyncFlow.StateProjJump.FT);
          done();
          break;
      }
    };

    flow.addStateProjListener(
      (state) => state.a,
      (a) => a > 2,
      listener,
      AsyncFlow.StateProjJump.TT | AsyncFlow.StateProjJump.TF);

    runTasks(flow);
  });


});
