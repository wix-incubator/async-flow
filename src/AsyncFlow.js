const AFTaskModule = require('./AFTask');
const AFTask = AFTaskModule.AFTask;
const AFTaskState = AFTaskModule.AFTaskState;
const AFTaskMerger = AFTaskModule.AFTaskMerger;

const AFManagerModule = require('./AFManager');
const createAFManager = AFManagerModule.createAFManager;

function createAsyncFlow({afManager, name, onErrorPolicy, mergingPolicy, initValue}) {
  const flow = asyncFlow({afManager, name, onErrorPolicy, mergingPolicy, initValue});
  if (afManager) {
    afManager.register(flow);
  }
  return flow;
}

const OnErrorAction = Object.freeze({
  STOP: 0,
  PAUSE: 1,
  RETRY_FIRST: 2, // re add to head of _tasks
  RETRY_LAST: 3,  // re add to tail of _tasks
  CONTINUE: 4     // just run next task
});

const RunningState = Object.freeze({
  PAUSED: 0,
  RUNNING: 1,
  STOPPED: 2,
  GOING_TO_PAUSE: 3
});

const MergingPolicy = Object.freeze({
  NONE: 0,
  HEAD: 1,
  TAIL: 2
});

function asyncFlow({afManager, name, onErrorPolicy, mergingPolicy, initValue}) {
  const _afManager = afManager;
  const _name = name;
  const _onErrorPolicy = onErrorPolicy !== undefined ? onErrorPolicy : {action: OnErrorAction.STOP};
  const _mergingPolicy = mergingPolicy !== undefined ? mergingPolicy : MergingPolicy.NONE;

  let _runningState = RunningState.PAUSED;

  const _tasks = [];

  const _runningStateListeners = new Set(); // a listener is a function: (runningState, flowName) => {}
  const _flowIsEmptyListeners = new Set();

  let _canBeStarted = true;
  let _waitingStart = false;

  let _lastResult = initValue;

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
    task : AFTask
   */
  function addTask(task, intoHead) {
    if (_runningState === RunningState.STOPPED) {
      throw Error('Can\'t add task to stopped flow');
    }

    if (_mergingPolicy !== MergingPolicy.NONE && _tryToMergeTask(task)) {
      return;
    }

    task.state = AFTaskState.WAITING;

    if (intoHead) {
      if (_tasks.length === 0) {
        _tasks.push(task);
      } else {
        _tasks.splice(1, 0, task);
      }
    } else {
      _tasks.push(task);
    }

    if (_tasks.length === 1 && _runningState === RunningState.RUNNING) {
      _run();
    }
  }

  function _doNext() {
    _tasks.shift();
    _notifyFlowIsEmptyListenersIfNeeded();
    _run();
  }

  function _run() {
    if (_tasks.length > 0 && _runningState === RunningState.RUNNING) {
      // noinspection JSIgnoredPromiseFromCall
      _runTask(_tasks[0]);
    }
  }

  async function _runTask(task) {
    try {
      task.state = AFTaskState.RUNNING;

      _canBeStarted = false;
      const result = await task.func(_lastResult);
      _lastResult = result;

      task.state = AFTaskState.DONE;

      for (const onSuccess of task.onSuccess) {
        onSuccess(result);
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

      task.state = AFTaskState.ERROR;

      for (const onError of task.onError) {
        onError(error);
      }

      if (_runningState === RunningState.STOPPED) {
        return;
      }

      if (_runningState === RunningState.GOING_TO_PAUSE) {
        _setRunningState(RunningState.PAUSED);
      }

      const errorPolicy = task.onErrorPolicy !== undefined ? task.onErrorPolicy : _onErrorPolicy;
      switch (errorPolicy.action) {
        case OnErrorAction.STOP:
          _setRunningState(RunningState.STOPPED);
          if (_afManager) {
            _afManager.unregister(_name);
          }
          break;

        case OnErrorAction.PAUSE:
          _setRunningState(RunningState.PAUSED);
          break;
        // case OnErrorAction.RETRY_FIRST:
        //   _run();
        //   break;
        // case OnErrorAction.RETRY_LAST:
        //   addTask(task);
        //   _doNext();
        //   break;

        case OnErrorAction.RETRY_FIRST:
        case OnErrorAction.RETRY_LAST:
          _retry(task, errorPolicy);
          break;

        case OnErrorAction.CONTINUE:
          _doNext();
          break;
      }

      _canBeStarted = true;
    }
  }

  function _retry(task, errorPolicy) {
    if (errorPolicy.attempts !== undefined) {
      if (errorPolicy.attempts <= 0) {
        _doNext();
      } else {
        errorPolicy.attempts--;
      }
    }

    if (errorPolicy.delay === undefined) {
      switch (errorPolicy.action) {
        case OnErrorAction.RETRY_FIRST:
          _run();
          break;
        case OnErrorAction.RETRY_LAST:
          addTask(task);
          _doNext();
          break;
      }
    } else {
      let delay = typeof errorPolicy.delay === 'function' ? errorPolicy.delay() : errorPolicy.delay;
      setTimeout(() => addTask(task, errorPolicy.action === OnErrorAction.RETRY_FIRST), delay);
      _doNext();
    }
  }

  function _tryToMergeTask(task) {
    if (!task.isMergeable()) {
      return false;
    }

    switch (_mergingPolicy) {
      case MergingPolicy.HEAD:
        return _tryToMergeHead(task);
      case MergingPolicy.TAIL:
        return _tryToMergeTail(task);
    }

  }

  function _tryToMergeHead(task) {
    for (let i = 0; i < _tasks.length; i++) {
      const t = _tasks[i];
      if (t.isMergeable()) {
        const mergedTask = t.merge(task);
        if (mergedTask) {
          _tasks[i] = mergedTask;
          return true;
        }
      }
    }

    return false;
  }

  function _tryToMergeTail(task) {
    for (let i = _tasks.length - 1; i >= 0; i--) {
      const t = _tasks[i];
      if (t.isMergeable()) {
        const mergedTask = t.merge(task);
        if (mergedTask) {
          _tasks[i] = mergedTask;
          return true;
        } else {
          return false;
        }
      }
    }

    return false;
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
      for (const listener of _runningStateListeners) {
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
    _flowIsEmptyListeners.clear();
  }

  function length() {
    return _tasks.length;
  }

  function addFlowIsEmptyListener(listener) {
    _flowIsEmptyListeners.add(listener);
  }

  function removeFlowIsEmptyListener(listener) {
    _flowIsEmptyListeners.delete(listener);
  }

  function _notifyFlowIsEmptyListenersIfNeeded() {
    if (_tasks.length === 0 && !_waitingStart) {
      for (const listener of _flowIsEmptyListeners) {
        listener({flowName: _name, result: _lastResult});
      }
    }
  }

  // noinspection JSUnusedGlobalSymbols
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
    removeAllListeners,

    length,

    addFlowIsEmptyListener,
    removeFlowIsEmptyListener
  }
}

module.exports = {
  createAsyncFlow,
  OnErrorAction,
  RunningState,
  MergingPolicy,

  AFTask,
  AFTaskState,
  AFTaskMerger,

  createAFManager
};
