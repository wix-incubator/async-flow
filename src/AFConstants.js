const OnErrorAction = Object.freeze({
  STOP: 0,
  PAUSE: 1,
  RETRY_FIRST: 2, // re add to head of _tasks
  RETRY_LAST: 3,  // re add to tail of _tasks
  RETRY_AFTER_PAUSE: 4,
  CONTINUE: 5     // just run next task
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

const StateProjJump = Object.freeze({
  FT: 0,
  TF: 1,
  TT: 2
});

const AFTaskState = Object.freeze({
  NONE: 0,
  WAITING: 1,
  RUNNING: 2,
  DONE: 3,
  ERROR: 4,
  CANCELED: 5
});

const AFTaskMerger = Object.freeze({
  NONE: 0,
  BASIC: 1
});

const AFTaskPriority = Object.freeze({
  HIGHEST: 0,
  HIGH: 64,
  NORMAL: 128,
  LOW: 192,
  LOWEST: 255
});

module.exports = {
  OnErrorAction,
  RunningState,
  MergingPolicy,
  StateProjJump,

  AFTaskState,
  AFTaskMerger,
  AFTaskPriority
};
