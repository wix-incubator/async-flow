function createAsyncFlow({afManager, name, onErrorPolicy}) {
  const flow = asyncFlow(afManager, name, onErrorPolicy);
  if (afManager) {
    afManager.register(flow);
  }
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

  const _runningStateListeners = new Set(); // a listener is a function: (runningState, flowName) => {}

  let _canBeStarted = true;
  let _waitingStart = false;

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
        _canBeStarted = false;
        const result = await task.func();
        if (task.onSuccess !== undefined) {
          task.onSuccess(result);
        }

        if (_runningState === RunningState.STOPPED) {
          return;
        }

        if (_runningState === RunningState.GOING_TO_PAUSE) {
          _setRunningState(RunningState.PAUSED);
        }

        _doNext();
        _canBeStarted = true;

        if (_waitingStart) {
          _waitingStart = false;
          start();
        }
      } catch (error) {
        if (task.onError !== undefined) {
          task.onError(error);
        }

        if (_runningState === RunningState.STOPPED) {
          return;
        }

        if (_runningState === RunningState.GOING_TO_PAUSE) {
          _setRunningState(RunningState.PAUSED);
        }

        const errorPolicy = task.onErrorPolicy !== undefined ? task.onErrorPolicy : _onErrorPolicy;
        switch (errorPolicy) {
          case OnErrorPolicy.STOP:
            _setRunningState(RunningState.STOPPED);
            if (_afManager) {
              _afManager.unregister(_name);
            }
            break;
          case OnErrorPolicy.PAUSE:
            _setRunningState(RunningState.PAUSED);
            break;
          case OnErrorPolicy.RETRY_FIRST:
            _run();
            break;
          case OnErrorPolicy.RETRY_LAST:
            addTask(task);
            _doNext();
            break;
        }

        _canBeStarted = true;
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
    if (!_canBeStarted) {
      _waitingStart = true;
      return;
    }

    if (_runningState === RunningState.STOPPED) {
      throw Error('Stopped flow can\'t be restarted');
    }

    const lastState = _runningState;
    _setRunningState(RunningState.RUNNING);

    if (lastState === RunningState.PAUSED) {
      _run();
    }
  }

  function stop() {
    _waitingStart = false;
    _setRunningState(RunningState.STOPPED);
    if (_afManager) {
      _afManager.unregister(_name);
    }
  }

  function pause() {
    if (_runningState === RunningState.STOPPED) {
      throw Error('Stopped flow can\'t be paused');
    }

    _waitingStart = false;
    if (_runningState === RunningState.RUNNING) {
      if (_tasks.length === 0) {
        _setRunningState(RunningState.PAUSED);
      } else {
        _setRunningState(RunningState.GOING_TO_PAUSE);
      }
    }
  }

  function _setRunningState(runningState) {
    if (runningState !== _runningState) {
      _runningState = runningState;
      for (let listener of _runningStateListeners) {
        listener(_runningState, _name);
      }
    }
  }

  function addRunningStateListener(listener) {
    _runningStateListeners.add(listener);
  }

  function removeRunningStateListener(listener) {
    _runningStateListeners.delete(listener);
  }

  function removeAllListeners() {
    _runningStateListeners.clear();
  }

  return {
    getName,
    getOnErrorPolicy,
    getRunningState,

    addTask,

    start,
    stop,
    pause,

    addRunningStateListener,
    removeRunningStateListener,
    removeAllListeners
  }
}

module.exports = {
  createAsyncFlow,
  OnErrorPolicy,
  RunningState
};
