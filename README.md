# async-flow

**async-flow** is an easy to use js module organizing multiple async tasks 
in a queue to run them consistently, one in a time. It provides API to
manage running state of queue, pass values from task to next task in queue,
handle errors, automatically rerun task if it needed, merge a new added
task to existing one and so on.

## Simplest example

```javascript
// first of all we create flow 
// it is in the PAUSED state just after creation
// and should be started by start() call.

const flow = createAsyncFlow({name: 'example'});
flow.addTask(new AFTask({func: yourAsyncFunc1}));
flow.addTask(new AFTask({func: yourAsyncFunc2}));
flow.addTask(new AFTask({func: yourAsyncFunc3}));
flow.start();

// a new task can be added to the end of flow at every time 
// and in every point of application 

flow.addTask(new AFTask({func: yourAsyncFunc4}));
```

## It is possible to use result of one task in the next one

Every task function receives as a parameter a last successfully 
evaluated result of previous tasks. A first task in the flow 
receives as a parameter initValue that passed to createAsyncFlow() 
function.

```javascript
class SymbolTask extends AFTask {
  constructor({symbol}) {
    super({func: async (string) => {
      return string + symbol;
    }});
  }
}

const flow = createAsyncFlow({name: 'pass', initValue: ''});
flow.start();
flow.addTask(new SymbolTask('a'));
flow.addTask(new SymbolTask('b'));
flow.addTask(new SymbolTask('c'));

// after all these tasks are done, a current value of flow is 'abc'
console.log(flow.getCurrentValue());
``` 

## How to listen all tasks are done

It can be added and removed a listener to get callback when flow is empty 
(i.e. all tasks have been done).
For that purpose AsyncFlow provides methods 
*addFlowIsEmptyListener()* and *removeFlowIsEmptyListener()*.

```javascript
flow.addFlowIsEmptyListener(({result, hasScheduledTasks}) => {
  if (!hasScheduledTasks) {
    // Do something
  }
});
```

In this example *result* is a current value of flow,
while *hasScheduleTasks* is a boolean that set to true if there are tasks
scheduled to be re-added into queue after some error.

## onSuccess & onError callbacks

It can be easily imagine that you want to do something if some task finished 
successfully and something else in the case of error (i.e. execption).
That is why you can pass to constructor of AFTask *onSuccess* and *onError* 
callbacks, for example

```javascript
function onTaskSuccess({result, taskId}) {
  
}

function onTaskError({error, taskId}) {
  
}

flow.addTask(new AFTask({
  func: myFunc,
  id: 'myTask', 
  onSuccess: onTaskSuccess, 
  onError: onTaskError
}))
```

## RunningState

Just after creation a flow is in the RunningState.PAUSED that means 
no any task is running. You can use method *start()* to run flow,
method *pause()* to return it back to PAUSED state, method *stop()* to stop 
a flow completely. 

After *stop()* is called a flow can't be rerun and throws exception on
any attempts to change its state.

The current running state can be found with *getRunningState()* method,
that returns one of RunningState values:

```javascript
const RunningState = Object.freeze({
  PAUSED: 0,
  RUNNING: 1,
  STOPPED: 2,
  GOING_TO_PAUSE: 3
});
```

## Errors handling

By default a flow interrupts its work by going to STOPPED state in the case 
of exception thrown in the currently working task.

But default behaviour can be changed using *onErrorPolicy* parameter. Please
note that such a parameter can be passed to *createAsyncFlow()* function 
as well as to constructor of AFTask. If both of them defined a task policy 
has priority over flow policy.

OnErrorPolicy object has a form:

```javascript
{
  action: OnErrorAction,
  attempts: number,
  delay: number | function    
}
```

where **action** is mandatory and can be

```javascript
const OnErrorAction = Object.freeze({
  STOP: 0,              // flow will be stopped after exception 
  
  PAUSE: 1,             // flow will be paused after exception
  
  RETRY_FIRST: 2,       // flow will rerun a task that thrown exception, 
                        // a task will be re-added into flow head
                        
  RETRY_LAST: 3,        // flow will rerun a task that thrown exception, 
                        // a task will be re-added into flow tail
                        
  RETRY_AFTER_PAUSE: 4, // flow will be paused for a delay ms, 
                        // and after that rerun a task
  
  CONTINUE: 5           // flow just continue to run a next task    
});

```

**attempts** (max attempts counter) is optional and by default is 1,

**delay** (delay in ms to rerun a task after exception) is also optional
and makes sense for RETRY actions only. If it's absent it means that flow
will retry immediately. 

In the current implementation of RETRY actions a flow will be stopped if
all retry attempts are not succeed.

Here is a simple example:

```javascript
let delay = 100;
const flow = createAsyncFlow({
  name: 'flow',
  initValue: '',
  onErrorPolicy: {
    action: OnErrorAction.RETRY_AFTER_PAUSE, attempts: 3, delay: () => {
      delay *= 2;
      return delay;
    }
  }
});

``` 

## Tasks merging



## AFManager
