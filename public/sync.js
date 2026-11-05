import {firebaseConfig} from './config.js';
import {overlay, acknowledge} from './sync-state.js';

export class MarkStore {
  constructor(onChange,onStatus,onAccount,onError) {
    Object.assign(this,{onChange,onStatus,onAccount,onError,user:null,scope:'guest',pending:{},remote:{},marks:{},busy:false,generation:0,ready:false});
    this.load(); this.emit();
    window.addEventListener('online',()=>{this.flush();});
    window.addEventListener('offline',()=>this.status());
    this.retryTimer=setInterval(()=>{if(Object.keys(this.pending).length)this.flush();},15000);
  }
  key(){return 'wortkarten-marks-v1:'+this.scope;}
  load(){try {const saved=JSON.parse(localStorage.getItem(this.key())||'{}');this.remote=saved.remote??{};this.pending=saved.pending??{};}catch{this.remote={};this.pending={};}this.marks=overlay(this.remote,this.pending);}
  save(){try {localStorage.setItem(this.key(),JSON.stringify({remote:this.remote,pending:this.pending}));}catch{this.onError('A böngésző nem tudja menteni a jelöléseket. Exportáld őket a ••• menüből.');}}
  emit(){this.marks=overlay(this.remote,this.pending);this.save();this.onChange(this.marks);this.status();}
  status(){this.onStatus(!this.user?'Jelölések ezen az eszközön':!navigator.onLine?'Offline · szinkronizálás kapcsolódáskor':Object.keys(this.pending).length?'Mentés folyamatban…':!this.ready?'Kapcsolódás a felhőhöz…':'Jelölések szinkronizálva');}
  async connect(){
    if(this.connecting)return this.connecting;
    if(this.auth)return;
    this.connecting=this.initialize().catch(error=>{this.onError('A felhőkapcsolat nem érhető el. A helyi gyakorlás továbbra is működik.');throw error;}).finally(()=>{this.connecting=null;});
    return this.connecting;
  }
  async initialize(){
    const base='https://www.gstatic.com/firebasejs/12.19.0/';
    const [app,auth,fire]=await Promise.all([import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-firestore.js')]);
    this.A=auth;this.F=fire;
    const instance=app.initializeApp(firebaseConfig);
    this.auth=auth.getAuth(instance);this.db=fire.getFirestore(instance);
    await auth.setPersistence(this.auth,auth.browserLocalPersistence);
    auth.onAuthStateChanged(this.auth,user=>{
      this.stop?.(); const gen=++this.generation;this.busy=false;this.ready=false;
      this.user=user;this.scope=user?.uid??'guest';this.load();this.onAccount(user);this.emit();
      if(!user)return;
      this.listen(gen);
    });
    const redirected=await auth.getRedirectResult(this.auth).catch(e=>{this.onError(this.errorText(e));return null;});
    return redirected;
  }
  listen(gen){
    const F=this.F;
    this.stop?.();
    this.stop=F.onSnapshot(F.collection(this.db,'users',this.user.uid,'marks'),{includeMetadataChanges:true},snapshot=>{
      if(gen!==this.generation)return;
      // Do not erase the durable cache with an empty initial memory-cache snapshot.
      if(snapshot.metadata.fromCache&&!snapshot.docs.length&&!this.ready)return;
      const remote={};for(const doc of snapshot.docs){const f=doc.data();remote[doc.id]={favorite:f.favorite===true,hidden:f.hidden===true};}
      this.remote=remote;
      if(!snapshot.metadata.fromCache)this.ready=true;
      this.emit();this.flush();
    },error=>{this.ready=false;this.onStatus('Szinkronizálási hiba');this.onError(this.errorText(error));});
  }
  errorText(e){
    if(e.code==='permission-denied')return 'A Firestore hozzáférési szabályai még nem engedik a szinkronizálást. A jelöléseid helyben mentve maradnak.';
    if(e.code==='auth/unauthorized-domain')return 'Ezt a webcímet még engedélyezni kell a Firebase Authentication → Settings → Authorized domains alatt.';
    if(e.code==='auth/popup-closed-by-user'||e.code==='auth/cancelled-popup-request')return 'A bejelentkezés megszakadt.';
    if(e.code==='auth/operation-not-allowed')return 'Engedélyezd a Google-bejelentkezést a Firebase Authentication beállításainál.';
    return 'Nem sikerült kapcsolódni a Firebase-hoz ('+(e.code??'hálózati hiba')+'). A jelöléseid helyben mentve maradnak.';
  }
  async login(){
    await this.connect();
    const provider=new this.A.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
    try{await this.A.signInWithPopup(this.auth,provider);}catch(e){
      if(e.code==='auth/popup-blocked')await this.A.signInWithRedirect(this.auth,provider);
      else this.onError(this.errorText(e));
    }
  }
  async logout(){if(Object.keys(this.pending).length){this.onError('Még vannak fel nem töltött jelölések. Várd meg a szinkronizálást, vagy exportáld őket.');return;}await this.A.signOut(this.auth);}
  set(id,patch){
    if(this.scope==='guest'){this.remote[id]={favorite:false,hidden:false,...this.remote[id],...patch};}
    else {this.pending[id]??={};for(const [field,value] of Object.entries(patch))this.pending[id][field]={value,token:crypto.randomUUID()};}
    this.emit();void this.flush();
  }
  import(values){
    for(const [id,patch] of Object.entries(values)){
      if(this.scope==='guest')this.remote[id]=patch;
      else{this.pending[id]??={};for(const [field,value] of Object.entries(patch))this.pending[id][field]={value,token:crypto.randomUUID()};}
    }
    this.emit();void this.flush();
  }
  async retry(){await this.connect();if(this.user)this.listen(this.generation);}
  async flush(){
    if(this.busy||!this.user||!this.ready||!navigator.onLine||!Object.keys(this.pending).length)return;
    this.busy=true;const gen=this.generation,uid=this.user.uid;
    try{
      while(gen===this.generation&&Object.keys(this.pending).length){
        const sent=structuredClone(Object.fromEntries(Object.entries(this.pending).slice(0,400)));
        const batch=this.F.writeBatch(this.db);
        for(const [id,fields] of Object.entries(sent))batch.set(this.F.doc(this.db,'users',uid,'marks',id),{...Object.fromEntries(Object.entries(fields).map(([key,op])=>[key,op.value])),updatedAt:this.F.serverTimestamp()},{merge:true});
        await batch.commit();if(gen!==this.generation)return;
        for(const [id,fields] of Object.entries(sent)){this.remote[id]??={favorite:false,hidden:false};for(const [field,op]of Object.entries(fields))this.remote[id][field]=op.value;}
        this.pending=acknowledge(this.pending,sent);this.emit();
      }
    }catch(e){if(gen===this.generation){this.onError(this.errorText(e));this.onStatus('Helyben mentve · feltöltésre vár');}}
    finally{if(gen===this.generation)this.busy=false;}
  }
}
