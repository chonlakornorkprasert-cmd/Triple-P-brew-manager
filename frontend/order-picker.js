let orderPickerType='';
openEditOrder=function(column,index){
 orderEditTarget={column,index};const row=orders[column]?.[1]?.[index];if(!row){toast('ไม่พบออเดอร์ กรุณาโหลดใหม่');return}
 const detail=row[9]||{},type=row[6]||'DINE_IN',form=document.querySelector('#order-form');form.reset();form.elements.order_id.value=row[4];form.elements.orderType.value=type;
 document.querySelector('#order-modal h2').textContent=`แก้ไขออเดอร์ ${row[0]}`;document.querySelector('#cancel-order').classList.remove('hidden');document.querySelectorAll('[data-order-type]').forEach(b=>b.classList.toggle('selected',b.dataset.orderType===type));renderChannelFields(type);
 const customer=form.elements.customer;if(customer){if(customer.tagName==='SELECT'&&![...customer.options].some(o=>o.value===row[7]))customer.add(new Option(`${row[7]} · โต๊ะออเดอร์นี้`,row[7]));customer.value=row[7]||detail.customer||'';if(customer.tagName==='SELECT'&&customer.selectedOptions.length)customer.selectedOptions[0].disabled=false}
 for(const key of ['phone','delivery_address','note','guest_count'])if(form.elements[key])form.elements[key].value=detail[key]??'';
 document.querySelector('#order-rows').replaceChildren();const merged=new Map();for(const item of row[8]||[]){const key=String(item.recipe_id||item.menu_name);if(merged.has(key))merged.get(key).quantity+=Number(item.quantity);else merged.set(key,{...item,quantity:Number(item.quantity)})}for(const item of merged.values())addOrderRow(item);
 orderPickerType='';document.querySelector('#order-menu-search').value='';renderOrderPicker();updateOrderTotal();showModal('order-modal');
};
const orderPickerImages=new Map();
async function loadOrderPickerImages(){try{const response=await fetch('/api/menu-images',{cache:'no-store'});if(!response.ok)return;const rows=await response.json();orderPickerImages.clear();rows.forEach(row=>orderPickerImages.set(String(row.recipe_id),row.image_data));renderOrderPicker()}catch{}}
const orderBuilder=document.querySelector('.order-builder');
orderBuilder.insertAdjacentHTML('beforebegin','<div class="order-picker"><h3>1. เลือกประเภทเมนู</h3><div class="menu-type-tabs"><button type="button" data-pick-type="food">🍜 อาหารหลัก</button><button type="button" data-pick-type="drink">🥤 เครื่องดื่ม</button></div><input type="search" id="order-menu-search" placeholder="ค้นหาเมนูในประเภทที่เลือก" aria-label="ค้นหาเมนูในออเดอร์"><div id="order-menu-buttons"></div><p id="order-picker-message">เลือกประเภทเพื่อแสดงรายการเมนู</p></div>');
document.querySelector('#add-order-row').hidden=true;
document.querySelectorAll('[data-pick-type]').forEach(b=>b.onclick=()=>{orderPickerType=b.dataset.pickType;renderOrderPicker()});
document.querySelector('#order-menu-search').oninput=renderOrderPicker;
function renderOrderPicker(){
 document.querySelectorAll('[data-pick-type]').forEach(b=>b.classList.toggle('active',b.dataset.pickType===orderPickerType));
 const box=document.querySelector('#order-menu-buttons');box.replaceChildren();const q=document.querySelector('#order-menu-search').value.trim().toLowerCase();
 const menus=orderPickerType?recipes.filter(x=>menuMainType(x)===orderPickerType&&`${x.name} ${x.code||''}`.toLowerCase().includes(q)):[];
 document.querySelector('#order-picker-message').textContent=!orderPickerType?'เลือกประเภทเพื่อแสดงรายการเมนู':menus.length?'กดเมนูเพื่อเพิ่มจำนวนในออเดอร์':'ไม่พบเมนูในประเภทหรือคำค้นนี้';
 menus.forEach(menu=>{const button=document.createElement('button');button.type='button';button.className='order-menu-button';button.disabled=!!menu.sold_out;const name=document.createElement('strong');name.textContent=menu.name;const price=document.createElement('span');price.textContent=menu.sold_out?'Sold out':`฿${money(channelPrice(menu))}`;button.append(name,price);button.onclick=()=>{
 const id=String(menu.recipe_id||menu.id),existing=[...document.querySelectorAll('.order-item-row')].find(row=>String(recipes[+row.querySelector('select').value]?.recipe_id||recipes[+row.querySelector('select').value]?.id)===id);
 if(existing){const input=existing.querySelector('input');input.value=(+input.value||0)+1;updateOrderTotal()}else addOrderRow({recipe_id:menu.recipe_id||menu.id,quantity:1});
 };box.append(button)});
}
const originalAddOrderRow=addOrderRow;
addOrderRow=function(item){if(!item?.recipe_id&&!item?.menu_name)return;originalAddOrderRow(item);const row=document.querySelector('#order-rows').lastElementChild,select=row.querySelector('select'),menu=recipes[+select.value];select.closest('label').hidden=true;const label=document.createElement('strong');label.className='picked-menu-name';label.textContent=menu?.name||item.menu_name;row.prepend(label);row.querySelector('button').onclick=()=>{row.remove();updateOrderTotal()}};
const originalPrepareOrder=prepareNewOrder;
prepareNewOrder=function(){originalPrepareOrder();orderPickerType='';document.querySelector('#order-menu-search').value='';renderOrderPicker();updateOrderTotal()};
document.querySelectorAll('[data-order-type]').forEach(button=>button.addEventListener('click',renderOrderPicker));
document.querySelector('#order-form').addEventListener('submit',event=>{if(!document.querySelector('.order-item-row')){event.preventDefault();event.stopImmediatePropagation();toast('กรุณาเลือกเมนูอย่างน้อย 1 รายการ')}},true);
const originalChannelFields=renderChannelFields;
const renderOrderPickerBeforeImages=renderOrderPicker;
renderOrderPicker=function(){renderOrderPickerBeforeImages();const q=document.querySelector('#order-menu-search').value.trim().toLowerCase(),menus=orderPickerType?recipes.filter(x=>menuMainType(x)===orderPickerType&&`${x.name} ${x.code||''}`.toLowerCase().includes(q)):[];document.querySelectorAll('.order-menu-button').forEach((button,index)=>{const menu=menus[index],image=orderPickerImages.get(String(menu.recipe_id||menu.id));if(image){const img=document.createElement('img');img.src=image;img.alt=menu.name;img.loading='lazy';img.className='order-menu-photo';button.prepend(img)}else{const placeholder=document.createElement('div');placeholder.className='order-menu-photo order-photo-placeholder';placeholder.textContent=menuMainType(menu)==='food'?'🍜':'🥤';button.prepend(placeholder)}})};
document.querySelectorAll('#new-order,#new-order-2').forEach(button=>button.addEventListener('click',loadOrderPickerImages));
loadOrderPickerImages();
renderChannelFields=function(type){
 originalChannelFields(type);if(type!=='DINE_IN')return;
 const select=document.querySelector('#channel-fields select[name="customer"]');select.required=true;
 const usable=restaurantTables.filter(table=>table.status==='AVAILABLE');
 select.replaceChildren(new Option(usable.length?'เลือกโต๊ะว่าง':'ไม่มีโต๊ะว่างในขณะนี้',''));
 usable.forEach(table=>{const option=new Option(`${table.name} · ${table.seats} ที่นั่ง${table.status==='OCCUPIED'?' · กำลังใช้งาน':' · ว่าง'}`,table.name);option.disabled=table.status==='OCCUPIED';select.add(option)});
 const controls=document.createElement('div');controls.style='grid-column:1/-1;display:flex;gap:8px;align-items:center;flex-wrap:wrap';
 const add=document.createElement('button');add.type='button';add.className='secondary';add.textContent='＋ เพิ่มโต๊ะ';add.onclick=()=>openTableForm();
 const refresh=document.createElement('button');refresh.type='button';refresh.className='secondary';refresh.textContent='↻ โหลดโต๊ะใหม่';refresh.onclick=async()=>{await loadTables();renderChannelFields('DINE_IN')};
 controls.append(add,refresh);document.querySelector('#channel-fields').append(controls);
 if(!usable.length){const hint=document.createElement('small');hint.textContent='ขณะนี้ไม่มีโต๊ะว่าง กรุณาตรวจสอบผังโต๊ะหรือโหลดโต๊ะใหม่';controls.append(hint)}
};
const originalRenderTables=renderTables;
renderTables=function(){originalRenderTables();if(document.querySelector('#order-modal.open')&&document.querySelector('[name="orderType"]').value==='DINE_IN'){
 const current=document.querySelector('#channel-fields [name="customer"]')?.value;renderChannelFields('DINE_IN');const select=document.querySelector('#channel-fields [name="customer"]');if(current)select.value=current;
}};
document.querySelector('#order-form').addEventListener('submit',event=>{if(document.querySelector('[name="orderType"]').value==='DINE_IN'&&!document.querySelector('#channel-fields [name="customer"]').value){event.preventDefault();event.stopImmediatePropagation();toast('กรุณาเลือกโต๊ะก่อนยืนยันออเดอร์')}},true);
