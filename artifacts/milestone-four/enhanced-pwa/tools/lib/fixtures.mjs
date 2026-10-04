// Synthetic data only, using the actual original DBHelper fields.
export function androidFixture(count=3,prefix='LEGACY') {
  return {format:'cs499-android-inventory-v1',items:Array.from({length:count},(_,i)=>({
    id:i+1,item_name:`Cable inventory ${String(i+1).padStart(4,'0')}`,
    sku:`${prefix}-${String(i+1).padStart(4,'0')}`,
    quantity:i%20===0?1:50+i%50,
    location:`Shelf ${i%20+1}`,notes:i%3===0?null:'Synthetic migration fixture.',
    updated_at:'09/01/2026 12:00'
  }))};
}
