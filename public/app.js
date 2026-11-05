import * as C from './core.js';
import {MarkStore} from './sync.js';
const $=id=>document.getElementById(id);
const E=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const names={priorities:'Szint',parts:'Szófaj',topics:'Témakör',examTopics:'Nyelvvizsga-témakör',categories:'Kategória'};
const icon=(kind,active)=> kind==='favorite'
 ?`<svg viewBox="0 0 24 24" aria-hidden="true" fill="${active?'currentColor':'none'}" stroke="currentColor" stroke-width="1.7"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/></svg>`
 :`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>${active?'<path d="m3 3 18 18"/>':''}</svg>`;
let language='de',settingsByLanguage={},settings=C.defaults(),data={},marks={},store,deck=[],index=0,mode='normal',flipped=false,finished=false,feedback='',practicing=false,query='',ready=false,listItems=[],listIndex=0,renderFrame=0;
try{const saved=JSON.parse(localStorage.getItem('wortkarten-settings-v1')||'{}');language=saved.language==='en'?'en':'de';settingsByLanguage=saved.settings??{};settings={...C.defaults(),...settingsByLanguage[language]};}catch{}
const words=()=>data[language]??[];
const filtered=()=>C.sorted(words().filter(w=>C.matches(w,settings,marks)));
function persist(){settingsByLanguage[language]=settings;try{localStorage.setItem('wortkarten-settings-v1',JSON.stringify({language,settings:settingsByLanguage}));}catch{notice('A böngésző tárhelye nem írható.');}}
function notice(message){$('notice').textContent=message;$('notice').hidden=false;}
$('notice').onclick=()=>{$('notice').hidden=true;};
function refresh(preserve=false){if(!ready)return;const scroll=preserve===true?$('word-list').scrollTop:0,rows=listIndex;settings=C.normalize(words(),settings,marks);persist();renderSetup();if(scroll){while(listIndex<Math.min(rows,listItems.length))appendRows();$('word-list').scrollTop=scroll;}if(practicing&&!finished)renderCard();}
function scheduleRefresh(){cancelAnimationFrame(renderFrame);renderFrame=requestAnimationFrame(()=>refresh(true));}
function markButton(word,field,large=false){
  const active=C.flags(word,marks)[field];
  const b=E('button',(large?'':'icon-button ')+(active?(field==='favorite'?'is-favorite':'is-hidden'):''));
  const label=field==='favorite'?(active?'Kedvenc eltávolítása':'Kedvencekhez adás'):(active?'Megjelenítés':'Elrejtés');
  b.innerHTML=icon(field,active);if(large)b.append(E('span','',field==='favorite'?'Kedvencek':label));
  b.title=label;b.setAttribute('aria-label',label);b.setAttribute('aria-pressed',String(active));
  b.onclick=()=>store.set(word.id,{[field]:!C.flags(word,marks)[field]});return b;
}
function renderFilters(){
  const root=$('filters');root.replaceChildren();
  for(const key of C.facets){if(key==='examTopics'&&language!=='de')continue;
    const choices=C.options(words(),settings,marks,key);
    const details=E('details','filter'),summary=E('summary'),labels=E('span');
    labels.append(E('span','filter-name',names[key]),E('span','selected-label',settings[key].join(' · ')||'Összes'));summary.append(labels);details.append(summary);
    const panel=E('div','filter-options'),all=E('button','', 'Összes');all.onclick=()=>{settings[key]=[];refresh();};panel.append(all);
    for(const choice of choices){const label=E('label'),input=E('input');input.type='checkbox';input.checked=settings[key].includes(choice);input.onchange=()=>{settings[key]=input.checked?[...settings[key],choice]:settings[key].filter(x=>x!==choice);refresh();};label.append(input,E('span','',choice));panel.append(label);}
    if(!choices.length)panel.append(E('p','empty','Nincs választható érték.'));
    details.append(panel);root.append(details);
    details.ontoggle=()=>{if(!details.open)return;for(const other of root.children)if(other!==details)other.open=false;positionPanel(summary,panel);};
  }
}
function positionPanel(summary,panel){const r=summary.getBoundingClientRect(),h=Math.min(360,innerHeight*.7);panel.style.left=Math.max(8,Math.min(r.left,innerWidth-308))+'px';panel.style.top=(r.bottom+h+12>innerHeight?Math.max(8,r.top-Math.min(panel.scrollHeight,h)):r.bottom+5)+'px';}
function renderSetup(){
  const pool=filtered();$('total').textContent=pool.length.toLocaleString('hu-HU');$('loaded').textContent=words().length+' szó betöltve';
  $('mark-counts').textContent='★ '+words().filter(w=>C.flags(w,marks).favorite).length+' kedvenc · '+words().filter(w=>C.flags(w,marks).hidden).length+' elrejtett';
  for(const lang of ['de','en'])$('lang-'+lang).setAttribute('aria-pressed',String(language===lang));
  const foreign=language==='de'?'német':'angol';
  document.querySelectorAll('[data-direction]').forEach(b=>{b.textContent=b.dataset.direction==='hu'?'magyar → '+foreign:foreign+' → magyar';b.setAttribute('aria-pressed',String(settings.direction===b.dataset.direction));});
  $('search').placeholder='Keresés: '+foreign+' szó vagy magyar jelentés';
  $('exclude').checked=settings.excludeHidden;$('count').value=settings.count;
  $('start').disabled=!pool.length;$('start-article').hidden=language!=='de'||!settings.parts.includes('főnév');$('start-article').disabled=!pool.some(C.article);
  renderFilters();renderRange();renderList(query.trim().length>=3?C.search(words(),query):pool);
}
function renderRange(){const b=C.bounds(words(),settings,marks),[lo,hi]=C.range(settings,b);for(const [id,value]of[['range-low',lo],['range-high',hi]]){const input=$(id);input.min=b?.[0]??0;input.max=b?.[1]??0;input.value=value;input.disabled=!b||b[0]===b[1];} $('rank-low').textContent=b?lo:'—';$('rank-high').textContent=b?hi:'—';const span=b?b[1]-b[0]:0;$('range-fill').style.left=(span?(lo-b[0])/span*100:0)+'%';$('range-fill').style.right=(span?100-(hi-b[0])/span*100:0)+'%';}
for(const edge of ['low','high']){
  $('range-'+edge).oninput=()=>{const b=C.bounds(words(),settings,marks);if(!b)return;let lo=+$('range-low').value,hi=+$('range-high').value;if(lo>hi){if(edge==='low')lo=hi;else hi=lo;}settings.rankFrom=lo===b[0]?null:lo;settings.rankTo=hi===b[1]?null:hi;renderRange();};
  $('range-'+edge).onchange=refresh;
}
function renderList(items){listItems=items;listIndex=0;$('word-list').replaceChildren();$('word-list').scrollTop=0;$('word-list').setAttribute('aria-rowcount',String(items.length));if(!items.length){$('word-list').append(E('p','empty',query.trim().length>=3?'Nincs találat.':'Nincs a szűrőknek megfelelő szó.'));return;}appendRows();}
function appendRows(){const fragment=document.createDocumentFragment();for(const w of listItems.slice(listIndex,listIndex+100)){
  const row=E('div','word-row');row.setAttribute('role','row');const actions=E('div','mark-cell');actions.append(E('span','rank',String(w.rank)),markButton(w,'favorite'),markButton(w,'hidden'));
  row.append(actions,E('div','foreign',w.german),E('div','',w.hungarian),E('div','muted part-cell',w.part),E('div','muted',w.priority),E('div','muted topic-cell',C.topics(w).join(' · ')));
  for(const cell of row.children)cell.setAttribute('role','cell');fragment.append(row);
}listIndex=Math.min(listItems.length,listIndex+100);$('word-list').append(fragment);}
$('word-list').onscroll=()=>{const el=$('word-list');if(el.scrollHeight-el.scrollTop-el.clientHeight<400&&listIndex<listItems.length)appendRows();};
function showScreen(){ $('setup').hidden=practicing;$('practice').hidden=!practicing||finished;$('finished').hidden=!practicing||!finished;for(const lang of ['de','en'])$('lang-'+lang).disabled=practicing;}
function start(nextMode='normal'){
  const pool=filtered().filter(w=>nextMode!=='article'||C.article(w));if(!pool.length)return;
  mode=nextMode;deck=C.shuffle(pool).slice(0,settings.count);index=0;flipped=false;finished=false;feedback='';practicing=true;persist();showScreen();renderCard();document.activeElement?.blur();
}
function back(){practicing=false;finished=false;deck=[];feedback='';showScreen();refresh();}
function renderCard(){
  const w=deck[index];if(!w)return;
  $('practice-title').textContent=mode==='article'?'Der, Die, Das':'Szókártyák';$('card-level').textContent=w.priority+' · '+w.part;$('progress').textContent=(index+1)+'/'+deck.length;
  const content=$('card-content');content.replaceChildren();
  content.removeAttribute('role');content.removeAttribute('tabindex');content.removeAttribute('aria-label');content.onclick=null;content.onkeydown=null;
  if(mode==='article'){
    content.append(E('h1','',C.article(w).noun),E('p','meaning',w.hungarian));
  }else{
    const front=settings.direction==='hu'?w.hungarian:w.german,back=settings.direction==='hu'?w.german:w.hungarian;
    content.append(E('h1','',flipped?back:front));
    if(flipped){content.append(E('p','meaning',front));if(w.example)content.append(E('p','example',w.example));if(w.forms)content.append(E('p','forms',w.forms.replaceAll(' | ','\n')));}
    content.setAttribute('role','button');content.tabIndex=0;content.setAttribute('aria-label','Szókártya megfordítása');
    content.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();flip();}};
  }
  $('article-answers').hidden=mode!=='article';$('shuffle').hidden=mode!=='article';$('normal-controls').hidden=mode==='article';$('previous').disabled=index===0;
  $('feedback').textContent=feedback;$('feedback').hidden=!feedback;
  $('card-marks').replaceChildren(markButton(w,'favorite',true),markButton(w,'hidden',true));
}
function flip(){if(!practicing||finished||mode==='article')return;flipped=!flipped;renderCard();}
function finish(){finished=true;showScreen();$('finish-detail').textContent=deck.length+' szó';$('restart').focus();}
function previous(){if(index>0){index--;flipped=false;renderCard();}}
function next(){if(index+1>=deck.length)finish();else{index++;flipped=false;renderCard();}}
function shuffleAgain(){deck=C.reshuffle(deck);index=0;finished=false;feedback='';showScreen();renderCard();}
function answer(value){if(!practicing||finished||mode!=='article')return;const result=C.answerArticle(deck,index,value);index=result.index;feedback=result.feedback;if(result.finished)finish();else renderCard();}
$('start').onclick=()=>start();$('start-article').onclick=()=>start('article');$('back').onclick=back;$('finish-back').onclick=back;$('flip').onclick=flip;$('next').onclick=next;$('previous').onclick=previous;$('shuffle').onclick=shuffleAgain;$('restart').onclick=()=>mode==='article'?shuffleAgain():start();

