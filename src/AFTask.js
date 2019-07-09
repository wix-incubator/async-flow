const ConstantsModule = require('./AFConstants');
const AFTaskState = ConstantsModule.AFTaskState;
const AFTaskMerger = ConstantsModule.AFTaskMerger;
const AFTaskPriority = ConstantsModule.AFTaskPriority;

const UtilsModule = require('./AFUtils');

class AFTask {

  constructor({id, func, onSuccess, onError, onErrorPolicy, merger, priority}) {
    this._id = id;
    this._func = func;

    this._onSuccess = new Set();
    if (onSuccess) {
      this._onSuccess.add(onSuccess);
    }

    this._onError = new Set();
    if (onError) {
      this._onError.add(onError);
    }

    this._onErrorPolicy = onErrorPolicy;

    if (onErrorPolicy !== undefined) {
      UtilsModule.validateOnErrorPolicy(onErrorPolicy);
    }

    this._merger = merger;

    this._priority = priority !== undefined ? priority : AFTaskPriority.NORMAL;

    this._state = AFTaskState.NONE;

    this.merge = this.merge.bind(this);
    this.mergeListeners = this.mergeListeners.bind(this);
    this.isTaskEqual = this.isTaskEqual.bind(this);
    this._basicMerge = this._basicMerge.bind(this);
  }

  /**
   *
   * @param task
   */
  merge(task) {
    if (!(task instanceof AFTask)) {
      throw 'Can\'t merge not AFTask instance';
    }

    if (!this._merger || this._merger === AFTaskMerger.NONE) {
      return false;
    }

    if (this._merger === AFTaskMerger.BASIC) {
      return this._basicMerge(task);
    }

    if (typeof this._merger === 'function') {
      return this._merger(task);
    }

    return false;
  }

  // noinspection JSMethodCanBeStatic,JSUnusedLocalSymbols
  isTaskEqual(task) {
    return false;
  }

  _basicMerge(task) {
    if (this._state !== AFTaskState.WAITING) {
      return false;
    }

    if (!this.isTaskEqual(task)) {
      return false;
    }

    return this.mergeListeners(task);
  }

  mergeListeners(...tasks) {
    for (const task of tasks) {
      for (const onSuccess of task.onSuccess) {
        this.onSuccess.add(onSuccess);
      }
      for (const onError of task.onError) {
        this.onError.add(onError);
      }
    }
    return this;
  }

  get id() {
    return this._id;
  }

  get func() {
    return this._func;
  }

  get onSuccess() {
    return this._onSuccess;
  }

  get onError() {
    return this._onError;
  }

  get onErrorPolicy() {
    return this._onErrorPolicy;
  }

  isMergeable() {
    return !!this._merger && this._merger !== AFTaskMerger.NONE;
  }

  // noinspection JSUnusedGlobalSymbols
  get state() {
    return this._state;
  }

  // noinspection JSUnusedGlobalSymbols
  set state(value) {
    this._state = value;
  }

  get priority() {
    return this._priority;
  }
}

module.exports = {
  AFTask
};
