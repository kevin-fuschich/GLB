const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(){
 const nodes=new Map(),timers=new Map();let mounts=0,next=0;
 const get=id=>{if(!nodes.has(id)){const classes=new Set();nodes.set(id,{hidden:false,disabled:false,style:{setProperty(){},removeProperty(){}},classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)},events:{},addEventListener(k,v){this.events[k]=v;},setPointerCapture(){},getBoundingClientRect:()=>({width:240}),focus(){},scrollIntoView(){},showModal(){this.open=true;},close(){this.open=false;}});}return nodes.get(id);};
 vm.runInNewContext(fs.readFileSync(__dirname+'/../scripts/pack-preview.js','utf8'),{document:{getElementById:get},GLBPackReveal:{mount(){mounts++;}},sessionStorage:{setItem(){}},fetch:()=>new Promise(()=>{}),setTimeout:fn=>{timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id),matchMedia:()=>({matches:false})});
 return {get,timers,mounts:()=>mounts,fire:(type,x=0)=>get('tearWrapper').events[type]({pointerId:1,clientX:x,button:0,isPrimary:true}),tick(){for(const [id,fn] of timers){timers.delete(id);fn();}}};
}
test('tap and keyboard activation both open the wrapper',()=>{
 for(const detail of [0,1]){const s=setup();s.get('openSample').onclick();s.get('tearWrapper').onclick({detail});assert.equal(s.get('wrapperScene').classList.contains('is-torn'),true);}
});
test('skip cancels animation timer and replay starts sealed',()=>{
 const s=setup();s.get('openSample').onclick();s.get('tearWrapper').onclick({detail:0});s.get('wrapperSkip').onclick();assert.equal(s.timers.size,0);s.get('replaySample').onclick();assert.equal(s.get('wrapperScene').classList.contains('is-torn'),false);assert.equal(s.get('tearWrapper').disabled,false);
});

test('animation proceeds directly to cards without a second button',()=>{const s=setup();s.get('openSample').onclick();s.get('tearWrapper').onclick({detail:1});assert.equal(s.mounts(),0);s.tick();assert.equal(s.mounts(),1);assert.equal(s.get('wrapperDialog').open,false);});