// Three equal vertical tap zones, including the card's empty space.
// Interactive controls and text selection keep their own behavior.
$('card').onclick=e=>{
  if(!practicing||finished||mode!=='normal')return;
  if(e.target.closest('button,a,input,select,textarea'))return;
  if(window.getSelection()?.toString())return;
  const rect=e.currentTarget.getBoundingClientRect();
  const position=(e.clientX-rect.left)/rect.width;
  // Keyboard/assistive-technology activation of the content means flip.
  if(e.detail===0){flip();return;}
  if(position<1/3)previous();
  else if(position<2/3)flip();
  else next();
};

document.querySelectorAll('[data-article]').forEach(b=>b.onclick=()=>answer(b.dataset.article));
document.querySelectorAll('[data-direction]').forEach(b=>b.onclick=()=>{settings.direction=b.dataset.direction;refresh();});
for(const lang of ['de','en'])$('lang-'+lang).onclick=()=>{persist();language=lang;settings={...C.defaults(),...settingsByLanguage[lang]};query='';$('search').value='';refresh();};
$('exclude').onchange=()=>{settings.excludeHidden=$('exclude').checked;refresh();};$('clear').onclick=()=>{settings={...C.defaults(),count:settings.count,direction:settings.direction};refresh();};
$('count').onchange=()=>{settings.count=Number($('count').value);refresh();};$('all').onclick=()=>{settings.count=filtered().length||1;refresh();};
$('search').oninput=()=>{query=$('search').value;renderList(query.trim().length>=3?C.search(words(),query):filtered());};
document.addEventListener('click',e=>{for(const details of document.querySelectorAll('details[open]'))if(!details.contains(e.target))details.open=false;});
window.addEventListener('resize',()=>{document.querySelectorAll('details.filter[open]').forEach(x=>x.open=false);});
document.addEventListener('keydown',e=>{
  if(e.target.matches('input,textarea,select')||e.target.isContentEditable||e.ctrlKey||e.metaKey||e.altKey||e.repeat)return;
  if(!practicing)return;const key=e.key.toLowerCase();
  if(key==='escape'){e.preventDefault();back();return;}
  if(finished){if(key==='enter'){e.preventDefault();mode==='article'?shuffleAgain():start();}return;}
  if(key==='c'||key==='n'){e.preventDefault();const field=key==='c'?'favorite':'hidden',w=deck[index];store.set(w.id,{[field]:!C.flags(w,marks)[field]});}
  else if(mode==='article'&&['1','2','3'].includes(key)){e.preventDefault();answer(['der','die','das'][Number(key)-1]);}
  else if(mode==='normal'){if(key===' '){e.preventDefault();flip();}if(key==='arrowright'){e.preventDefault();next();}if(key==='arrowleft'&&index>0){e.preventDefault();index--;flipped=false;renderCard();}}
});
$('account').onclick=async()=>{try{if(store.user)await store.logout();else await store.login();}catch(e){notice(store.errorText(e));}};
$('retry').onclick=async()=>{try{await store.retry();}catch(e){notice(store.errorText(e));}};
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(marks,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=E('a');a.href=url;a.download='Wortkarten_jelolesek.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('import').onclick=()=>$('import-file').click();$('import-file').onchange=async()=>{try{const file=$('import-file').files[0];if(!file)return;if(file.size>10_000_000)throw Error('A jelölésfájl túl nagy.');const imported=C.importMarks(JSON.parse(await file.text()),[...data.de,...data.en]);store.import(imported);notice(Object.keys(imported).length+' jelölés importálva.');}catch(e){notice(e.message);}$('import-file').value='';};
async function load(){try{
  const results=await Promise.all(['de','en'].map(async lang=>{const response=await fetch('./data/'+lang+'.json');if(!response.ok)throw Error('A szókészlet nem tölthető be.');return [lang,await response.json()];}));
  data=Object.fromEntries(results);ready=true;
  store=new MarkStore(value=>{marks=value;scheduleRefresh();},value=>{$('sync-status').textContent=value;},user=>{
    if(practicing)back();$('account').textContent=user?'Kijelentkezés':'Bejelentkezés';$('account').title=user?.email??'Bejelentkezés Google-fiókkal';
    if(user)notice('Bejelentkezve: '+user.email+'. A helyi jelöléseket exportálással és importálással viheted át a fiókodba.');
  },notice);
  refresh();store.connect().catch(()=>{});
  if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
}catch(e){notice(e.message);$('loaded').textContent='Betöltési hiba';}}
load();
