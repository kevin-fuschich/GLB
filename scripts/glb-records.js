/* Only approved records are public. Identity and review remain server-enforced. */
(() => {
  const base='https://uyjncyvlumakuqtfuicc.supabase.co/rest/v1/';
  const headers={apikey:'sb_publishable_VjJqbpi9zo2143JF1qq91A_0mAfJuUy'};
  async function read(table,params){
    const response=await fetch(base+table+'?'+new URLSearchParams(params),{headers,cache:'no-store'});
    if(!response.ok)throw Error('Public records could not load');
    return response.json();
  }
  window.GLBRecords={read,claims:()=>read('glb_claims',{select:'artifact_id,artifact_name,user_id,body,club_slug,artifact_type,collaboration_open,approved_at',order:'approved_at.desc'}),href:id=>'artifact.html?artifact_id='+encodeURIComponent(id)};
})();
