import test from 'node:test';
import assert from 'node:assert/strict';
import {MarkStore} from '../public/sync.js';

function environment(){
  const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
  globalThis.window={addEventListener:()=>{}};Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
  return storage;
}
function makeStore(){const errors=[],statuses=[];const s=new MarkStore(()=>{},value=>statuses.push(value),()=>{},message=>errors.push(message));clearInterval(s.retryTimer);return {s,errors,statuses};}
test('Guest flags survive reload and stay separate from a signed-in account',()=>{
  environment();const {s}=makeStore();s.set('csv:de:test',{favorite:true});const second=makeStore().s;assert.equal(second.marks['csv:de:test'].favorite,true);
  second.scope='user-A';second.load();assert.deepEqual(second.marks,{});second.scope='guest';second.load();assert.equal(second.marks['csv:de:test'].favorite,true);
});
test('Queued offline flags survive reload in the correct account scope',()=>{
  environment();navigator.onLine=false;const {s}=makeStore();s.user={uid:'A'};s.scope='A';s.load();s.set('csv:de:test',{hidden:true});
  const reloaded=makeStore().s;reloaded.scope='A';reloaded.load();assert.equal(reloaded.marks['csv:de:test'].hidden,true);assert.equal(Object.keys(reloaded.pending).length,1);
  reloaded.scope='B';reloaded.load();assert.deepEqual(reloaded.marks,{});
});
test('Successful upload clears the queue and writes only changed fields',async()=>{
  environment();const {s}=makeStore();const writes=[];s.user={uid:'A'};s.scope='A';s.load();s.ready=false;s.set('csv:de:test',{favorite:true});
  s.F={writeBatch:()=>({set:(ref,data,options)=>writes.push({ref,data,options}),commit:async()=>{}}),doc:(_db,...path)=>path.join('/'),serverTimestamp:()=>'<server time>'};
  s.ready=true;await s.flush();assert.equal(writes[0].ref,'users/A/marks/csv:de:test');assert.deepEqual(writes[0].data,{favorite:true,updatedAt:'<server time>'});assert.equal(writes[0].options.merge,true);assert.deepEqual(s.pending,{});assert.equal(s.marks['csv:de:test'].favorite,true);
});
test('Failed cloud writes retain durable pending edits and report the failure',async()=>{
  environment();const {s,errors}=makeStore();s.user={uid:'A'};s.scope='A';s.load();s.set('csv:en:test',{hidden:true});
  s.F={writeBatch:()=>({set:()=>{},commit:async()=>{throw {code:'permission-denied'};}}),doc:()=>'',serverTimestamp:()=>0};s.ready=true;
  await s.flush();assert.equal(s.pending['csv:en:test'].hidden.value,true);assert.equal(s.marks['csv:en:test'].hidden,true);assert.equal(errors.length,1);assert.equal(s.busy,false);
  const restored=JSON.parse(localStorage.getItem(s.key()));assert.equal(restored.pending['csv:en:test'].hidden.value,true);
});
