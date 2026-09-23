// Run with Node.js: node tests/workflow.cjs
// Application-handler integration tests with a simulated DOM, not browser layout tests.
const fs = require('node:fs');
const vm = require('node:vm');
const code = ['domain.js', 'data.js', 'app.js'].map(file => fs.readFileSync(__dirname + '/../' + file, 'utf8')).join('\n');
const store = {};
let nextId = 0;
function assert(value, message) { if (!value) throw Error(message); }
function boot(failStorage = false) {
  const handlers = {}, nodes = {}, classes = new Set();
  const node = id => nodes[id] ||= {innerHTML:'', textContent:'', value:'', attrs:{}, focus(){}, setAttribute(k,v){this.attrs[k]=v;}, classList:{add(){},remove(){}}};
  node('sidebar').classList = {toggle(k){if(classes.has(k)){classes.delete(k);return false;}classes.add(k);return true;},remove:k=>classes.delete(k)};
  let values = {};
  const document = {
    getElementById: node,
    querySelector(s) {
      if(s === '#builder-form') return node('app').innerHTML.includes('id="builder-form"') ? node('form') : null;
      if(s === '.sidebar.menu-open') return classes.has('menu-open') ? node('sidebar') : null;
      if(s === '.sidebar') return node('sidebar');
      if(s === '#cards' && !node('app').innerHTML.includes('id="cards"')) return null;
      return node(s.replace(/^#/,''));
    },
    querySelectorAll(){return [node('mobile-score')];},
    addEventListener:(name,fn)=>handlers[name]=fn
  };
  const context = vm.createContext({URL,console,document,
    localStorage:{getItem:k=>store[k]||null,setItem(k,v){if(failStorage)throw Error('Quota exceeded');store[k]=v;}},
    crypto:{randomUUID:()=> 'test-'+(++nextId)},
    window:{scrollTo(){},matchMedia:()=>({matches:true})},
    setTimeout:()=>1,clearTimeout(){},
    FormData:class {constructor(){return Object.entries(values);}}
  });
  vm.runInContext(code, context);
  return {
    node, classes,
    click(action, extra={}) {handlers.click({target:{closest:()=>Object.assign(node('clicked'),{dataset:{action,...extra}})}});},
    input(v) {values=v;handlers.input({target:{id:'field',closest:()=>node('form')}});},
    search(value) {handlers.input({target:{id:'search',value,closest:()=>null}});},
    submit(id,v,extra={}) {values=v;handlers.submit({preventDefault(){},target:{id,classList:{contains:()=>false},...extra}});},
    key(key){handlers.keydown({key});}
  };
}
const saved = () => JSON.parse(store['aisana-hub-v1']);
let app = boot();
app.click('menu'); assert(app.classes.has('menu-open'),'Menu opens');
app.key('Escape'); assert(!app.classes.has('menu-open'),'Escape closes menu');
app.click('new');
app.input({draft:'Хотим сократить списания в кафе',topic:'Ритейл'});
app.click('analyze');
app.input({need:'Снизить списания',users:'Управляющий',data:'CSV продаж',constraints:'3 недели',result:'Дашборд',success:'Ошибка менее 20%',contact:'demo@example.com',interaction:'Еженедельный созвон'});
const firstId = saved().workbench[0].task.id;
assert(saved().workbench[0].step===2,'Current step is saved');
app = boot();
app.click('resume-draft',{id:firstId});
assert(app.node('app').innerHTML.includes('Снизить списания'),'Answers restored after reload');
app.click('new');
app.input({draft:'Вторая задача для бизнеса',topic:'Образование'});
assert(saved().workbench.length===2,'Starting a new draft preserves the previous one');
app.click('resume-draft',{id:firstId});
app.click('compose');
app.submit('builder-form',{title:'Прогноз закупок',company:'Demo Cafe',consent:'on'});
assert(saved().tasks.at(-1).readiness===100,'Confirmed task published at 100');
assert(saved().workbench.length===1 && saved().workbench[0].task.id!==firstId,'Publication removes only its own draft');
app.click('edit',{id:firstId});
app.input({data:''});
assert(saved().tasks.at(-1).readiness===100,'Unconfirmed edits do not alter published task');
app = boot();
app.click('resume-draft',{id:firstId});
assert(!app.node('app').innerHTML.includes('name="consent" required checked'),'Publication consent is not restored');
app.submit('builder-form',{title:'Прогноз закупок',company:'Demo Cafe',consent:'on'});
assert(saved().tasks.at(-1).readiness===80,'Restored edits recalculate only upon confirmation');
app.click('catalog');
app.click('favorite',{id:firstId});
assert(saved().favorites.includes(firstId),'Favorite saved');
app = boot();
app.click('favorites-filter');
assert(app.node('cards').innerHTML.includes('Прогноз закупок'),'Favorite restored after reload');
assert(!app.node('cards').innerHTML.includes('data-id="task-0"'),'Favorites filter excludes other tasks');
app.click('clear-filters');
assert(app.node('cards').innerHTML.includes('data-id="task-0"'),'Full catalog remains accessible');
app.search('  DEMO   закупок  ');
assert(app.node('result-count').textContent==='Найдено: 1 из '+saved().tasks.length,'Search matches words across fields');
app.click('role',{role:'student'});
app.click('detail',{id:firstId});
app.submit('proposal-form',{teamId:'team-0',idea:'Прогноз',plan:'Проверить данные и собрать модель',deadline:'3 недели',url:'https://example.com/demo'});
const proposalId = saved().proposals.at(-1).id;
app.click('role',{role:'business'});
app.click('select',{id:proposalId});
app.submit('progress',{evidence:'Результат проверен'},{dataset:{id:proposalId},classList:{contains:n=>n==='progress-form'}});
assert(saved().proposals.at(-1).points===50,'Full workflow awards verified milestone points');
app = boot(true);
app.click('new');app.input({draft:'Черновик при недоступном хранилище'});
assert(app.node('draft-save-status').textContent.includes('Не удалось сохранить'),'Storage failure is shown honestly');
console.log('PASS: autosave, reload, multiple drafts, publication, edit isolation, favorites, search, menu, full workflow, storage failure.');
