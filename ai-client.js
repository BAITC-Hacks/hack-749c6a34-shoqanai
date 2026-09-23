globalThis.SanaAI = (() => {
  async function request(path, options={}) {
    if(typeof fetch!=='function' || globalThis.location?.protocol==='file:') throw Error('Запустите start.bat или python start.py для подключения OpenAI.');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),35000);
    try {
      const response=await fetch(path,{...options,signal:controller.signal,credentials:'same-origin'});
      if(!response.headers.get('content-type')?.includes('application/json'))throw Error('AI-сервер недоступен. Запустите start.bat или python start.py.');
      const result=await response.json();
      if(!response.ok)throw Error(result.error||'Помощник временно недоступен.');
      return result;
    } catch(error){if(error.name==='AbortError')throw Error('Время ожидания истекло. Попробуйте ещё раз.');throw error;}
    finally{clearTimeout(timer);}
  }
  async function ask(mode, task={}, message='', history=[]) {
    // Contact details and company identity are not needed for task coaching.
    const clean={};for(const k of ['draft','title','topic','context','need','users','data','constraints','result','success','interaction'])clean[k]=task[k]||'';
    const recent=history.slice(-8).map(m=>({role:m.role,content:String(m.content).slice(0,6000)}));
    const out=await request('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode,task:clean,message,history:recent})});
    if(out.source!=='openai'||typeof out.message!=='string'||!out.message.trim()||out.message.length>6000||!Array.isArray(out.questions))throw Error('Некорректный ответ AI-сервера.');
    if(mode==='questions')Hub.validateAssistant(out);
    else if(out.questions.length>3||out.questions.some(q=>!q||!Hub.fields.some(f=>f[0]===q.field)||typeof q.question!=='string'||q.question.length>700))throw Error('Некорректные вопросы AI-сервера.');
    return out;
  }
  return {ask,status:()=>request('/api/ai/status')};
})();
