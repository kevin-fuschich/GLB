(() => {
  const field=document.getElementById('boardSQL'),status=document.getElementById('setupStatus'),button=document.getElementById('copyBoardSQL');button.disabled=true;
  fetch('supabase/glb-board.sql',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.text();}).then(sql=>{field.value=sql;button.disabled=false;}).catch(()=>{status.textContent='Setup SQL could not load. Refresh to try again.';});
  button.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(field.value);status.textContent='Copied. Paste into a new SQL snippet in your GLB Supabase project, then Run.';}catch{field.focus();field.select();status.textContent='Select and copy the SQL, then paste it into a new Supabase SQL snippet.';}});
})();
