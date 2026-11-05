import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as C from '../public/core.js';
import {overlay,acknowledge} from '../public/sync-state.js';
const de=JSON.parse(readFileSync(new URL('../public/data/de.json',import.meta.url)));
const en=JSON.parse(readFileSync(new URL('../public/data/en.json',import.meta.url)));
test('All vocabulary, stable IDs, ranks and level windows are preserved',()=>{
  for(const words of [de,en]){assert.equal(words.length,5684);assert.equal(new Set(words.map(w=>w.id)).size,5684);assert.deepEqual(C.sorted(words).map(w=>w.rank),Array.from({length:5684},(_,i)=>i+1));
    for(const level of ['A1','A2','B1','B2','C1','C2']){const ranks=words.filter(w=>w.priority===level).map(w=>w.rank);assert.ok(Math.max(...ranks)-Math.min(...ranks)<=2500);}
  }
});
test('Facets only offer choices with results under the other filters',()=>{
  const s={...C.defaults(),priorities:['A1']};
  for(const key of ['parts','topics','examTopics'])for(const v of C.options(de,s,{},key))assert.ok(de.some(w=>C.matches(w,{...s,[key]:[v]},{})));
  assert.ok(!C.options(de,s,{},'parts').includes('kifejezés'));
});
test('No-result stale selections are removed',()=>{const s=C.normalize(de,{...C.defaults(),priorities:['A1'],parts:['kifejezés']},{});assert.deepEqual(s.parts,[]);});
test('Categories remain selectable, even when favorites are empty',()=>{assert.deepEqual(C.options(de,C.defaults(),{},'categories'),['kedvencek','elrejtett','nincs besorolva']);});
test('Hidden category can explicitly show hidden words and set correct bounds',()=>{
  const marks={[de[0].id]:{favorite:false,hidden:true}},s=C.defaults();assert.equal(C.matches(de[0],s,marks),false);assert.equal(C.bounds(de,s,marks)[0],2);
  s.categories=['elrejtett'];assert.equal(C.matches(de[0],s,marks),true);assert.equal(C.bounds(de,s,marks)[0],1);
});
test('Rank maximum follows selected levels and defaults follow visible minimum',()=>{
  const s={...C.defaults(),priorities:['A1']};assert.deepEqual(C.bounds(de,s,{}),[1,2501]);
  const normalized=C.normalize(de,s,{[de[0].id]:{favorite:false,hidden:true}});assert.equal(normalized.rankFrom,null);assert.deepEqual(C.range(normalized,C.bounds(de,normalized,{[de[0].id]:{favorite:false,hidden:true}})),[2,2501]);
});
test('Multitopic values use OR within facets and AND between facets',()=>{
  const w=de.find(w=>w.topics?.length>1);assert.ok(w);assert.equal(C.matches(w,{...C.defaults(),topics:[w.topics[1]],parts:[w.part]},{}),true);assert.equal(C.matches(w,{...C.defaults(),topics:[w.topics[1]],parts:['not-a-part']},{}),false);
});
test('Dictionary waits for 3 chars and is accent-insensitive',()=>{assert.deepEqual(C.search(de,'de'),[]);assert.ok(C.search(de,'  der ').length);const found=C.search(de,'csalad');assert.ok(found.some(w=>C.fold(w.hungarian).includes('csalad')));});
test('German article pool excludes ambiguous and English entries',()=>{assert.equal(de.filter(C.article).length,2818);assert.equal(en.filter(C.article).length,0);});
test('Wrong article resets index without changing deck; correct final answer finishes',()=>{
  const deck=de.filter(C.article).slice(0,3),ids=deck.map(w=>w.id);const q=C.article(deck[1]);const wrong=q.answer==='der'?'die':'der';
  const result=C.answerArticle(deck,1,wrong);assert.equal(result.index,0);assert.equal(result.finished,false);assert.equal(result.feedback,q.answer+' '+q.noun);assert.deepEqual(deck.map(w=>w.id),ids);
  assert.equal(C.answerArticle(deck,2,C.article(deck[2]).answer).finished,true);
  const next=C.answerArticle(deck,0,C.article(deck[0]).answer);assert.equal(next.index,1);assert.equal(next.feedback,'');
});
test('Shuffle restart retains exactly the same words',()=>{const deck=de.slice(0,20),again=C.reshuffle(deck);assert.deepEqual(again.map(w=>w.id).sort(),deck.map(w=>w.id).sort());assert.notDeepEqual(again.map(w=>w.id),deck.map(w=>w.id));});
test('Mac export import keeps false marks and separates languages',()=>{
  const raw={[de[0].id]:{favorite:false,hidden:true},[en[0].id]:{favorite:true,hidden:false},unknown:{favorite:true,hidden:true}};
  const imported=C.importMarks(raw,[...de,...en]);assert.equal(Object.keys(imported).length,2);assert.deepEqual(imported[de[0].id],raw[de[0].id]);assert.notDeepEqual(imported[de[0].id],imported[en[0].id]);
});
test('Unambiguous legacy IDs migrate and malformed data is rejected',()=>{
  const w=de.find(w=>w.legacyIDs?.length);const raw={[w.legacyIDs[0]]:{favorite:true,hidden:false}};assert.equal(C.importMarks(raw,[w])[w.id].favorite,true);assert.throws(()=>C.importMarks({[w.id]:{favorite:'yes',hidden:false}},[w]));
});
test('Pending edits to one flag preserve remote edits to the other flag',()=>{
  assert.deepEqual(overlay({word:{favorite:false,hidden:true}},{word:{favorite:{value:true,token:'one'}}}),{word:{favorite:true,hidden:true}});
});
test('Acknowledging old writes never discards newer queued changes',()=>{
  const pending={word:{favorite:{value:false,token:'new'},hidden:{value:true,token:'same'}}};
  const sent={word:{favorite:{value:true,token:'old'},hidden:{value:true,token:'same'}}};
  assert.deepEqual(acknowledge(pending,sent),{word:{favorite:{value:false,token:'new'}}});assert.equal(pending.word.hidden.value,true);
});
