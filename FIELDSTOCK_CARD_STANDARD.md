# FIELDSTOCK card presentation

Every GLB collectible card must look like a photograph of a tangible printed card lying on a flat surface. This applies to baseball players, DONK drivers and future collectible artifacts.

Use cream cardstock, sharp corners, visible paper thickness, natural contact shadows, subtle printed grain, navy ink and restrained gold FIELDSTOCK branding. Show the whole physical card and a narrow margin of tabletop. Preserve established identities and artwork. Avoid flat digital panels, floating interface tiles, plastic frames or exaggerated distressing.

The DONK tabletop photographs in `assets/events/driver-cards/` are the approved visual reference. Shared player cards use `assets/fieldstock/physical-card-stock.webp` as the photographed stock and surface beneath their live print layers, preserving current statistics, readable names and accessible two-sided interaction. Claim controls sit outside the photographed object.

Donny Miles is the Albuquerque driver's public name. Existing `DONK-PERK-O-LATA` identifiers remain stable to preserve claim history and links; they are internal identifiers, not display names.

## 2026 editions and physical print proofs

Keep the approved layout and player identity across editions. The Base is matte cream stock; Refractor has natural silver diffraction; Gold uses metallic gold foil; Black /5 has obsidian chrome, platinum lettering and a restrained prismatic cut edge. The material must communicate the edition without relying on an interface label. Front and back artwork should be photographs of tangible cards, with physical edges, contact shadows, paper texture and naturally reflected light.

Every edition numbered to 100 or fewer carries a foil-stamped serial on the card itself, in plain form: `41/100`, `7/25`, `3/5`. Do not pad with leading zeros. The public serial is separate from the private 16-digit ownership code.

A photographic proof with a baked-in serial is only valid for that exact copy. `facts.physical_copies` maps serials to their photographed front/back paths. Never reuse a `3/5` photograph for copy `4/5`. The pack, collector book and card inspector use the same mapping. Photographs, player information and stamp numbers must be checked before a print is accepted.

The 2026 player plan has 264 players across 16 clubs and four editions per player: Base /1000, Refractor /100, Gold /25 and Black /5. The 1,056 player editions are draft production records. Planning these rows does not mint cards or approve unfinished artwork. Other universe artifacts remain separately reviewed checklist candidates.

Unnumbered Base photographs can be shared between copies through `facts.photographic_master.front` and `.back`, only for editions above /100. Numbered editions always resolve artwork by exact serial. All five preview cards now have photographic fronts and backs.
