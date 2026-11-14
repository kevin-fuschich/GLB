const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const test=require('node:test');
const source=fs.readFileSync(require('node:path').join(__dirname,'../scripts/profile.js'),'utf8');
class Element{
 constructor(tag='div'){this.tagName=tag;this.children=[];this.value='';this.hidden=true;this.dataset={};this.files=[];}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;}
 querySelectorAll(){return this.children.flatMap(n=>n.children||[]).filter(n=>n.checked);}
}
async function fixture(){
 const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
 const profile={owner_id:'member-one',display_name:'Original name',theme:'navy',published:false};
 const saves=[],decodes=[],queued=[];let onAuth,saveError=false;
 const rows={glb_profiles:{user_id:'member_one'},glb_showcases:profile,glb_editions:[],glb_claims:[],glb_notes:[]};
 const client={auth:{getUser:async()=>({data:{user:{id:'member-one'}}}),onAuthStateChange:callback=>{onAuth=callback;}},rpc:async()=>({data:[]}),from:table=>{
  let saved;const query={select(){return this;},eq(){return this;},maybeSingle:async()=>({data:rows[table]}),then(resolve){return Promise.resolve({data:rows[table]}).then(resolve);},upsert(row){saved=row;saves.push(row);return this;},single:async()=>saveError?{data:null,error:{message:'Save rejected'}}:{data:{owner_id:saved.owner_id}}};return query;
 }};
 const ContextURL=class extends URL{};ContextURL.createObjectURL=()=> 'blob:photo';ContextURL.revokeObjectURL=()=>{};
 const document={getElementById:get,createElement(tag){const n=new Element(tag);if(tag==='canvas'){n.getContext=()=>({drawImage(){}});n.toDataURL=()=> 'data:image/webp;base64,AQ==';}return n;}};
 const context={window:{GLBAuth:{client}},document,location:new URL('https://globalleaguebaseball.com/profile.html'),URL:ContextURL,URLSearchParams,Option:class extends Element{constructor(text,value){super('option');this.textContent=text;this.value=value;}},Image:class{constructor(){this.width=400;this.height=600;}decode(){return new Promise(resolve=>decodes.push(resolve));}},setTimeout:fn=>queued.push(fn),fetch:async()=>({ok:true,json:async()=>({divisions:{one:[{slug:'osaka-spirits',team:'Osaka Spirits'}]}})})};
 vm.runInNewContext(source,context);const settle=async()=>{for(let i=0;i<4;i++)await new Promise(setImmediate);};await settle();
 return {get,saves,decodes,settle,onAuth:(...args)=>onAuth(...args),queued,setSaveError:()=>{saveError=true;}};
}
test('same-account sign-in keeps unsaved profile edits and photos',async()=>{
 const f=await fixture();f.get('displayName').value='Unsaved edit';f.get('avatarData').value='data:image/webp;base64,AQ==';
 f.onAuth('SIGNED_IN',{user:{id:'member-one'}});await f.settle();
 assert.equal(f.queued.length,0);assert.equal(f.get('displayName').value,'Unsaved edit');assert.equal(f.get('avatarData').value,'data:image/webp;base64,AQ==');
});
test('photo processing blocks saves and removing it cancels late completion',async()=>{
 const f=await fixture();const input=f.get('avatarFile');input.files=[{type:'image/png',size:1000}];
 const processing=input.onchange({target:input});assert.equal(f.get('saveProfile').disabled,true);
 await f.get('customizeForm').onsubmit({preventDefault(){}});assert.equal(f.saves.length,0);
 f.get('removeAvatar').onclick();f.decodes.shift()();await processing;
 assert.equal(f.get('avatarData').value,'');assert.equal(f.get('saveProfile').disabled,false);
});
test('a superseded photo cannot replace the newest selection',async()=>{
 const f=await fixture(),input=f.get('avatarFile');input.files=[{type:'image/png',size:1000}];
 const first=input.onchange({target:input});const second=input.onchange({target:input});
 f.decodes[0]();await first;assert.equal(f.get('avatarData').value,'');assert.equal(f.get('saveProfile').disabled,true);
 f.decodes[1]();await second;assert.equal(f.get('avatarData').value,'data:image/webp;base64,AQ==');assert.equal(f.get('saveProfile').disabled,false);
});
test('confirmed saves preserve customization and publish/unpublish states',async()=>{
 const f=await fixture();f.get('displayName').value=' My name ';f.get('bio').value=' A story ';f.get('theme').value='forest';f.get('club').value='osaka-spirits';f.get('publish').checked=true;
 await f.get('customizeForm').onsubmit({preventDefault(){}});
 assert.equal(f.saves[0].display_name,'My name');assert.equal(f.saves[0].bio,'A story');assert.equal(f.saves[0].theme,'forest');assert.equal(f.saves[0].published,true);assert.equal(f.get('publicLink').hidden,false);
 f.get('publish').checked=false;await f.get('customizeForm').onsubmit({preventDefault(){}});
 assert.equal(f.saves[1].published,false);assert.equal(f.get('publicLink').hidden,true);
 assert.equal(f.get('saveProfile').disabled,false);
});
test('failed saves retain edits and never announce success',async()=>{
 const f=await fixture();f.get('displayName').value='Keep this';f.setSaveError();await f.get('customizeForm').onsubmit({preventDefault(){}});
 assert.equal(f.get('displayName').value,'Keep this');assert.match(f.get('profileStatus').textContent,/could not be saved/);assert.equal(f.get('saveProfile').disabled,false);
});
