import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {startLocalStack} from '../scripts/local-stack.mjs';

class Child extends EventEmitter{
  signals=[];
  kill(signal){this.signals.push(signal);queueMicrotask(()=>this.emit('close',0,signal));return true;}
}

test('local stack starts the web app on loopback and loads worker environment',async()=>{
  const children=[],calls=[],signals=new EventEmitter();
  const stack=startLocalStack({signals,spawn:(command,args,options)=>{
    calls.push({command,args,options});const child=new Child();children.push(child);return child;
  }});
  assert.equal(calls.length,2);
  assert.deepEqual(calls[0].args.slice(-2),['--hostname','127.0.0.1']);
  assert.equal(calls[1].args[0],'--env-file-if-exists=.env.local');
  assert.ok(calls.every(call=>call.options.stdio==='inherit'));
  stack.stop();
  assert.equal(await stack.done,0);
  assert.deepEqual(children.map(child=>child.signals),[['SIGTERM'],['SIGTERM']]);
});

test('unexpected process exit stops its sibling and reports failure',async()=>{
  const children=[],signals=new EventEmitter();
  const stack=startLocalStack({signals,spawn:()=>{const child=new Child();children.push(child);return child;}});
  children[0].emit('close',1,null);
  assert.equal(await stack.done,1);
  assert.deepEqual(children[1].signals,['SIGTERM']);
});
