export const categories = ['kedvencek', 'elrejtett', 'nincs besorolva'];
export const facets = ['priorities', 'parts', 'topics', 'examTopics', 'categories'];
export function defaults() { return {priorities:[], parts:[], topics:[], examTopics:[], categories:[], rankFrom:null, rankTo:null, count:20, direction:'hu', excludeHidden:true}; }
export function flags(word, marks) { return marks[word.id] ?? {favorite:word.sourceCategory === 'kedvencek', hidden:word.sourceCategory === 'láthatatlan'}; }
export function topics(word) { const ts=(word.topics ?? [word.topic]).filter(t=>t && t.toLowerCase()!=='nincs megadva'); return ts.length?ts:['általános']; }
export function labels(word, marks) { const f=flags(word,marks); return f.favorite||f.hidden ? [...(f.favorite?['kedvencek']:[]),...(f.hidden?['elrejtett']:[])] : ['nincs besorolva']; }
export function visible(word,s,marks) { return !s.excludeHidden || !flags(word,marks).hidden || s.categories.includes('elrejtett'); }
export function matches(w,s,marks,ignore=null) {
  const any=(key,values)=>ignore===key || !s[key].length || s[key].some(v=>values.includes(v));
  return visible(w,s,marks) && (s.rankFrom===null || w.rank>=s.rankFrom) && (s.rankTo===null || w.rank<=s.rankTo)
    && any('priorities',[w.priority]) && any('parts',[w.part]) && any('topics',topics(w))
    && (!w.id.startsWith('csv:de:') || any('examTopics',w.examTopics??[])) && any('categories',labels(w,marks));
}
export function bounds(words,s,marks) {
  const ranks=words.filter(w=>visible(w,s,marks) && (!s.priorities.length||s.priorities.includes(w.priority))).map(w=>w.rank);
  return ranks.length ? [Math.min(...ranks),Math.max(...ranks)] : null;
}
export function range(s,b) { if(!b)return [0,0]; const lo=Math.min(b[1],Math.max(b[0],s.rankFrom??b[0])); return [lo,Math.min(b[1],Math.max(lo,s.rankTo??b[1]))]; }
export function options(words,s,marks,key) {
  if(key==='categories')return categories;
  const pool=key==='priorities'?words.filter(w=>visible(w,s,marks)):words.filter(w=>matches(w,s,marks,key));
  return [...new Set(pool.flatMap(w=>key==='priorities'?[w.priority]:key==='parts'?[w.part]:key==='topics'?topics(w):w.examTopics??[]))].sort((a,b)=>a.localeCompare(b,'hu'));
}
export function normalize(words,settings,marks) {
  const s={...defaults(),...settings};
  for(const key of facets) s[key]=Array.isArray(s[key])?s[key].filter(v=>typeof v==='string'):[];
  s.categories=s.categories.filter(c=>categories.includes(c));
  s.priorities=s.priorities.filter(v=>options(words,s,marks,'priorities').includes(v));
  for(const edge of ['rankFrom','rankTo']) if(!Number.isInteger(s[edge]))s[edge]=null;
  const b=bounds(words,s,marks); const [lo,hi]=range(s,b);
  s.rankFrom=!b||lo===b[0]?null:lo; s.rankTo=!b||hi===b[1]?null:hi;
  for(const key of ['parts','topics','examTopics'])s[key]=s[key].filter(v=>options(words,s,marks,key).includes(v));
  s.count=Math.max(1,Math.min(10000,Math.floor(Number(s.count)||20)));
  s.direction=s.direction==='foreign'?'foreign':'hu'; s.excludeHidden=s.excludeHidden!==false;
  return s;
}
export function sorted(words) { return [...words].sort((a,b)=>a.rank-b.rank||a.id.localeCompare(b.id)); }
export function fold(text) { return text.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase(); }
export function search(words,query) { const q=fold(query.trim()); return q.length<3?[]:sorted(words.filter(w=>fold(w.german+' '+w.hungarian).includes(q))); }
export function article(w) { if(!w?.id.startsWith('csv:de:')||w.part!=='főnév')return null; const m=w.german.match(/^(der|die|das)\s+(.+)$/i); return m?{answer:m[1].toLowerCase(),noun:m[2]}:null; }
export function shuffle(words,random=Math.random) { const a=[...words]; for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
export function reshuffle(words) { const a=shuffle(words); if(a.length>1&&a.every((w,i)=>w.id===words[i].id))a.push(a.shift()); return a; }
export function answerArticle(deck,index,answer) { const q=article(deck[index]); if(!q)return null; const correct=q.answer===answer; return {index:correct?Math.min(index+1,deck.length-1):0,finished:correct&&index===deck.length-1,feedback:correct?'':q.answer+' '+q.noun}; }
export function importMarks(input,words) {
  const raw=input?.overrides??input;
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Érvénytelen jelölésfájl.');
  const valid=v=>v&&typeof v.favorite==='boolean'&&typeof v.hidden==='boolean';
  const out={};
  for(const w of words){ let f=Object.hasOwn(raw,w.id)?raw[w.id]:null;
    if(!valid(f)){const older=(w.legacyIDs??[]).filter(id=>Object.hasOwn(raw,id)).map(id=>raw[id]).filter(valid); if(older.length&&older.every(x=>x.favorite===older[0].favorite&&x.hidden===older[0].hidden))f=older[0];}
    if(valid(f))out[w.id]={favorite:f.favorite,hidden:f.hidden};
  }
  if(!Object.keys(out).length)throw Error('A fájlban nincs ehhez a szókészlethez használható jelölés.');
  return out;
}
