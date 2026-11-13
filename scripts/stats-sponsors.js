/* Club sponsor artwork, with user-controlled rotation and reduced-motion support. */
(() => {
 const slides=[...document.querySelectorAll('.sponsor-slide')];if(!slides.length)return;
 const previous=document.getElementById('sponsorPrevious'),next=document.getElementById('sponsorNext'),pause=document.getElementById('sponsorPause'),position=document.getElementById('sponsorPosition'),stage=document.querySelector('.stats-sponsors');
 const motion=matchMedia('(prefers-reduced-motion: reduce)');let index=0,paused=motion.matches,hovered=false,focused=false,timer;
 function show(n){index=(n+slides.length)%slides.length;slides.forEach((slide,i)=>{slide.hidden=i!==index;});position.textContent=String(index+1).padStart(2,'0')+' / '+String(slides.length).padStart(2,'0');}
 function schedule(){clearInterval(timer);pause.textContent=paused?'Start rotation':'Pause rotation';if(!paused&&!hovered&&!focused&&!document.hidden)timer=setInterval(()=>show(index+1),8000);}
 previous.addEventListener('click',()=>{show(index-1);schedule();});next.addEventListener('click',()=>{show(index+1);schedule();});pause.addEventListener('click',()=>{paused=!paused;schedule();});
 stage.addEventListener('mouseenter',()=>{hovered=true;schedule();});stage.addEventListener('mouseleave',()=>{hovered=false;schedule();});stage.addEventListener('focusin',()=>{focused=true;schedule();});stage.addEventListener('focusout',event=>{if(!stage.contains(event.relatedTarget)){focused=false;schedule();}});document.addEventListener('visibilitychange',schedule);motion.addEventListener('change',()=>{paused=motion.matches;schedule();});
 const select=document.getElementById('category');select.addEventListener('change',()=>{document.getElementById('leaderboardTitle').textContent=select.selectedOptions[0]?.textContent || 'League leaders';});
 show(0);schedule();
})();
