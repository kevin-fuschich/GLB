const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
class Element {
 constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.attributes={};}
 append(...nodes){this.children.push(...nodes);} replaceChildren(...nodes){this.children=nodes;}
 setAttribute(k,v){this.attributes[k]=v;} querySelector(tag){for(const n of this.children){if(n.tag===tag)return n;const found=n.querySelector?.(tag);if(found)return found;}} focus(){this.focused=true;}
}
function setup(){const window={},document={createElement:tag=>new Element(tag)};vm.runInNewContext(fs.readFileSync(__dirname+'/../scripts/pack-reveal.js','utf8'),{window,document});return{api:window.GLBPackReveal,root:new Element('div')};}
test('individual reveal hides identity until activation; repeated activation never repeats completion',()=>{
 const{api,root}=setup();let calls=0,complete=0;
 const handle=api.mount(root,[{id:1},{id:2}],{renderCard:c=>{calls++;return new Element('article');},onComplete:()=>complete++});
 assert.equal(calls,0);const first=root.children[1].children[0].children[0];assert.equal(first.attributes['aria-label'],'Reveal card 1 of 2');first.onclick();first.onclick();assert.equal(calls,1);assert.equal(handle.revealedCount,1);assert.equal(complete,0);handle.revealAll();handle.revealAll();assert.equal(calls,2);assert.equal(complete,1);assert.equal(root.children[0].children[1].disabled,true);
});
test('reveal all enables card flip focus and inspect uses the exact assigned copy',()=>{
 const{api,root}=setup(),copy={copy_id:'assigned-copy'};let inspected;
 api.mount(root,[copy],{renderCard:()=>{const card=new Element('article');card.append(new Element('button'));return card;},onInspect:c=>inspected=c});
 root.children[0].children[1].onclick();const tile=root.children[1].children[0];assert.equal(tile.children[0].children[0].focused,true);tile.children[1].onclick();assert.equal(inspected,copy);
});
