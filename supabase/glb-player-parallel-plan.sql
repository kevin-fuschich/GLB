-- Plan every player parallel without changing existing Board decisions or issuing copies.
insert into public.glb_checklist_variants(id,card_id,variant,print_quantity,artwork_status,notes)
select c.id||'-'||lower(v.variant),c.id,v.variant,v.quantity,'missing',
 'Photographic production planned. Preserve the base design, use the edition material and stamp serials /100 or rarer. No inventory is released.'
from public.glb_checklist_cards c cross join (values('Refractor',100),('Gold',25),('Black',5)) v(variant,quantity)
where c.subject_type='player' and c.inclusion='planned'
on conflict(card_id,variant) do nothing;
