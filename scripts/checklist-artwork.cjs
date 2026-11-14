/* Reuse the established renderer's artwork routing without rendering or changing images. */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const context={window:{},URL,document:{currentScript:{src:'https://globalleaguebaseball.com/scripts/player-cards.js'}}};
vm.runInNewContext(fs.readFileSync(path.join(root,'scripts/player-cards.js'),'utf8'),context);
const api=context.window.GLBPlayerCards,design=read('data/cards/fieldstock-2026.json').players,out={};
for(const file of fs.readdirSync(path.join(root,'data/rosters')).filter(f=>f.endsWith('.json'))){
 const team=file.replace('.json',''),roster=read('data/rosters/'+file);
 for(const r of roster.players){const data={...design[team+'/'+r.slug],...r,teamSlug:team};
  const candidates=[data.photo_source,api.photoPath(data),api.cardFront(data)];
  const source=candidates.find(p=>p&&!p.includes('pending')&&fs.existsSync(path.join(root,p)));
  if(source)out[team+'/'+r.slug]={path:source,crop:data.photo_crop||null,kind:source===api.cardFront(data)?'legacy_card_artwork':'source_photograph'};
 }
}
process.stdout.write(JSON.stringify(out));
