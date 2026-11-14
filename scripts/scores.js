/* Daily scoreboard; only canonical game results determine winners and totals. */
(() => {
  const $=id=>document.getElementById(id);
  const node=(tag,copy,cls)=>{const n=document.createElement(tag);if(copy!==undefined)n.textContent=copy;if(cls)n.className=cls;return n;};
  const dateText=(date,options={weekday:'long',month:'long',day:'numeric'})=>new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{...options,timeZone:'UTC'});
  const shift=(date,n)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
  const validDate=date=>/^\d{4}-\d{2}-\d{2}$/.test(date||'')&&!Number.isNaN(Date.parse(date+'T12:00:00Z'))&&new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date;
  let games,clubs,dates,date,filter='',first,last,photos=[];
  const read=async path=>{const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error(path);return r.json();};
  function renderPhoto(){
    const figure=$('game-photo');figure.hidden=true;figure.replaceChildren();
    const entry=photos.find(p=>p.date===date&&(!filter||p.home===filter||p.away===filter)&&games.some(g=>g.date===date&&g.home===p.home&&g.away===p.away&&g.status==='final'));
    if(!entry)return;
    const img=document.createElement('img');img.alt=entry.alt;img.src=entry.image;img.width=1536;img.height=1024;img.decoding='async';
    img.onerror=()=>{if(figure.contains(img)){figure.hidden=true;figure.replaceChildren();}};
    const caption=node('figcaption'),label=node('p','From the diamond','photo-label');
    const text=node('p',entry.caption,'photo-caption');
    const meta=node('p',dateText(date,{month:'long',day:'numeric',year:'numeric'}),'photo-meta');
    const a=node('a','View box score →');a.href='box.html?'+new URLSearchParams({date,game:entry.away+'@'+entry.home});
    meta.append(document.createTextNode(' · '),a);caption.append(label,text,meta);figure.append(img,caption);figure.hidden=false;
  }
  function render(){
    renderPhoto();
    $('score-date').value=date;$('previous-day').disabled=date<=first;$('next-day').disabled=date>=last;
    $('slate-date').textContent=dateText(date);
    const slate=games.filter(g=>g.date===date&&(!filter||g.home===filter||g.away===filter));
    $('slate-count').textContent=`${slate.length} ${slate.length===1?'game':'games'}`;
    const grid=$('score-grid');grid.replaceChildren();
    $('scores-status').textContent='';
    if(!slate.length){const empty=node('div',undefined,'empty-slate');empty.append(node('h3','No games on this date'),node('p',filter?'This club has no game recorded for the selected date.':'Choose another date to explore the season.'));const back=node('button','Show latest games');back.type='button';back.onclick=()=>{date=(filter?games.filter(g=>g.home===filter||g.away===filter).map(g=>g.date).sort().at(-1):last)||last;render();};empty.append(back);grid.append(empty);}
    for(const g of slate){
      const card=node('article',undefined,'game-card');const final=g.status==='final';
      card.setAttribute('aria-label',`${clubs.get(g.away)?.team||g.away} at ${clubs.get(g.home)?.team||g.home}`);
      const top=node('div',undefined,'game-top');top.append(node('span',final?'Final':g.status==='scheduled'?'Scheduled':g.status||'Game','game-final'),node('span',g.phase==='postseason'?g.round+' · G'+g.gameNumber:'GLB · '+date.slice(0,4)));card.append(top);
      for(const side of ['away','home']){
        const slug=g[side],other=side==='away'?'home':'away',winner=final&&g[side+'Score']>g[other+'Score'];
        const row=node('div',undefined,'game-team'+(winner?' winner':'')),badge=node('span',(clubs.get(slug)?.team||slug).split(' ').map(s=>s[0]).join('').slice(0,3),'team-badge');
        const img=document.createElement('img');img.src=`team-${slug}-logo.png`;img.alt='';img.loading='lazy';img.onerror=()=>img.remove();if(slug!=='osaka-spirits')badge.append(img);
        const a=node('a',clubs.get(slug)?.team||slug);a.href='team.html?team='+encodeURIComponent(slug);a.append(node('small',side==='home'?'Home':'Away'));
        row.append(badge,a,node('strong',final?g[side+'Score']:'—','game-score'));card.append(row);
      }
      if(final){const a=node('a',undefined,'box-link');a.href='box.html?'+new URLSearchParams({date:g.date,game:`${g.away}@${g.home}`});a.setAttribute('aria-label',`Box score: ${clubs.get(g.away)?.team||g.away} at ${clubs.get(g.home)?.team||g.home}`);a.append(node('span','Box score'),node('span','→'));card.append(a);}else card.append(node('p','Result pending','season-note'));
      grid.append(card);
    }
    const strip=$('date-strip');strip.replaceChildren();
    for(let i=-3;i<=3;i++){const d=shift(date,i),b=node('button',dateText(d,{weekday:'short'}));b.type='button';b.append(node('strong',dateText(d,{day:'numeric'})));b.setAttribute('aria-label',dateText(d));if(d===date)b.setAttribute('aria-current','date');b.disabled=d<first||d>last;b.onclick=()=>{date=d;render();};strip.append(b);}
    const params=new URLSearchParams({date});if(filter)params.set('team',filter);history.replaceState(null,'','scores.html?'+params);
  }
  async function load(){try{
    [games,clubs,photos]=await Promise.all([Promise.all([read('data/season/games.json'),read('data/season/postseason-2026.json')]).then(([regular,post])=>[...regular,...post.games]),read('data/teams/teams.json'),read('data/score-photos.json').then(data=>Array.isArray(data)?data:[]).catch(()=>[])]);
    clubs=new Map(Object.values(clubs.divisions).flat().map(c=>[c.slug,c]));
    games=games.filter(g=>validDate(g.date));dates=[...new Set(games.map(g=>g.date))].sort();if(!dates.length)throw Error('No games');
    first=dates[0];last=dates.at(-1);const params=new URLSearchParams(location.search);date=validDate(params.get('date'))?params.get('date'):last;if(date<first||date>last)date=last;
    filter=clubs.has(params.get('team'))?params.get('team'):'';
    for(const c of [...clubs.values()].sort((a,b)=>a.team.localeCompare(b.team))){const option=node('option',c.team);option.value=c.slug;$('score-team').append(option);}
    $('score-team').value=filter;$('score-date').min=first;$('score-date').max=last;
    $('season-note').textContent=`2026 complete · Offseason · Results through ${dateText(last,{month:'long',day:'numeric',year:'numeric'})}. Osaka Spirits are GLB champions.`;
    for(const id of ['score-date','score-team','latest-day'])$(id).disabled=false;
    $('previous-day').onclick=()=>{if(date>first){date=shift(date,-1);render();}};$('next-day').onclick=()=>{if(date<last){date=shift(date,1);render();}};
    $('latest-day').onclick=()=>{date=last;render();};
    $('score-date').onchange=e=>{if(validDate(e.target.value)&&e.target.value>=first&&e.target.value<=last){date=e.target.value;render();}else e.target.value=date;};
    $('score-team').onchange=e=>{filter=e.target.value;render();};render();
  }catch(error){$('slate-date').textContent='Scores unavailable';$('scores-status').replaceChildren(node('p','The game record could not load. Please try again.'));const retry=node('button','Retry');retry.onclick=load;$('scores-status').append(retry);}}
  load();
})();
