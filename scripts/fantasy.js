/* Replay fantasy uses canonical box-score results. No money, prizes or card credits. */
(() => {
 const $=id=>document.getElementById(id),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const client=window.GLBAuth?.client,params=new URLSearchParams(location.search);let rounds=[],round=null,ids=[],revealed=false,role='',page=0,roundEpoch=0,leagueEpoch=0,league=null,signedIn=false,authEpoch=0;
 const status=text=>{$('fantasyStatus').textContent=text;};const rpc=async(name,args)=>{if(!client)throw Error('Sign in on your account page to use a private league.');const r=await client.rpc(name,args);if(r.error)throw Error(r.error.message);return r.data;};
 const formatDate=date=>new Date(date+'T12:00:00Z').toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'});
 const store=()=>{try{localStorage.setItem('glb.nightshift.v1.'+round.id,JSON.stringify({ids,revealed}));}catch{}};
 const choice=()=>GLBFantasy.validate(round,ids);
 function playerLink(p){const a=el('a','Meet '+p.name+' →');a.href='player.html?'+new URLSearchParams({team:p.team_slug,player:p.id.split('/')[1]});return a;}
 function add(p){
  if(ids.includes(p.id)){ids=ids.filter(id=>id!==p.id);}else{
   const selected=ids.map(id=>round.pool.find(p=>p.id===id));
   if(p.role==='pitcher'){ids=ids.filter(id=>round.pool.find(p=>p.id===id)?.role!=='pitcher');}
   else if(selected.filter(p=>p.role==='hitter').length>=4){status('Your four hitter spots are filled. Remove one before adding another.');return;}
   if(ids.length>=5){status('Your lineup is full. Remove a player first.');return;}ids.push(p.id);
  }revealed=false;store();render();
 }
 function drawPool(){
  const q=$('playerSearch').value.trim().toLocaleLowerCase(),club=$('fantasyClub').value,filtered=round.pool.filter(p=>(!role||p.role===role)&&(!club||p.team_slug===club)&&(!q||`${p.name} ${p.team_name}`.toLocaleLowerCase().includes(q))).sort((a,b)=>a.name.localeCompare(b.name));
  const max=Math.max(1,Math.ceil(filtered.length/18));page=Math.min(page,max-1);$('poolPrevious').disabled=!page;$('poolNext').disabled=page+1>=max;$('poolPage').textContent=`${page+1} / ${max}`;$('poolCount').textContent=filtered.length+' players';
  $('playerPool').replaceChildren(...filtered.slice(page*18,page*18+18).map(p=>{
   const tile=el('article',undefined,'fantasy-player'+(ids.includes(p.id)?' selected':'')),photo=el('div',undefined,'fantasy-player-photo'),copy=el('div',undefined,'fantasy-player-copy');
   if(window.GLBPlayerCards&&p.photo)photo.append(GLBPlayerCards.photograph({name:p.name,teamSlug:p.team_slug,slug:p.id.split('/')[1],photo_source:p.photo,photo_crop:p.photo_crop,frozen_artwork:true}));else photo.append(el('span',p.name.split(' ').map(n=>n[0]).join('')));
   const value=el('p',undefined,'fantasy-player-cost');value.append(el('span','DRAFT VALUE'),el('strong',p.cost));const button=el('button',ids.includes(p.id)?'In your lineup':'Add '+(p.role==='pitcher'?'pitcher':'hitter'));button.type='button';button.setAttribute('aria-label',(ids.includes(p.id)?'Remove ':'Add ')+p.name);button.onclick=()=>add(p);
   copy.append(el('p',p.position,'fantasy-player-role'),el('h3',p.name),el('p',p.team_name,'fantasy-player-team'),value,button);tile.append(photo,copy);return tile;
  }));if(!filtered.length)$('playerPool').append(el('p','No players match that search.'));
 }
 function drawLineup(){
  const result=choice();$('draftBudget').textContent=`${result.cost} / ${round.budget}`;$('draftBudget').parentElement.classList.toggle('over',result.cost>round.budget);$('lineupValidation').textContent=result.valid?'Your five are ready. Run their night.':result.errors.join(' ');$('runNight').disabled=!result.valid;$('saveFantasyLineup').disabled=!result.valid||!league||!signedIn;
  const selected=result.players,slots=[selected.find(p=>p.role==='pitcher'),...selected.filter(p=>p.role==='hitter')];while(slots.length<5)slots.push(null);
  $('lineupSlots').replaceChildren(...slots.map((p,i)=>{const slot=el('div',undefined,'fantasy-slot'+(!p?' empty':''));if(!p){slot.textContent=i===0?'Your pitcher':'Hitter '+i;return slot;}const who=el('div');who.append(el('strong',p.name),el('small',p.team_name+' · '+p.cost));const remove=el('button','×');remove.type='button';remove.setAttribute('aria-label','Remove '+p.name+' from lineup');remove.onclick=()=>add(p);slot.append(who,remove);return slot;}));
  const url=new URL('fantasy.html',location.href);url.searchParams.set('round',round.id);if(ids.length)url.searchParams.set('lineup',ids.join(','));$('lineupShare').value=url.href;
 }
 function drawResults(){
  $('nightResults').hidden=!revealed;if(!revealed)return;const result=choice();$('nightTotal').textContent=result.points;$('nightResultIntro').textContent=`Your five on ${formatDate(round.game_date)}. Every point comes from the recorded GLB box scores.`;
  $('resultPlayers').replaceChildren(...result.players.map(p=>{const card=el('article',undefined,'fantasy-result');const stat=p.role==='pitcher'?`${p.line.IP_outs} outs · ${p.line.K} K · ${p.line.ER} ER${p.line.W?' · W':''}${p.line.SV?' · SV':''}`:`${p.line.H}/${p.line.AB} · ${p.line.HR} HR · ${p.line.RBI} RBI · ${p.line.R} R · ${p.line.SB} SB`;
   card.append(el('p',p.team_name,'book-eyebrow'),el('h3',p.name),el('strong',GLBFantasy.score(p.line,p.role)+' pts'),el('p',stat,'fantasy-stat-line'),el('p',p.note||'There is more to this player’s story. Meet the club and help add to the record.'),playerLink(p));const club=el('a','Visit '+p.team_name+' →');club.href='team.html?team='+encodeURIComponent(p.team_slug);card.append(club);return card;}));
  $('roundGames').replaceChildren(...round.games.map(g=>{const a=el('a',g.away+' at '+g.home+' →');a.href='box.html?'+new URLSearchParams({date:round.game_date,game:g.game_id.slice(round.game_date.length+1)});return a;}));
 }
 function render(){if(!round)return;drawLineup();drawPool();drawResults();}
 async function loadRound(){const ticket=++roundEpoch,meta=rounds.find(r=>r.id===$('roundSelect').value);if(!meta)return;
  try{status('Opening '+formatDate(meta.game_date)+'…');const response=await fetch('data/fantasy/'+meta.game_date+'.json');if(!response.ok)throw Error('This replay round could not load.');const data=await response.json();if(ticket!==roundEpoch)return;round=data;ids=[];revealed=false;page=0;
   let saved;try{saved=JSON.parse(localStorage.getItem('glb.nightshift.v1.'+round.id)||'null');}catch{}
   const fromLink=params.get('round')===round.id&&params.has('lineup')?params.get('lineup').split(',').slice(0,5):null;const selected=fromLink||saved?.ids||[];ids=[...new Set(Array.isArray(selected)?selected:[])].filter(id=>round.pool.some(p=>p.id===id)).slice(0,5);revealed=!!saved?.revealed&&!fromLink&&choice().valid;
   const entry=league?.my_entries?.find(e=>e.round_id===round.id);if(entry&&!fromLink){ids=entry.lineup;revealed=true;}
   $('fantasyClub').replaceChildren(new Option('All clubs',''),...[...new Map(round.pool.map(p=>[p.team_slug,p.team_name])).entries()].sort((a,b)=>a[1].localeCompare(b[1])).map(([id,name])=>new Option(name,id)));
   $('draftArea').hidden=false;render();status(`Replay ${formatDate(round.game_date)} · choose players from all 16 clubs. Your draft stays on this device until you save it to a league.`);
  }catch(error){if(ticket===roundEpoch)status(error.message);}
 }
 async function loadLeague(){const ticket=++leagueEpoch,id=$('fantasyLeague').value;league=null;$('fantasyLeagueRoom').hidden=true;if(!id){if(round)render();return;}
  try{const data=await rpc('glb_fantasy_league',{p_league:id});if(ticket!==leagueEpoch||!signedIn)return;league=data;$('fantasyLeagueTitle').textContent=data.title;const invite=new URL('fantasy.html',location.href);invite.searchParams.set('join',data.invite_code);$('fantasyInvite').value=invite.href;
   $('fantasyStandings').replaceChildren(...data.leaderboard.map(row=>{const tr=el('tr');tr.append(el('td','@'+row.user_id),el('td',row.points),el('td',row.rounds));return tr;}));$('fantasyLeagueRoom').hidden=false;
   const entry=round&&data.my_entries.find(e=>e.round_id===round.id);if(entry){ids=entry.lineup;revealed=true;}if(round)render();
  }catch(error){status(error.message);}
 }
 async function loadLeagues(selected=''){
  if(!client)return;const ticket=authEpoch;try{const {data:{user}}=await client.auth.getUser();if(ticket!==authEpoch)return;signedIn=!!user;if(!user){$('fantasyAuthStatus').textContent='You can play solo now. Sign in on your account page to create or join a private league.';return;}
   const list=await rpc('glb_fantasy_home');if(ticket!==authEpoch)return;$('fantasyLeague').replaceChildren(new Option('Solo practice',''),...list.map(l=>new Option(`${l.title} · ${l.members} collector${l.members===1?'':'s'}`,l.id)));$('fantasyLeague').value=selected;$('fantasyAuthStatus').textContent='Signed in. Your league invitations and scores stay within the group.';if(selected)await loadLeague();
  }catch(error){$('fantasyAuthStatus').textContent=error.message;}
 }
 $('roundSelect').onchange=loadRound;$('fantasyLeague').onchange=loadLeague;
 for(const [id,value]of [['allRoles',''],['hitterRoles','hitter'],['pitcherRoles','pitcher']])$(id).onclick=()=>{role=value;page=0;for(const other of ['allRoles','hitterRoles','pitcherRoles'])$(other).setAttribute('aria-pressed',String(other===id));drawPool();};
 $('playerSearch').addEventListener('input',()=>{page=0;drawPool();});$('fantasyClub').onchange=()=>{page=0;drawPool();};$('poolPrevious').onclick=()=>{page--;drawPool();};$('poolNext').onclick=()=>{page++;drawPool();};
 $('runNight').onclick=()=>{if(!choice().valid)return;revealed=true;store();drawResults();$('nightResults').scrollIntoView({block:'start'});};$('clearLineup').onclick=()=>{ids=[];revealed=false;store();render();};
 $('saveFantasyLineup').onclick=async()=>{if(!league||!choice().valid)return;const button=$('saveFantasyLineup');button.disabled=true;const selectedLeague=league.id,selectedRound=round.id,selectedPlayers=[...ids];try{const points=await rpc('glb_fantasy_save',{p_league:selectedLeague,p_round:selectedRound,p_players:selectedPlayers});status(`Lineup saved to your league: ${points} practice points.`);revealed=true;store();await loadLeague();}catch(error){status(error.message);}finally{if(round)drawLineup();}};
 $('openLeagueTools').onclick=()=>{$('leagueTools').hidden=!$('leagueTools').hidden;};
 $('createLeagueForm').onsubmit=async event=>{event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;try{const id=await rpc('glb_fantasy_create',{p_name:$('leagueName').value});await loadLeagues(id);status('Your private replay league is ready. Share its invitation link with your friends.');}catch(error){status(error.message);}finally{button.disabled=false;}};
 $('joinLeagueForm').onsubmit=async event=>{event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;try{const id=await rpc('glb_fantasy_join',{p_code:$('leagueCode').value.trim().toUpperCase()});if(!id)throw Error('That invitation was not found, or too many invitations were tried. Check the code and try again in a few minutes.');await loadLeagues(id);status('You joined the league. Build your five and save the lineup to compare practice scores.');}catch(error){status(error.message);}finally{button.disabled=false;}};
 if(client)client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){authEpoch++;signedIn=false;league=null;leagueEpoch++;$('fantasyLeagueRoom').hidden=true;$('fantasyStandings').replaceChildren();$('fantasyInvite').value='';$('fantasyLeague').replaceChildren(new Option('Solo practice',''));if(round)drawLineup();$('fantasyAuthStatus').textContent='Sign in to use a private league.';}});
 (async()=>{try{const response=await fetch('data/fantasy/rounds.json');if(!response.ok)throw Error('The replay room could not load.');rounds=await response.json();$('roundSelect').replaceChildren(...rounds.map(r=>new Option(formatDate(r.game_date),r.id)));if(rounds.some(r=>r.id===params.get('round')))$('roundSelect').value=params.get('round');$('roundSelect').disabled=false;if(params.get('join')){$('leagueCode').value=params.get('join').slice(0,12);$('leagueTools').hidden=false;}await Promise.all([loadRound(),loadLeagues()]);}catch(error){status(error.message);}})();
})();
