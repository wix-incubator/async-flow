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
flow.start();

// a new task can be added to the end of flow at every time 
// and in every point of application 

flow.addTask(new AFTask({func: yourAsyncFunc3}));

// if you don't want to customize task by passing onSuccess, onError
// callbacks, onErrorPolicy etc. (see AFTask.constructor())
// you can pass to addTask just a function

flow.addTask(yourAsyncFunc4);

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
successfully and something else in the case of error (i.e. exception).
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

## Repeating tasks

If you need to schedule repeating task you can pass repeatingInterval to 
task constructor:

```javascript
const task = new IncTask({repeatingInterval: 20});
```

Please note that repeatingInterval defines interval in MS between task
finish time and the time when this task will be re-added to flow queue.

## How to cancel task

A task can be cancelled by *AsyncFlow.cancel(task)* method call.

## Flow state

Sometimes you'd like to be notified about some specific state change in the flow.
Maybe you got extremal value from a sensor? Or important data from server?
Or there were a lot of errors during flow work, and you need to care about it?

For that reason there is a flow state listening mechanism of AsyncFlow.
Every flow has internal object _flowState, that can be read by *getFlowState()*
call and set by *setFlowState(newState)* call. 

You can add state listener to be notified about some specific condition is true:

```javascript
flow.addStateListener(predicate, listener);
```

where **predicate** is a function receiving state parameter and returning 
boolean or object
```javascript
{
  result: boolean,
  data: object
}
```

and **listener** is a function receiving {state, data} as a parameter.
For example:

```javascript
flow.addStateListener((state) => state.a > 2, ({state}) => {
  console.log(`state.a = ${state.a}`);
});
```

In this example listener will be called when state.a > 2. Please note that AsyncFlow notifies 
state listeners between tasks; not at the setState() call. 
Every state listener will be called (if predicate is true) until it removed from AsyncFlow
by *removeStateListener(listener)* call.

You can also use await syntax to wait for a specific state condition. Just call *promiseForState()*, for example

```javascript
const {state} = await flow.promiseForState((state) => state.a > 2);
```

## Flow state projection

Though you can follow flow state with state listeners that described above,
there is one additional special mechanism in AsyncFlow. Just imagine you want
to be notified when some state based function (we will name it *state projection* 
or just *projection*) passes threshold.

![State Projection](state_projection.png)

This figure gives us an example of some state projection value evolution over time.
The projection threshold is set by predicate function that separates all the 
area of projection values into two parts: True-area and False-area. We definitely
want to know when projection will exceed threshold, i.e. there will be transition
from False to True-area (FT).
Sometimes we'd like to know also about back transition from True to False-area (TF).
At last maybe we need to be notified on every projection value change while it
happens in True-area.

AsyncFlow provides method
```javascript
addStateProjListener(projection, predicate, listener, flags)
``` 

where **projection** is a function receiving flow state as a parameter and returning
some projectionValue,

**predicate** is a function receiving projectionValue parameter and returning boolean or object
```javascript 
{
    result: boolean,
    data: object
}
```
                 
**listener** is a function receiving {state, data} as a parameter,

and **flags** is optional and describes if a listener will be called on True->True
and True->False moves. It can be constructed using *AsyncFlow.StateProjJump.TT* and
*AsyncFlow.StateProjJump.TF* constants, as we see in the code example below:

```javascript
flow.addStateProjListener(
  (state) => state.a,
  (a) => a > 2,
  listener,
  AsyncFlow.StateProjJump.TT | AsyncFlow.StateProjJump.TF);
```

The listener will be called on every FT, TT and TF change of projection.
The projection is evaluated as *state.a*, and predicate receives this projection
value and returns *a > 2*.

## Tasks merging

In some cases you'd like don't add a new task if the same task is already
waiting in a queue to be run, but you want just add a listeners to existing
task. Or maybe you wish to replace existing task some way by merging it
with a new task. For that purpose you can use a merging mechanism of AsyncFlow.

Let's start from a very simple example:

```javascript
class SymbolTask extends AFTask {
  constructor({symbol}) {
    super({
      func: async (string) => {
        return string + symbol;
      }, 
      merger: AFTaskMerger.BASIC
    });
    
    this.symbol = symbol;
  }
  
  isTaskEqual(task) {
    return this.symbol === task.symbol;
  }
}

// we create flow that supports merging
const flow = createAsyncFlow({name: 'flow', mergingPolicy: MergingPolicy.HEAD});

flow.addFlowIsEmptyListener(({result}) => {
  console.log(result);
  // it logs 'abc' because last added task is merged by existing one
});


flow.addTask(new SymbolTask({symbol: 'a'}));
flow.addTask(new SymbolTask({symbol: 'b'})); 
flow.addTask(new SymbolTask({symbol: 'c'}));
flow.addTask(new SymbolTask({symbol: 'b'}));
flow.start();
```

First of all we need to create AsyncFlow that supports merging by passing
not NONE (default) merging policy to createAsyncFlow() method. It can be

```javascript
const MergingPolicy = Object.freeze({
  NONE: 0, // merging is off
  HEAD: 1, // looking for task to merge to from the head of queue
  TAIL: 2  // try to merge to last task in the queue only
});
```

Both tasks we are merging together should support merging; it means they have
to get a not NONE merger as a constructor parameter. In the current version of
AsyncFlow it can be either AFTaskMerger.BASIC or some custom method taking
a task as a parameter and returning a merging task as a result.

A BASIC merger as in example above just ignores a new added task if equal task 
(see method *isTaksEqual()* in example code) is already exists in queue. It also
adds onSuccess and onError of a new task to existing one.

## Task priority

By default every new task is added to the end of AsyncFlow queue because all the tasks
have the same (AFTaskPriority.NORMAL) priority. The task priority can be set either 
via constructor or by task.priority assignment. The value of priority should be numerical.
You can use some predefined constants to make your code more readable:

```javascript
const AFTaskPriority = Object.freeze({
  HIGHEST: 0,
  HIGH: 64,
  NORMAL: 128,
  LOW: 192,
  LOWEST: 255
});
```

Please note that BASIC merger choose a highest priority (i.e. minimal value) from merged 
task priorities. It means if there is task1 in queue with priority NORMAL and you add now
a new task2 with priority HIGH then a merged task will have a priority HIGH and will be 
moved closer to head of queue.

## AFManager

AFManager provides a method to resolve created AsyncFlow by its name.
For example:

```javascript
global.afManager = createAFManager();

createAsyncFlow({name: 'flow1', afManager});

createAsyncFlow({name: 'flow2', afManager});

```

Now you can easily get flow1 and flow2 from any part of your application:

```javascript
const flow = global.afManager.resolve('flow1');
```
 
Please note that it's not possible to add to the same AFManager a second 
AsyncFlow of the same name. AFManager throws in that case an error.
