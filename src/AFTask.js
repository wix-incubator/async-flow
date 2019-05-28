class AFTask {

  constructor({func, onSuccess, onError, onErrorPolicy, mergePolicy}) {
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
    this._mergePolicy = mergePolicy;

    this.merge = this.merge.bind(this);
  }

  // noinspection JSMethodCanBeStatic
  /**
   *
   * @param task
   */
  merge(task) {
    return false;
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

  get mergePolicy() {
    return this._mergePolicy;
  }
}

module.exports = {
  AFTask
};
