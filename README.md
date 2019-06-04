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

// a new task can be added to end of flow at every time 
// and in every point od application 

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



## Errors handling



## Tasks merging



## AFManager
