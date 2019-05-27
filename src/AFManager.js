function afManager() {
  const _flows = {};

  function register(asyncFlow) {
    if (asyncFlow.getName() in _flows) {
      throw Error('AsyncFlow should have a unique name');
    }

    _flows[asyncFlow.getName()] = asyncFlow;
  }

  function unregister(name) {
    delete _flows[name];
  }

  function resolve(name) {
    return _flows[name];
  }

  function unregisterAll() {
    for (let name in _flows) {
      unregister(name);
    }
  }

  function clear() {
    for (let name in _flows) {
      const flow = resolve(name);
      flow.stop();
    }
  }

  return {
    register,
    unregister,
    resolve,
    unregisterAll,
    clear
  };
}

module.exports = {
  afManager
};
