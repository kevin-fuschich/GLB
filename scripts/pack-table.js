/* Pack inspection only; inventory and ownership remain outside this preview. */
(() => {
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 function mount(root,copies,{renderCard,onComplete=()=>{},savedMessage=''}={}){
  let index=0,seen=0,completed=false;
  const table=el('section',null,'pack-table'),status=el('p',null,'pack-table-status'),stage=el('div',null,'pack-table-stage'),controls=el('div',null,'pack-table-controls'),previous=el('button','Previous card'),next=el('button','Reveal next card'),note=el('p',savedMessage,'pack-table-note');
  status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  previous.type=next.type='button';controls.append(previous,next);table.append(status,stage,controls,note);root.replaceChildren(table);
  function show(){
   seen=Math.max(seen,index+1);status.textContent=`Card ${index+1} of ${copies.length}`;
   const card=renderCard(copies[index]);stage.replaceChildren(card);stage.dataset.remaining=String(copies.length-index-1);
   previous.disabled=index===0;next.disabled=index===copies.length-1;next.textContent=index+1<seen?'Next card':'Reveal next card';
   if(index===copies.length-1)next.textContent='All cards revealed';
   if(seen===copies.length&&!completed){completed=true;onComplete();}
  }
  previous.onclick=()=>{if(index>0){index--;show();}};
  next.onclick=()=>{if(index<copies.length-1){index++;show();}};
  show();return {get revealedCount(){return seen;}};
 }
 window.GLBPackTable={mount};
})();
