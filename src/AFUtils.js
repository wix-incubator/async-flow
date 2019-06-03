const ConstantsModule = require('./AFConstants');
const OnErrorAction = ConstantsModule.OnErrorAction;

function validateOnErrorPolicy(onErrorPolicy) {
  if (onErrorPolicy.action === OnErrorAction.RETRY_AFTER_PAUSE && onErrorPolicy.delay === undefined) {
    throw 'Delay should be defined for RETRY_AFTER_PAUSE error action';
  }
}

module.exports = {
  validateOnErrorPolicy
};
