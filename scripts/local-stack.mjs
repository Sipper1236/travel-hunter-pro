import {spawn as nodeSpawn} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const nextCli=fileURLToPath(new URL('../node_modules/next/dist/bin/next',import.meta.url));
const workerScript=fileURLToPath(new URL('./search-worker.mjs',import.meta.url));

/** Start the loopback development site and its durable worker as one managed stack. */
export function startLocalStack({spawn=nodeSpawn,cwd=root,signals=process,killAfterMs=5000}={}){
  const specs=[
    {name:'web',args:[nextCli,'dev','--hostname','127.0.0.1']},
    {name:'search worker',args:['--env-file-if-exists=.env.local',workerScript]},
  ];
  const children=[];
  let stopping=false,exitCode=0,killTimer;
  const exited=new Set();
  let resolveDone;
  const done=new Promise(resolve=>{resolveDone=resolve;});
  const cleanup=()=>{
    clearTimeout(killTimer);
    signals.off('SIGINT',onInterrupt);
    signals.off('SIGTERM',onTerminate);
  };
  const finishIfDone=()=>{
    if(exited.size!==children.length)return;
    cleanup();
    resolveDone(exitCode);
  };
  const stop=(code=0)=>{
    if(stopping)return;
    stopping=true;
    exitCode=code;
    for(const child of children)if(!exited.has(child))child.kill('SIGTERM');
    killTimer=setTimeout(()=>{
      for(const child of children)if(!exited.has(child))child.kill('SIGKILL');
    },killAfterMs);
    killTimer.unref?.();
    finishIfDone();
  };
  const onInterrupt=()=>stop(0),onTerminate=()=>stop(0);
  signals.once('SIGINT',onInterrupt);
  signals.once('SIGTERM',onTerminate);
  try{
    for(const spec of specs){
      const child=spawn(process.execPath,spec.args,{cwd,stdio:'inherit',env:process.env});
      children.push(child);
      child.once('error',error=>{
        process.stderr.write(`${spec.name} process failed: ${error.message}\n`);
        stop(1);
      });
      child.once('close',(code,signal)=>{
        exited.add(child);
        if(!stopping){
          process.stderr.write(`${spec.name} process exited (${signal??code??'unknown'}); stopping the local stack.\n`);
          stop(1);
        }
        finishIfDone();
      });
    }
  }catch(error){
    process.stderr.write(`Could not start the local stack: ${error.message}\n`);
    stop(1);
  }
  return {done,stop};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
  const stack=startLocalStack();
  console.log('Starting local Travel Hunter Pro web app and search worker on loopback.');
  process.exitCode=await stack.done;
}
