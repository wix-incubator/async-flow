const ConstantsModule = require('./AFConstants');
const OnErrorAction = ConstantsModule.OnErrorAction;

function validateOnErrorPolicy(onErrorPolicy) {
  if (onErrorPolicy.action === OnErrorAction.RETRY_AFTER_PAUSE && onErrorPolicy.delay === undefined) {
    throw 'Delay should be defined for RETRY_AFTER_PAUSE error action';
  }
}

function fixOnErrorPolicy(onErrorPolicy) {
  if (isRetryingPolicy(onErrorPolicy) && onErrorPolicy.attempts === undefined) {
    onErrorPolicy.attempts = 1;
  }
}

function cloneOnErrorPolicy(onErrorPolicy) {
  return {...onErrorPolicy};
}

function isRetryingPolicy(onErrorPolicy) {
  return onErrorPolicy.action === OnErrorAction.RETRY_FIRST
    || onErrorPolicy.action === OnErrorAction.RETRY_LAST
    || onErrorPolicy.action === OnErrorAction.RETRY_AFTER_PAUSE;
}

function getMaybeFuncValue(value) {
  return typeof value === 'function' ? value() : value;
}

module.exports = {
  validateOnErrorPolicy,
  getMaybeFuncValue,
  isRetryingPolicy,
  cloneOnErrorPolicy,
  fixOnErrorPolicy
};
