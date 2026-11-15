const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(variant,quantity=100,serial=1,physicalCopies){
 const surface={handlers:{},addEventListener(type,fn){this.handlers[type]=fn;},getBoundingClientRect:()=>({left:10,top:20,width:100,height:200})};
 const front={dataset:{},replaceChildren(n){this.children=[n];},children:[],append(n){this.children.push(n);}},back={dataset:{},replaceChildren(n){this.children=[n];},children:[],append(n){this.children.push(n);}};
 const window={},document={createElement:()=>({dataset:{},style:{values:{},setProperty(key,value){this.values[key]=value;}},append(){},setAttribute(){},querySelector:selector=>selector==='.fs-front'?front:selector==='.fs-back'?back:surface})};
 vm.runInNewContext(fs.readFileSync(__dirname+'/../scripts/pack-reveal.js','utf8'),{window,document,URL,location:{href:'https://globalleaguebaseball.com/book.html',origin:'https://globalleaguebaseball.com'},GLBPlayerCards:{createCard(){return {};}}});
 const wrap=window.GLBPackReveal.card({variant,quantity,facts:{player:{},record:{},physical_copies:physicalCopies}},{serial});return {surface,wrap,front,back};
}
test('refractor tracks light position, clamps outside values and releases on touch cancellation',()=>{
 const {surface,wrap}=setup('Refractor');surface.handlers.pointermove({clientX:35,clientY:170});assert.equal(wrap.style.values['--foil-x'],'25%');assert.equal(wrap.style.values['--foil-y'],'75%');assert.equal(wrap.dataset.foilActive,'true');surface.handlers.pointermove({clientX:-20,clientY:400});assert.equal(wrap.style.values['--foil-x'],'0%');assert.equal(wrap.style.values['--foil-y'],'100%');surface.handlers.pointerup({pointerType:'touch'});assert.equal(wrap.dataset.foilActive,undefined);surface.handlers.pointerdown({clientX:60,clientY:120});surface.handlers.pointercancel();assert.equal(wrap.dataset.foilActive,undefined);
});
test('base and gold do not receive optical coating interaction',()=>{for(const variant of ['Base','Gold'])assert.deepEqual(Object.keys(setup(variant).surface.handlers),[]);});

test('all editions /100 or rarer receive identical front and back stamped serials',()=>{
 for(const [variant,quantity,serial,expected] of [['Refractor',100,41,'41/100'],['Gold',25,7,'7/25'],['Black',5,3,'3/5']]){
  const {front,back,wrap}=setup(variant,quantity,serial);assert.equal(wrap.dataset.numbered,'true');assert.equal(front.children[0].textContent,expected);assert.equal(back.children[0].textContent,expected);
 }
 const base=setup('Base',1000,317);assert.equal(base.front.children.length,0);assert.equal(base.back.children.length,0);
});
test('black chrome uses the responsive light coating',()=>{const {surface,wrap}=setup('Black',5,3);surface.handlers.pointerdown({clientX:60,clientY:120});assert.equal(wrap.dataset.foilActive,'true');surface.handlers.pointerleave();assert.equal(wrap.dataset.foilActive,undefined);});

test('a photographed serial proof is only used for its exact individual copy',()=>{
 const proofs={'3':{front:'assets/fieldstock/proofs/iseul-kang-black-3-front.webp',back:'assets/fieldstock/proofs/iseul-kang-black-3-back.webp'}};
 const match=setup('Black',5,3,proofs);assert.equal(match.wrap.dataset.photoPrint,'true');assert.match(match.front.children[0].src,/black-3-front/);assert.equal(match.front.children.length,1);assert.equal(match.back.children.length,1);
 const different=setup('Black',5,4,proofs);assert.equal(different.wrap.dataset.photoPrint,undefined);assert.equal(different.front.children[0].textContent,'4/5');
});
