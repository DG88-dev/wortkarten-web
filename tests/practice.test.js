import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as C from '../public/core.js';

function app() {
  const elements=new Map(),listeners={};
  const element=()=>({hidden:false,style:{},classList:{toggle(){}},append(){},replaceChildren(){},setAttribute(){},removeAttribute(){},focus(){},blur(){}});
  const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
  const context=vm.createContext({C,localStorage:{getItem:()=>null,setItem(){}},
    document:{getElementById:get,createElement:element,querySelectorAll:()=>[],activeElement:element(),addEventListener:(name,fn)=>listeners[name]=fn},
    window:{addEventListener(){}},matchMedia:()=>({matches:false,addEventListener(){}})});
  const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/load\(\);\s*$/,'');
  vm.runInContext(source,context);
  const run=code=>vm.runInContext(code,context);
  run(`data.de=Array.from({length:6},(_,i)=>({id:'csv:de:'+i,rank:i+1,german:'der Test'+i,hungarian:'teszt'+i,part:'főnév',priority:'A1'}));settings.count=3;`);
  const key=value=>{let prevented=false;listeners.keydown({key:value,target:{matches:()=>false},preventDefault(){prevented=true;}});return prevented;};
  return {run,key,get};
}

for(const mode of ['normal','article']) {
  test(`${mode}: repeat button and Space preserve the deck and reset practice state`,()=>{
    for(const trigger of ['button','space']) {
      const a=app();a.run(`start('${mode}');flipped=true;feedback='wrong';index=2;finish();`);
      const before=a.run('deck.map(w=>w.id).join()');
      // Marking a practiced word hidden must not remove it from a repeat.
      a.run('marks[deck[0].id]={hidden:true};');
      if(trigger==='button')a.get('repeat').onclick();else assert.equal(a.key(' '),true);
      const after=a.run('deck.map(w=>w.id).join()');
      assert.deepEqual(after.split(',').sort(),before.split(',').sort());
      assert.notEqual(after,before);
      assert.equal(a.run("index===0&&!flipped&&!finished&&feedback===''&&practicing"),true);
      assert.equal(a.run('mode'),mode);
      assert.equal(a.get('finished').hidden,true);
    }
  });
  test(`${mode}: new round button and Enter select from the current pool`,()=>{
    for(const trigger of ['button','enter']) {
      const a=app();a.run(`start('${mode}');finish();deck.forEach(w=>marks[w.id]={hidden:true});`);
      const before=a.run('deck.map(w=>w.id).join()').split(',');
      if(trigger==='button')a.get('restart').onclick();else assert.equal(a.key('Enter'),true);
      assert.equal(a.run('deck.length'),3);
      assert.ok(a.run('deck.map(w=>w.id).join()').split(',').every(id=>!before.includes(id)));
      assert.equal(a.run('mode'),mode);
      assert.equal(a.run('finished'),false);
    }
  });
}
test('Escape returns from completion to settings; Space still flips during practice',()=>{
  const a=app();a.run('start();');assert.equal(a.key(' '),true);assert.equal(a.run('flipped'),true);
  a.run('finish();');assert.equal(a.key('Escape'),true);assert.equal(a.run('practicing'),false);assert.equal(a.get('setup').hidden,false);
});
