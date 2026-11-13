(() => {
  const $=id=>document.getElementById(id);
  const client=window.GLBAuth?.client;
  const status=$('accountStatus');
  let currentUser=null, revision=0, ready=false;
  const notice=(message,error=false)=>{status.textContent=message;status.classList.toggle('error',error);};
  const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
  const friendly=error=>{
    const message=String(error?.message || '');
    if(error?.status===429 || /rate limit|too many|security purposes/i.test(message))return 'Please wait a minute before requesting another sign-in link.';
    if(/email_address_not_authorized|Email address not authorized/i.test(error?.code+' '+message))return 'Email sign-in is still being opened to new members. Please try again later.';
    if(error?.code==='23505')return 'That User ID is already taken. Please choose another.';
    if(error?.code==='23514')return 'Choose a different User ID using 3–24 lowercase letters, numbers or underscores.';
    return 'We couldn’t complete that request. Please try again.';
  };
  async function render(user){
    const ticket=++revision; currentUser=user;
    $('signedOut').hidden=!!user || !ready; $('signedIn').hidden=!user;
    if(!user){$('accountHome').hidden=true;$('chooseUserId').hidden=true;$('privateEmail').textContent='';$('myClaims').replaceChildren();$('mySubmissions').replaceChildren();notice(ready?'':'GLB accounts are opening soon. Please check back.');return;}
    $('privateEmail').textContent=user.email+' · Private';
    $('accountHome').hidden=true;$('chooseUserId').hidden=true;notice('Loading your account…');
    try{
      const {data:profile,error}=await client.from('glb_profiles').select('user_id').eq('id',user.id).maybeSingle();
      if(ticket!==revision)return;
      if(error)throw error;
      notice('');
      if(!profile){$('chooseUserId').hidden=false;return;}
      $('publicId').textContent=profile.user_id;$('accountHome').hidden=false;
      const results=await Promise.all([
        client.from('glb_claims').select('artifact_id,artifact_name,body,collaboration_open,approved_at,submission_id').eq('owner_id',user.id).order('approved_at',{ascending:false}),
        client.from('glb_submissions').select('id,kind,artifact_name,status,created_at').eq('owner_id',user.id).order('created_at',{ascending:false}),
        client.from('glb_claim_receipts').select('submission_id,claim_code').eq('owner_id',user.id)
      ]);
      if(ticket!==revision)return;
      if(results.some(r=>r.error))throw results.find(r=>r.error).error;
      const receipts=new Map(results[2].data.map(r=>[r.submission_id,r.claim_code]));
      $('myClaims').replaceChildren(...results[0].data.map(claim=>{
        const item=node('article',null,'record-item');item.append(node('div',claim.artifact_id,'record-meta'),node('h4',claim.artifact_name),node('p',claim.body));
        const receipt=receipts.get(claim.submission_id);
        if(receipt){item.append(node('p','Your private claim code','fine'),node('div',receipt.match(/.{1,4}/g).join('-'),'receipt'));}
        const label=node('label',null,'collaboration-setting'),input=node('input');input.type='checkbox';input.checked=claim.collaboration_open;
        label.append(input,node('span','Open this claim to collaboration'));item.append(label);
        const feedback=node('p',null,'record-message');feedback.setAttribute('role','status');item.append(feedback);
        input.addEventListener('change',async()=>{
          const desired=input.checked;input.disabled=true;feedback.textContent='Saving…';
          try{
            const {data,error}=await client.rpc('glb_set_collaboration',{p_artifact_id:claim.artifact_id,p_open:desired});
            if(error)throw error;
            if(data!==desired)throw Error('Setting not saved');
            claim.collaboration_open=desired;feedback.textContent=desired?'Collaboration is open. New notes still need Board approval.':'Collaboration is closed. Previously approved notes stay in the record.';
          }catch{input.checked=claim.collaboration_open;feedback.textContent='That setting could not be saved. Try again.';}
          finally{input.disabled=false;}
        });
        return item;
      }));
      if(!results[0].data.length)$('myClaims').append(node('p','Your accepted claims will appear here.','fine'));
      $('mySubmissions').replaceChildren(...results[1].data.map(row=>{
        const item=node('article',null,'record-item');item.append(node('h4',row.artifact_name),node('p',(row.kind==='note'?'Collaboration note':row.kind==='pitch'?'Idea':'Claim')+' · '+row.status,'record-meta'));return item;
      }));
      if(!results[1].data.length)$('mySubmissions').append(node('p','No account-linked submissions yet.','fine'));
    }catch{if(ticket===revision)notice('Your account could not be loaded. Refresh to try again.',true);}
  }
  if(!client){notice('Sign-in could not load. Refresh this page to try again.',true);return;}
  $('signInForm').addEventListener('submit',async event=>{
    event.preventDefault();if(!$('signInForm').reportValidity())return;
    const button=$('sendLink');button.disabled=true;notice('Sending your sign-in link…');
    try{
      const {error}=await client.auth.signInWithOtp({email:$('email').value.trim(),options:{shouldCreateUser:true,emailRedirectTo:GLBAuth.redirectURL}});
      if(error)throw error;
      notice('Check your email. Open the newest GLB sign-in link to continue.');
      button.textContent='Link sent · check your email';
      setTimeout(()=>{button.disabled=false;button.textContent='Send another sign-in link →';},60000);
    }catch(error){notice(friendly(error),true);button.disabled=false;}
  });
  $('profileForm').addEventListener('submit',async event=>{
    event.preventDefault();if(!currentUser || !$('profileForm').reportValidity())return;
    const button=$('profileForm').querySelector('button');button.disabled=true;$('profileStatus').textContent='Saving…';
    try{
      const {error}=await client.from('glb_profiles').insert({id:currentUser.id,user_id:$('userId').value.trim()});
      if(error)throw error;
      $('profileStatus').textContent='';await render(currentUser);
    }catch(error){$('profileStatus').textContent=friendly(error);}
    finally{button.disabled=false;}
  });
  $('signOut').addEventListener('click',async()=>{
    $('signOut').disabled=true;
    try{const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;await render(null);}
    catch{notice('Sign-out could not be completed. Please try again.',true);}
    finally{$('signOut').disabled=false;}
  });
  // Do not make database/auth requests inside the auth event callback's lock.
  client.auth.onAuthStateChange((event,session)=>{
    if(event==='SIGNED_IN' || event==='SIGNED_OUT' || event==='USER_UPDATED')setTimeout(()=>render(session?.user || null),0);
  });
  (async()=>{
    const url=new URL(location.href),hash=new URLSearchParams(url.hash.slice(1));
    const linkError=GLBAuth.callbackError || hash.has('error') || url.searchParams.has('error');
    try{
      const result=await client.rpc('glb_account_ready');ready=!result.error && result.data===1;
      const {data,error}=await client.auth.getSession();
      if(error)throw error;
      await render(data.session?.user || null);
      if(linkError){history.replaceState(null,'',location.pathname);notice('That sign-in link has expired or was already used. Request a fresh link below.',true);}
    }catch{notice('We couldn’t connect to your account. Refresh to try again.',true);}
  })();
})();
