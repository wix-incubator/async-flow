const AFTaskModule = require('./AFTask');
const AFTask = AFTaskModule.AFTask;

const AFManagerModule = require('./AFManager');
const createAFManager = AFManagerModule.createAFManager;

const ConstantsModule = require('./AFConstants');
const OnErrorAction = ConstantsModule.OnErrorAction;
const RunningState = ConstantsModule.RunningState;
const MergingPolicy = ConstantsModule.MergingPolicy;
const StateProjJump = ConstantsModule.StateProjJump;
const AFTaskState = ConstantsModule.AFTaskState;
const AFTaskMerger = ConstantsModule.AFTaskMerger;

const _ = require('lodash');

const UtilsModule = require('./AFUtils');


function createAsyncFlow({afManager, name, onErrorPolicy, mergingPolicy, initValue}) {
  const flow = asyncFlow({afManager, name, onErrorPolicy, mergingPolicy, initValue});
  if (afManager) {
    afManager.register(flow);
  }
  return flow;
}

function asyncFlow({afManager, name, onErrorPolicy, mergingPolicy, initValue}) {
  const _afManager = afManager;
  const _name = name;

  const _onErrorPolicy = onErrorPolicy !== undefined ? onErrorPolicy : {action: OnErrorAction.STOP};
  UtilsModule.validateOnErrorPolicy(_onErrorPolicy);
  UtilsModule.fixOnErrorPolicy(_onErrorPolicy);

  const _mergingPolicy = mergingPolicy !== undefined ? mergingPolicy : MergingPolicy.NONE;

  let _runningState = RunningState.PAUSED;

  const _tasks = [];

  const _runningStateListeners = new Set(); // a listener is a function: (runningState, flowName) => {}
  const _flowIsEmptyListeners = new Set();

  const _stateListenerItems = [];
  let _flowState = {};


  /*
    projStateListenerItem:

      projection
      predicate
      listener
      lastProjValue
   */
  const _stateProjListenerItems = [];

  let _timeoutTaskCount = 0;

  let _canBeStarted = true;
  let _waitingStart = false;

  let _currentValue = initValue;

  function getName() {
    return _name;
  }

  function getOnErrorPolicy() {
    return _onErrorPolicy;
  }

  function getRunningState() {
    return _runningState;
  }

  function getCurrentValue() {
    return _currentValue;
  }

  function getFlowState() {
    return _flowState;
  }

  function setFlowState(state) {
    _flowState = state;
  }

  /*
    task : AFTask | function
   */
  function addTask(task, intoHead, isDelayedTask) {
    if (_runningState === RunningState.STOPPED) {
      throw Error('Can\'t add task to stopped flow');
    }

    if (typeof task === 'function') {
      task = new AFTask({func: task});
    }

    if (!task.onErrorPolicy) {
      task.onErrorPolicy = UtilsModule.cloneOnErrorPolicy(_onErrorPolicy);
    }

    if (!task.currentPromise) {
      task.currentPromise = _createPromise();
    }

    if (isDelayedTask) {
      _timeoutTaskCount--;
    }

    if (task.state === AFTaskState.CANCELED) {
      task.currentPromise.resolve({canceled: true});
      return task.currentPromise;
    }

    if (_mergingPolicy !== MergingPolicy.NONE) {
      const mergedTask = _tryToMergeTask(task);
      if (mergedTask) {
        return mergedTask.currentPromise.promise;
      }
    }

    task.state = AFTaskState.WAITING;

    const index = _findIndexToAdd(task, intoHead);
    _tasks.splice(index, 0, task);

    if (_tasks.length === 1 && _runningState === RunningState.RUNNING) {
      _run();
    }

    return task.currentPromise.promise;
  }

  function _findIndexToAdd(task, intoHead) {
    return intoHead ? _findIndexToAddHead(task) : _findIndexToAddTail(task);
  }

  function _findIndexToAddTail(task) {
    let index = 0;

    for (let i = _tasks.length - 1; i >= 0; i--) {
      if (task.priority >= _tasks[i].priority || _tasks[i].state === AFTaskState.RUNNING) {
        index = i + 1;
        break;
      }
    }

    return index;
  }

  function _findIndexToAddHead(task) {
    let index = _tasks.length;

    for (let i = 0; i < _tasks.length; i++) {
      if (task.priority <= _tasks[i].priority && _tasks[i].state !== AFTaskState.RUNNING) {
        index = i;
        break;
      }
    }

    return index;
  }

  // TODO: maybe we need return more precise value?
  // Something like:
  //    not found
  //    can't be deleted
  //    deleted
  function cancelTask(task) {
    if (task.state === AFTaskState.RUNNING) {
      return false;
    }

    task.state = AFTaskState.CANCELED;

    for (let i = 0; i < _tasks.length; i++) {
      if (task === _tasks[i]) {
        _tasks.splice(i, 1);
        task.currentPromise.resolve({canceled: true});
        break;
      }
    }

    return true;
  }

  // predicate: (state) => {} : boolean | {result: boolean, data: object}
  function addStateListener(predicate, listener) {
    _stateListenerItems.push({
      predicate,
      listener
    });
  }

  function _removeFromArray(array, attribute, attributeValue) {
    let index = -1;
    for (let i = 0; i < array.length; i++) {
      if (array[i][attribute] === attributeValue) {
        index = i;
        break;
      }
    }

    array.splice(index, 1);
  }

  function removeStateListener(listener) {
    _removeFromArray(_stateListenerItems, 'listener', listener);
  }

  function promiseForState(predicate) {
    const {promise, resolve, reject} = _createPromise();

    _stateListenerItems.push({
      predicate,
      resolve,
      reject
    });

    return promise;
  }

  function _createPromise() {
    let resolve;
    let reject;

    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });

    return {promise, resolve, reject};
  }

  function _notifyStateListeners() {
    for (let i = 0; i < _stateListenerItems.length;) {
      const stateListenerItem = _stateListenerItems[i];
      const predicateValue = stateListenerItem.predicate(_flowState);
      if (predicateValue === true || predicateValue.result === true) {
        if (stateListenerItem.listener) {
          stateListenerItem.listener({state: _flowState, data: predicateValue.data});
          i++;
        } else {
          _stateListenerItems.splice(i, 1);
          const resolve = stateListenerItem.resolve;
          if (resolve) {
            resolve({state: _flowState, data: predicateValue.data});
          }
        }
      } else {
        i++;
      }
    }
  }

  // projection: (state) => projectionValue
  // predicate: (projectionValue) => {} : boolean | {result: boolean, data: object}
  function addStateProjListener(projection, predicate, listener, flags) {
    if (flags === undefined) {
      flags = 0;
    }

    _stateProjListenerItems.push({
      projection,
      predicate,
      listener,
      flags,
      lastProjValue: undefined,
      lastPredicateResult: false
    });
  }

  function removeStateProjListener(listener) {
    _removeFromArray(_stateProjListenerItems, 'listener', listener);
  }

  function _notifyStateProjListeners() {
    for (const item of _stateProjListenerItems) {
      const projValue = item.projection(_flowState);
      if (!_.isEqual(projValue, item.lastProjValue)) {
        item.lastProjValue = projValue;
        const predicateValue = item.predicate(projValue);
        const predicateResult = _predicateResult(predicateValue);

        const ft = !item.lastPredicateResult && predicateResult;
        const tt = (item.flags & StateProjJump.TT) && item.lastPredicateResult && predicateResult;
        const tf = (item.flags & StateProjJump.TF) && item.lastPredicateResult && !predicateResult;

        if (ft || tt || tf) {
          const jump = (ft ? StateProjJump.FT : 0) | (tt ? StateProjJump.TT : 0) | (tf ? StateProjJump.TF : 0);
          item.listener({state: _flowState, data: predicateValue.data, jump});
        }

        item.lastPredicateResult = predicateResult;
      }
    }
  }

  function _predicateResult(predicateValue) {
    return predicateValue === true || (predicateValue !== undefined && predicateValue.result === true);
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
      const result = await task.func(_currentValue);
      _currentValue = result;

      task.state = AFTaskState.DONE;

      for (const onSuccess of task.onSuccess) {
        onSuccess({result, taskId: task.id});
      }

      const nextPromise = task.isRepeating() ? _createPromise() : undefined;
      _callPromiseResolve({task, result, nextPromise});
      task.currentPromise = nextPromise;

      if (_runningState === RunningState.STOPPED) {
        return;
      }

      if (_runningState === RunningState.GOING_TO_PAUSE) {
        _setRunningState(RunningState.PAUSED);
      }

      _notifyStateListeners();
      _notifyStateProjListeners();

      _rescheduleIfNeeded(task);

      _doNext();
      _canBeStarted = true;

      if (_waitingStart) {
        _waitingStart = false;
        start();
      }
    } catch (error) {

      task.state = AFTaskState.ERROR;

      for (const onError of task.onError) {
        onError({error, taskId: task.id});
      }

      const shouldRetry = _isRetryErrorPolicy(task.onErrorPolicy) && task.onErrorPolicy.attempts > 0;
      const nextPromise = shouldRetry || task.isRepeating() ? _createPromise() : undefined;
      _callPromiseResolve({task, error, nextPromise});
      task.currentPromise = nextPromise;

      _notifyStateListeners();
      _notifyStateProjListeners();

      if (_runningState === RunningState.STOPPED) {
        return;
      }

      if (_runningState === RunningState.GOING_TO_PAUSE) {
        _setRunningState(RunningState.PAUSED);
      }

      switch (task.onErrorPolicy.action) {
        case OnErrorAction.STOP:
          _setRunningState(RunningState.STOPPED);
          if (_afManager) {
            _afManager.unregister(_name);
          }
          break;

        case OnErrorAction.PAUSE:
          _setRunningState(RunningState.PAUSED);
          break;

        case OnErrorAction.RETRY_FIRST:
        case OnErrorAction.RETRY_LAST:
        case OnErrorAction.RETRY_AFTER_PAUSE:
          _retry(task);
          break;

        case OnErrorAction.CONTINUE:
          _doNext();
          break;
      }

      _canBeStarted = true;
    }
  }

  function _isRetryErrorPolicy(errorPolicy) {
    return errorPolicy.action === OnErrorAction.RETRY_FIRST
      || errorPolicy.action === OnErrorAction.RETRY_LAST
      || errorPolicy.action === OnErrorAction.RETRY_AFTER_PAUSE;
  }

  function _callPromiseResolve({task, result, error, nextPromise}) {
    const promise = nextPromise !== undefined ? nextPromise.promise : undefined;
    let throwOnError;
    if (error) {
      throwOnError = () => {
        throw {taskId: task.id, error, promise};
      };
    } else {
      throwOnError = () => {
        return {taskId: task.id, result, promise}
      };
    }

    if (task.currentPromise) {
      task.currentPromise.resolve({
        taskId: task.id,
        result,
        error,
        promise,
        throwOnError
      });
    }
  }

  function _retry(task) {
    const errorPolicy = task.onErrorPolicy;

    if (errorPolicy.attempts !== undefined) {
      if (errorPolicy.attempts <= 0) {
        _doNext();
        return;
      }
      errorPolicy.attempts--;
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
      let delay = UtilsModule.getMaybeFuncValue(errorPolicy.delay);
      if (errorPolicy.action === OnErrorAction.RETRY_AFTER_PAUSE) {
        _setRunningState(RunningState.PAUSED);
        setTimeout(start, delay);
      } else {
        _timeoutTaskCount++;
        setTimeout(() => addTask(task, errorPolicy.action === OnErrorAction.RETRY_FIRST, true), delay);
        _doNext();
      }
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
      if (_tasks[i].isMergeable()) {
        const mergedTask = _mergeTask(i, task);
        if (mergedTask) {
          return mergedTask;
        }
      }
    }

    return false;
  }

  function _tryToMergeTail(task) {
    for (let i = _tasks.length - 1; i >= 0; i--) {
      if (_tasks[i].isMergeable()) {
        return _mergeTask(i, task);
      }
    }

    return false;
  }

  function _mergeTask(indexOfExistingTask, newTask) {
    const existingTask = _tasks[indexOfExistingTask];
    const originalPriority = existingTask.priority;
    const mergedTask = existingTask.merge(newTask);
    if (mergedTask) {
      if (mergedTask.priority === originalPriority) {
        _tasks[indexOfExistingTask] = mergedTask;
      } else {
        _tasks.splice(indexOfExistingTask, 1);
        const index = _findIndexToAdd(newTask, true);
        _tasks.splice(index, 0, newTask);
      }
      return mergedTask;
    } else {
      return false;
    }
  }

  function _rescheduleIfNeeded(task) {
    const intervalValue = task.getRepeatingInterval();
    if (intervalValue === undefined) {
      return;
    }

    _timeoutTaskCount++;
    setTimeout(() => addTask(task, false, true), intervalValue);
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
        listener({flowName: _name, result: _currentValue, hasScheduledTasks: _timeoutTaskCount > 0});
      }
    }
  }

  function hasScheduledTasks() {
    return _timeoutTaskCount > 0;
  }

  // noinspection JSUnusedGlobalSymbols
  return {
    getName,
    getOnErrorPolicy,
    getRunningState,
    getCurrentValue,

    addTask,
    cancelTask,

    start,
    stop,
    pause,

    addRunningStateListener,
    removeRunningStateListener,
    removeAllListeners,

    length,

    addFlowIsEmptyListener,
    removeFlowIsEmptyListener,

    addStateListener,
    removeStateListener,
    promiseForState,

    addStateProjListener,
    removeStateProjListener,

    getFlowState,
    setFlowState,

    hasScheduledTasks
  }
}

module.exports = {
  createAsyncFlow,
  OnErrorAction,
  RunningState,
  MergingPolicy,
  StateProjJump,

  AFTask,
  AFTaskState,
  AFTaskMerger,

  createAFManager
};
