/* Owned copies come from the server. The sample route never mutates an account. */
(() => {
 const $=id=>document.getElementById(id),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const client=window.GLBAuth?.client,params=new URLSearchParams(location.search),sample=params.get('sample')==='1',publicUser=params.get('user');
 let cards=[],page=0,owner=false,handle='',profile=null,epoch=0,showcaseExists=false;
 const status=t=>{$('bookStatus').textContent=t;};
 const rpc=async(name,args)=>{if(!client)throw Error('Sign in to use your collection.');const r=await client.rpc(name,args);if(r.error)throw Error(r.error.message);return r.data;};
 function safeImage(path){const u=new URL(path,location.href);if(u.origin!==location.origin||!['http:','https:'].includes(u.protocol))throw Error('Artwork unavailable');return u.href;}
 function edition(copy){return copy.edition||copy;}
 function title(copy){const e=edition(copy);if(e.subset)return [e.name,e.subset,e.id].join(' · ');return `${e.name} · ${e.variant} · ${copy.serial}/${e.quantity}`;}
 function cardView(copy,inspect=false){
  const e=edition(copy);let root;
  if(e.print){root=FieldstockSubsets.card(e);}
  else if(e.facts?.player&&window.GLBPackReveal){root=GLBPackReveal.card(e,copy);}
  else{root=el('div',undefined,'book-sample-card');const button=el('button'),img=el('img');button.type='button';let back=false;
   try{img.src=safeImage(e.facts?.physical_copies?.[String(copy.serial)]?.front||(e.quantity>100?e.facts?.photographic_master?.front:null)||e.front_image);}catch{img.alt='Card artwork unavailable';}
   img.alt=title(copy);button.setAttribute('aria-label','Turn over '+title(copy));
   button.onclick=()=>{back=!back;const printed=e.facts?.physical_copies?.[String(copy.serial)]||(e.quantity>100?e.facts?.photographic_master:null),path=back?(printed?.back||e.back_image):(printed?.front||e.front_image);if(path)img.src=safeImage(path);else{back=false;status('A printed back is being prepared for this card.');}};button.append(img);root.append(button);
  }
  if(inspect){const button=root.querySelector('button');if(button){button.setAttribute('aria-label','Inspect '+title(copy));button.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();detail(copy);},true);}}
  return root;
 }
 function draw(){
  const q=$('bookSearch').value.trim().toLocaleLowerCase(),variant=$('bookVariant').value;
  const filtered=cards.filter(c=>{const e=edition(c);return(!$('bookSubset').value||(e.subset||'Baseball')===$('bookSubset').value)&&(!q||`${e.name} ${e.variant} ${e.facts?.player?.teamName||''}`.toLocaleLowerCase().includes(q))&&(!variant||e.variant===variant)&&(!$('tradeOnly').checked||c.available);});
  const max=Math.max(1,Math.ceil(filtered.length/9));page=Math.min(page,max-1);$('bookPrevious').disabled=page===0;$('bookNext').disabled=page+1>=max;$('bookPageLabel').textContent=`Page ${page+1} of ${max}`;
  $('bookSummary').textContent=`${filtered.length} ${sample?'sample ':''}card${filtered.length===1?'':'s'} · Select a card to inspect its front and back.`;
  $('bookCount').textContent=`${cards.length} ${sample?'sample ':''}cards`;$('bookEditionCount').textContent=`${new Set(cards.map(c=>edition(c).id||edition(c).edition_id)).size} editions`;$('bookTradeCount').textContent=`${cards.filter(c=>c.available).length} for trade`;
  const pockets=[];for(let i=0;i<9;i++){const c=filtered[page*9+i],pocket=el('article',undefined,'book-pocket');
   if(c){pocket.append(cardView(c,true),el('p',edition(c).name,'book-pocket-name'),el('p',edition(c).subset || `${edition(c).variant} · ${c.serial}/${edition(c).quantity}`,'book-pocket-caption'));if(c.available)pocket.append(el('span','Available for trade','book-available'));}
   else{pocket.classList.add('empty');pocket.append(el('span',filtered.length?'Open pocket':'No cards here yet'));}pockets.push(pocket);
  }$('bookPockets').replaceChildren(...pockets);$('bookPages').hidden=false;
 }
 function cover(data={}){
  $('bookCover').dataset.theme=['navy','forest','oxblood','sand'].includes(data.theme)?data.theme:'forest';
  $('bookTitle').textContent=data.display_name?`${data.display_name}’s collection`:'Collector’s book';
  $('bookOwner').textContent=data.user_id?'@'+data.user_id+' · FIELDSTOCK collector':sample?'A sample collector’s book':'FIELDSTOCK 2026';
  $('bookBio').textContent=data.bio||'';
 }
 function close(){ $('bookCardDialog').close();$('bookCardImage').replaceChildren();$('bookCardActions').replaceChildren();$('bookCardFeedback').textContent=''; }
 async function detail(copy){
  $('bookCardTitle').textContent=edition(copy).name;$('bookCardImage').replaceChildren(cardView(copy));$('bookCardInfo').textContent=title(copy);$('bookCardFeedback').textContent='';const actions=$('bookCardActions');actions.replaceChildren();
  const player=edition(copy).facts?.player;if(player?.teamSlug&&player?.slug){const link=el('a','Meet the player and add to the record →');link.href='player.html?'+new URLSearchParams({team:player.teamSlug,player:player.slug});actions.append(link);
   if(player.card_id){const checklist=el('a','Compare this player’s editions →');checklist.href='set-checklist.html?'+new URLSearchParams({card:player.card_id,edition:edition(copy).variant});actions.append(checklist);}
   const replay=el('a','Pick this player in GLB Fantasy →');replay.href='fantasy.html?'+new URLSearchParams({player:player.teamSlug+'/'+player.slug});actions.append(replay);
  }
  if(sample){actions.append(el('p','This is a sample copy. Trade listings and offers are available in your own book.','book-inline-status'));}
  else if(owner){
   const check=el('input');check.type='checkbox';check.checked=!!copy.available;const label=el('label',undefined,'check-row');label.append(check,el('span','Make this copy available for trade'));
   const note=el('textarea');note.maxLength=250;note.rows=2;note.value=copy.wanted||'';note.placeholder='What would you like in return?';const noteLabel=el('label','Trade note');noteLabel.append(note);const save=el('button','Save trade status');save.type='button';
   save.onclick=async()=>{save.disabled=true;try{await rpc('glb_set_trade_listing',{p_copy:copy.copy_id,p_available:check.checked,p_wanted:note.value});copy.available=check.checked;copy.wanted=note.value;draw();$('bookCardFeedback').textContent=copy.available?'Marked for trade. Your book must be public for other collectors to see the listing.':'This copy is no longer listed for trade.';}catch(error){$('bookCardFeedback').textContent=error.message;}finally{save.disabled=false;}};
   actions.append(label,noteLabel,save);
   const secrets=el('details'),summary=el('summary','Private ownership code'),code=el('p'),reveal=el('button','Show my private code');reveal.type='button';code.className='book-private-code';reveal.onclick=async()=>{reveal.disabled=true;try{code.textContent=await rpc('glb_card_secret',{p_copy:copy.copy_id})||'This copy is no longer in your collection.';}catch(error){code.textContent=error.message;}finally{reveal.disabled=false;}};secrets.append(summary,el('p','Keep this code private. It changes when ownership changes.','book-inline-status'),reveal,code);actions.append(secrets);
  }else if(copy.available){
   const offer=el('button','Offer a card in exchange');offer.type='button';offer.onclick=()=>offerCard(copy);actions.append(el('p',copy.wanted||'This collector is open to offers.'),offer);
  }
  if(!$('bookCardDialog').open)$('bookCardDialog').showModal();
 }
 async function offerCard(target){
  const actions=$('bookCardActions'),feedback=$('bookCardFeedback');feedback.textContent='Loading your copies…';
  try{const {data:{user}}=await client.auth.getUser();if(!user)throw Error('Sign in on your account page to make an offer.');
   const [mine,result]=await Promise.all([rpc('glb_my_album'),client.from('glb_editions').select('*')]);if(result.error)throw result.error;
   const editions=new Map(result.data.map(e=>[e.id,e]));const choices=mine.filter(c=>c.copy_id!==target.copy_id&&editions.has(c.edition_id));if(!choices.length)throw Error('You need a collected card to offer in exchange.');
   const select=el('select');select.setAttribute('aria-label','Your offered card');for(const c of choices){const e=editions.get(c.edition_id);select.append(new Option(`${e.name} · ${e.variant} · ${c.serial}/${e.quantity}`,c.copy_id));}
   const button=el('button','Send this trade offer');button.type='button';button.onclick=async()=>{button.disabled=true;try{await rpc('glb_propose_trade',{p_offered:select.value,p_wanted:target.copy_id});feedback.textContent='Offer sent. The collector can accept or decline it in Trade offers. It expires in 48 hours.';}catch(error){feedback.textContent=error.message;button.disabled=false;}};
   actions.replaceChildren(el('p','You are requesting '+title(target)+'. Choose one of your copies to offer. Neither copy changes hands until the offer is accepted.'),select,button);feedback.textContent='A recent sign-in is required to send an offer.';
  }catch(error){feedback.textContent=error.message;}
 }
 async function offers(){
  const ticket=epoch,rows=await rpc('glb_my_trade_offers');if(ticket!==epoch||!owner)return;const root=$('offerList');root.replaceChildren();
  for(const offer of rows){const row=el('article',undefined,'book-offer'),content=el('div');content.append(el('strong',`${offer.sender} → ${offer.recipient}`),el('p',`${offer.offered.name} (${offer.offered.variant} ${offer.offered.serial}/${offer.offered.quantity}) ↔ ${offer.wanted.name} (${offer.wanted.variant} ${offer.wanted.serial}/${offer.wanted.quantity})`),el('p',offer.status==='pending'?`Waiting · expires ${new Date(offer.expires_at).toLocaleString()}`:offer.status));row.append(content);
   if(offer.status==='pending'){for(const action of offer.incoming?['accept','decline']:['cancel']){const button=el('button',action==='accept'?'Accept exchange':action==='decline'?'Decline':'Cancel offer');button.type='button';button.onclick=async()=>{button.disabled=true;try{const ok=await rpc('glb_respond_trade',{p_offer:offer.id,p_action:action});status(ok?(action==='accept'?'Trade complete. Both copies have changed hands.':'Offer updated.'):'This offer is no longer available.');await load();}catch(error){status(error.message);button.disabled=false;}};row.append(button);}}root.append(row);
  }if(!rows.length)root.append(el('p','No trade offers yet. Mark a copy for trade or visit the trading room.'));$('bookOffers').hidden=false;
 }
 async function shop(){
  const ticket=epoch,hub=await rpc('glb_collection_hub');if(ticket!==epoch||!owner)return;
  $('bookCreditBalance').textContent=hub.balance;const root=$('bookPackCatalog');root.replaceChildren();
  const releasedSets = hub.catalog.filter(set => set.released);
  for(const set of releasedSets){
   const tile=el('article',undefined,'book-pack'),img=el('img'),button=el('button',set.available_packs<1?'All packs claimed':hub.balance<set.cost ? 'Need '+(set.cost-hub.balance)+' more credits' :`Get pack · ${set.cost} credits`);img.src='assets/fieldstock/2026-base-pack.webp';img.alt=set.title+' unopened pack';button.type='button';button.disabled=!set.released||set.available_packs<1||hub.balance<set.cost;let request=null;
   button.onclick=async()=>{button.disabled=true;request=request||crypto.randomUUID();try{await rpc('glb_buy_pack',{p_set:set.id,p_request:request});request=null;await Promise.all([shop(),packs()]);status('Pack added to your shelf. Open it when you’re ready.');}catch(error){status(error.message);button.disabled=false;}};
   tile.append(img,el('strong',set.title),el('small',`${set.cards_per_pack} cards · ${set.released?set.available_packs+' packs remaining':'Release in preparation'}`),button);root.append(tile);
  }
  if(!releasedSets.length)root.append(el('p','FIELDSTOCK 2026 has not been released. Your credits carry forward to release.'));$('bookShop').hidden=false;
 }
 async function openOwnedPack(pack, button){
  button.disabled=true;
  const ticket=epoch;
  try{
   const issued=await rpc('glb_open_pack',{p_pack:pack.id});
   if(ticket!==epoch)return;
   await load();
   if(!owner||epoch!==ticket+1)return;
   const byId=new Map(cards.map(copy=>[copy.copy_id,copy]));
   const opened=issued.map(copy=>byId.get(copy.copy_id));
   if(!opened.length||opened.some(copy=>!copy)){
    status('Pack opened. Check your collector’s book for the saved copies.');
    return;
   }
   const root=$('ownedReveal');
   root.hidden=false;
   GLBPackTable.mount(root,opened,{renderCard:copy=>cardView(copy),savedMessage:'Saved to your collector’s book.',onComplete:()=>{
    const link=el('a','View my collector’s book →');link.href='#bookPages';root.append(link);
   }});
   root.focus();
   root.scrollIntoView({block:'start'});
  }catch(error){status(error.message);button.disabled=false;}
 }
 async function packs(){
  const ticket=epoch;const r=await client.from('glb_packs').select('id,set_id,earned_for,opened_at').is('opened_at',null).order('earned_at');if(ticket!==epoch||!owner)return;if(r.error)throw r.error;const root=$('packShelf');root.replaceChildren();
  for(const p of r.data){const tile=el('article',undefined,'book-pack'),img=el('img'),button=el('button','Open pack');img.src='assets/fieldstock/2026-base-pack.webp';img.alt='FIELDSTOCK 2026 unopened pack';button.type='button';button.onclick=()=>openOwnedPack(p,button);tile.append(img,el('small',p.earned_for),button);root.append(tile);}
  if(!r.data.length)root.append(el('p','No unopened packs right now.'));$('bookPacks').hidden=false;
 }
 async function load(){$('ownedReveal').hidden=true;const ticket=++epoch;owner=false;cards=[];page=0;close();$('bookSettings').hidden=true;$('bookOffers').hidden=true;$('bookPacks').hidden=true;$('bookShop').hidden=true;$('bookWelcome').hidden=true;$('bookPages').hidden=true;$('open-packs').hidden=sample||!!publicUser;$('packGuest').hidden=true;status('Finding your book…');
  try{
   if(sample){const r=await fetch('data/pack-preview.json?v=20261115-photo2');if(!r.ok)throw Error('The sample book could not load.');const data=await FieldstockSubsets.mixedSample(await r.json());if(ticket!==epoch)return;cards=data.map((e,i)=>({copy_id:'sample-'+i,serial:e.serial,edition:e,available:i===2||i===4,wanted:''}));$('sampleNotice').hidden=false;cover({theme:'forest'});draw();status('Sample book · no real cards, ownership or trades.');const selected=cards.find(c=>c.copy_id===params.get('copy'));if(selected)detail(selected);return;}
   if(publicUser){if(!/^[a-z0-9_]{3,24}$/.test(publicUser))throw Error('This collector’s book is unavailable.');const book=await rpc('glb_collector_book',{p_user:publicUser});if(ticket!==epoch)return;if(!book)throw Error('This book is private or has not been published.');cards=book.cards.map(c=>({...c,edition:{...c,id:c.edition_id}}));cover(book);$('pagesHeading').textContent='The collection';draw();status('Public collector’s book · availability is checked again before any trade.');const selected=cards.find(c=>c.copy_id===params.get('copy'));if(selected)detail(selected);return;}
   if(!client)throw Error('The account service is unavailable. Try again shortly.');const {data:{session},error}=await client.auth.getSession();if(error)throw error;const user=session?.user;if(ticket!==epoch)return;
   if(!user){$('packGuest').hidden=false;status('Sign in to collect, display and trade your cards.');const link=el('a',' Sign in →');link.href='account.html';$('bookStatus').append(link);$('bookWelcome').hidden=false;return;}
   const result=await client.from('glb_profiles').select('id,user_id').eq('id',user.id).maybeSingle();if(result.error)throw result.error;if(!result.data)throw Error('Choose your User ID on the account page first.');profile=result.data;handle=profile.user_id;await rpc('glb_collect_visit');if(ticket!==epoch)return;
   const [mine,editionResult,listingResult,settings]=await Promise.all([rpc('glb_my_album'),client.from('glb_editions').select('*'),rpc('glb_my_trade_listings'),client.from('glb_showcases').select('display_name,bio,theme,book_published').eq('owner_id',user.id).maybeSingle()]);if(ticket!==epoch)return;if(editionResult.error)throw editionResult.error;if(settings.error)throw settings.error;
   const editions=new Map(editionResult.data.map(e=>[e.id,e])),listed=new Map(listingResult.map(l=>[l.copy_id,l]));cards=mine.filter(c=>editions.has(c.edition_id)).map(c=>({...c,edition:editions.get(c.edition_id),available:listed.has(c.copy_id),wanted:listed.get(c.copy_id)?.wanted||''}));owner=true;showcaseExists=!!settings.data;cover({...settings.data,user_id:handle});$('publishBook').checked=!!settings.data?.book_published;$('bookSettings').hidden=false;const share=$('bookShare');share.href='book.html?'+new URLSearchParams({user:handle});share.hidden=!settings.data?.book_published;draw();$('bookWelcome').hidden=cards.length>0;status(cards.length?'Your collector’s book is up to date.':'Your book is ready. Open a pack to add your first cards.');await Promise.all([offers(),packs(),shop()]);
  }catch(error){if(ticket===epoch)status(error.message||'Your book could not load. Please refresh.');}
 }
 $('saveBookVisibility').onclick=async()=>{if(!owner||!profile)return;const button=$('saveBookVisibility');button.disabled=true;try{const data={book_published:$('publishBook').checked};const r=showcaseExists?await client.from('glb_showcases').update(data).eq('owner_id',profile.id):await client.from('glb_showcases').insert({owner_id:profile.id,...data});if(r.error)throw r.error;showcaseExists=true;$('bookShare').hidden=!data.book_published;status(data.book_published?'Your collector’s book is public. Share its link to display your collection and trade listings.':'Your book is private. Your cards remain in your collection.');}catch(error){status(error.message);}finally{button.disabled=false;}};
 $('bookPrevious').onclick=()=>{page--;draw();$('pagesHeading').scrollIntoView({block:'start'});};$('bookNext').onclick=()=>{page++;draw();$('pagesHeading').scrollIntoView({block:'start'});};for(const id of ['bookSearch','bookSubset','bookVariant','tradeOnly'])$(id).addEventListener(id==='bookSearch'?'input':'change',()=>{page=0;draw();});$('closeBookCard').onclick=close;$('bookCardDialog').addEventListener('close',()=>{$('bookCardImage').replaceChildren();$('bookCardActions').replaceChildren();});
 if(client&&!sample&&!publicUser)client.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'){$('packGuest').hidden=false;epoch++;owner=false;cards=[];close();$('bookPages').hidden=true;$('bookSettings').hidden=true;$('bookOffers').hidden=true;$('bookPacks').hidden=true;$('bookShop').hidden=true;status('Sign in to open your collector’s book.');}});
 load();
})();
