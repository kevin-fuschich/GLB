const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
class Element{constructor(){this.children=[];this.dataset={};}append(...n){this.children.push(...n);}replaceChildren(...n){this.children=n;}setAttribute(){}}
test('sequential inspection keeps exact cards, supports revisits and completes only once',()=>{
 const window={},root=new Element(),seen=[];let completed=0;
 vm.runInNewContext(fs.readFileSync(__dirname+'/../scripts/pack-table.js','utf8'),{window,document:{createElement:()=>new Element()}});
 const copies=[{id:'a'},{id:'b'},{id:'c'}],handle=window.GLBPackTable.mount(root,copies,{renderCard:c=>{seen.push(c.id);return new Element();},onComplete:()=>completed++});
 const table=root.children[0],controls=table.children[2],[prev,next]=controls.children;
 assert.equal(handle.revealedCount,1);assert.equal(prev.disabled,true);next.onclick();assert.equal(handle.revealedCount,2);prev.onclick();assert.equal(handle.revealedCount,2);assert.equal(next.textContent,'Next card');next.onclick();next.onclick();assert.equal(completed,1);assert.equal(next.disabled,true);prev.onclick();next.onclick();assert.equal(completed,1);assert.deepEqual(seen,['a','b','a','b','c','b','c']);
});
