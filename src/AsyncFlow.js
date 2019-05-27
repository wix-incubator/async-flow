function createAsyncFlow({afManager, name, onErrorPolicy}) {
  const flow = asyncFlow(afManager, name, onErrorPolicy);
  afManager.register(flow);
  return flow;
}

const OnErrorPolicy = Object.freeze({
  STOP: 1,
  PAUSE: 2,
  RETRY_FIRST: 3, // re add to head of _tasks
  RETRY_LAST: 4 // re add to tail of _tasks
});

const RunningState = Object.freeze({
  PAUSED: 1,
  RUNNING: 2,
  STOPPED: 3,
  GOING_TO_PAUSE: 4
});

function asyncFlow(afManager, name, onErrorPolicy) {
  const _afManager = afManager;
  const _name = name;
  const _onErrorPolicy = onErrorPolicy !== undefined ? onErrorPolicy : OnErrorPolicy.STOP;

  let _runningState = RunningState.PAUSED;

  const _tasks = [];

  function getName() {
    return _name;
  }

  function getOnErrorPolicy() {
    return _onErrorPolicy;
  }

  function getRunningState() {
    return _runningState;
  }

  /*
    task : {
      func,
      [onSuccess,]
      [onError,]
      [onErrorPolicy]
    }
   */
  function addTask(task) {
    if (_runningState === RunningState.STOPPED) {
      throw Error('Can\'t add task to stopped flow');
    }

    _tasks.push(async () => {

      try {
        const result = await task.func();
        if (task.onSuccess !== undefined) {
          task.onSuccess(result);
        }

        if (_runningState === RunningState.STOPPED) {
          return;
        }

        if (_runningState === RunningState.GOING_TO_PAUSE) {
          _runningState = RunningState.PAUSED;
        }

        _doNext();

      } catch (error) {
        if (task.onError !== undefined) {
          task.onError(error);
        }

        if (_runningState === RunningState.STOPPED) {
          return;
        }

        if (_runningState === RunningState.GOING_TO_PAUSE) {
          _runningState = RunningState.PAUSED;
        }

        const errorPolicy = task.onErrorPolicy !== undefined ? task.onErrorPolicy : _onErrorPolicy;
        switch (errorPolicy) {
          case OnErrorPolicy.STOP:
            _runningState = RunningState.STOPPED;
            if (_afManager) {
              _afManager.unregister(_name);
            }
            break;
          case OnErrorPolicy.PAUSE:
            _runningState = RunningState.PAUSED;
            break;
          case OnErrorPolicy.RETRY_FIRST:
            _run();
            break;
          case OnErrorPolicy.RETRY_LAST:
            addTask(task);
            _doNext();
            break;
        }
      }

    });

    if (_tasks.length === 1 && _runningState === RunningState.RUNNING) {
      _run();
    }
  }

  function _doNext() {
    _tasks.shift();
    _run();
  }

  function _run() {
    if (_tasks.length > 0 && _runningState === RunningState.RUNNING) {
      _tasks[0]();
    }
  }

  function start() {
    if (_runningState === RunningState.STOPPED) {
      throw Error('Stopped flow can\'t be restarted');
    }

    const lastState = _runningState;
    _runningState = RunningState.RUNNING;

    if (lastState === RunningState.PAUSED) {
      _run();
    }
  }

  function stop() {
    _runningState = RunningState.STOPPED;
    if (_afManager) {
      _afManager.unregister(_name);
    }
  }

  function pause() {
    if (_runningState === RunningState.STOPPED) {
      throw Error('Stopped flow can\'t be paused');
    }

    if (_runningState === RunningState.RUNNING) {
      if (tasks.length === 0) {
        _runningState = RunningState.PAUSED;
      } else {
        _runningState = RunningState.GOING_TO_PAUSE;
      }
    }
  }

  return {
    getName,
    getOnErrorPolicy,
    getRunningState,

    addTask,

    start,
    stop,
    pause
  }
}

module.exports = {
  createAsyncFlow,
  OnErrorPolicy,
  RunningState
};
