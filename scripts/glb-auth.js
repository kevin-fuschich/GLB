/* Public project identifiers. Database permissions are enforced by Supabase RLS. */
(() => {
  const callbackURL=new URL(location.href);
  const callbackError=new URLSearchParams(callbackURL.hash.slice(1)).has('error') || callbackURL.searchParams.has('error');
  const client = window.supabase?.createClient(
    'https://uyjncyvlumakuqtfuicc.supabase.co',
    'sb_publishable_VjJqbpi9zo2143JF1qq91A_0mAfJuUy',
    {auth:{flowType:'implicit',detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}}
  );
  window.GLBAuth = {client, callbackError, redirectURL:'https://globalleaguebaseball.com/account.html'};
})();
