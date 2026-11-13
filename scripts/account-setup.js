(async()=>{
  const button=document.getElementById('copySql'),source=document.getElementById('setupSql'),status=document.getElementById('copyStatus');
  try{const response=await fetch('supabase/glb-accounts.sql');if(!response.ok)throw Error();source.value=await response.text();button.disabled=false;button.textContent='Copy database setup';}
  catch{button.textContent='Setup could not load';status.textContent='Refresh this page to try again.';}
  button.addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText(source.value);status.textContent='Copied. Paste the complete setup into a new Supabase SQL query.';}
    catch{source.closest('details').open=true;source.focus();source.select();status.textContent='Select and copy all the SQL in the box below.';}
  });
  document.getElementById('checkSetup').addEventListener('click',async event=>{
    const output=document.getElementById('setupStatus');event.target.disabled=true;output.textContent='Checking…';
    try{const {data,error}=await GLBAuth.client.rpc('glb_account_ready');output.textContent=!error&&data===1?'Account database is connected. You can test email sign-in now.':'Setup is not connected yet. Run the complete SQL, then check again.';}
    catch{output.textContent='The connection could not be checked. Please try again.';}
    finally{event.target.disabled=false;}
  });
})();
