const fs=require('node:fs'),vm=require('node:vm');
const code=['domain.js','ai-client.js'].map(f=>fs.readFileSync(__dirname+'/../'+f,'utf8')).join('\n');
function assert(ok,message){if(!ok)throw Error(message);}
async function main(){
 let payload,mode='success';
 const ctx=vm.createContext({URL,AbortController,setTimeout,clearTimeout,location:{protocol:'http:'},fetch:async(path,options)=>{
  if(options?.body)payload=JSON.parse(options.body);
  return {ok:mode!=='error',headers:{get:()=>mode==='html'?'text/html':'application/json'},json:async()=>mode==='error'?{error:'Ключ не настроен'}:mode==='invalid'?{source:'openai',message:42,questions:[]}:{source:'openai',message:'Уточните критерий',questions:[]}};
 }});
 vm.runInContext(code,ctx);
 const ask=ctx.SanaAI.ask;
 const result=await ask('chat',{contact:'private@example.com',company:'Private',need:'Сократить списания'},'Помоги');
 assert(result.source==='openai','Provider response accepted');
 assert(!('contact' in payload.task)&&!('company' in payload.task),'Contact and company excluded');
 assert(payload.task.need==='Сократить списания','Task context included');
 for(const test of ['error','invalid','html']){mode=test;let rejected=false;try{await ask('chat',{},'Помоги');}catch{rejected=true;}assert(rejected,'Reject '+test);}
 ctx.location.protocol='file:';let rejected=false;try{await ask('chat',{},'Помоги');}catch{rejected=true;}assert(rejected,'Direct file has no AI endpoint');
 console.log('PASS: AI client response, private-field omission, server errors, invalid response, static-host fallback.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
