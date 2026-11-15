const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(variant){
 const surface={handlers:{},addEventListener(type,fn){this.handlers[type]=fn;},getBoundingClientRect:()=>({left:10,top:20,width:100,height:200})};
 const window={},document={createElement:()=>({dataset:{},style:{values:{},setProperty(key,value){this.values[key]=value;}},append(){},querySelector:()=>surface})};
 vm.runInNewContext(fs.readFileSync(__dirname+'/../scripts/pack-reveal.js','utf8'),{window,document,GLBPlayerCards:{createCard(){return {};}}});
 const wrap=window.GLBPackReveal.card({variant,quantity:100,facts:{player:{},record:{}}},{serial:1});return {surface,wrap};
}
test('refractor tracks light position, clamps outside values and releases on touch cancellation',()=>{
 const {surface,wrap}=setup('Refractor');surface.handlers.pointermove({clientX:35,clientY:170});assert.equal(wrap.style.values['--foil-x'],'25%');assert.equal(wrap.style.values['--foil-y'],'75%');assert.equal(wrap.dataset.foilActive,'true');surface.handlers.pointermove({clientX:-20,clientY:400});assert.equal(wrap.style.values['--foil-x'],'0%');assert.equal(wrap.style.values['--foil-y'],'100%');surface.handlers.pointerup({pointerType:'touch'});assert.equal(wrap.dataset.foilActive,undefined);surface.handlers.pointerdown({clientX:60,clientY:120});surface.handlers.pointercancel();assert.equal(wrap.dataset.foilActive,undefined);
});
test('base, gold and black do not receive refractor interaction',()=>{for(const variant of ['Base','Gold','Black'])assert.deepEqual(Object.keys(setup(variant).surface.handlers),[]);});
