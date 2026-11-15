const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('pack opens directly to the shared cards; replay resets completion without a wrapper dialog',()=>{
 const nodes=new Map();let mounts=0;
 const get=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,focus(){},scrollIntoView(){}});return nodes.get(id);};
 vm.runInNewContext(fs.readFileSync(__dirname+'/../scripts/pack-preview.js','utf8'),{document:{getElementById:get},GLBPackTable:{mount(root,copies,options){mounts++;assert.equal(options.renderCard('copy'),'existing-card');}},GLBPackReveal:{card:(edition,copy)=>{assert.equal(edition,copy);return 'existing-card';}},sessionStorage:{setItem(){}},fetch:()=>new Promise(()=>{})});
 get('openSample').onclick();assert.equal(mounts,1);assert.equal(get('previewReveal').hidden,false);assert.equal(nodes.has('wrapperDialog'),false);get('previewComplete').hidden=false;get('replaySample').onclick();assert.equal(mounts,2);assert.equal(get('previewComplete').hidden,true);
});
