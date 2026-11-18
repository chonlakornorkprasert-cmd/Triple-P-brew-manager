let menuImages=new Map(),costType='all';
const originalRenderRecipes=renderRecipes;
renderRecipes=function(...args){originalRenderRecipes(...args);document.querySelectorAll('.staff-menu-row').forEach(row=>{
 const id=row.dataset.menuRow,cell=row.cells[0];
 if(menuImages.has(id)){const img=document.createElement('img');img.src=menuImages.get(id);img.alt='รูปเมนู';img.style='width:72px;height:72px;object-fit:cover;border-radius:10px;float:left;margin-right:12px';cell.prepend(img)}
 const button=document.createElement('button');button.className='view-staff-recipe';button.textContent='📷 รูปภาพ';button.onclick=()=>editMenuImage(id);cell.append(button);
})};
async function loadMenuImages(){try{const response=await fetch('/api/menu-images');if(!response.ok)throw Error();menuImages=new Map((await response.json()).map(x=>[String(x.recipe_id),x.image_data]));renderRecipes()}catch{}}
function editMenuImage(id){
 const dialog=document.createElement('dialog');dialog.style='border:0;border-radius:14px;padding:24px;max-width:420px;width:90%';
 dialog.innerHTML='<h3>รูปภาพเมนู</h3><p>เลือกรูป JPG, PNG หรือ WebP ขนาดไม่เกิน 3 MB</p><input type="file" accept="image/jpeg,image/png,image/webp"><p class="image-message"></p><button class="secondary">ปิด</button> <button class="danger">ลบรูปภาพ</button>';
 document.body.append(dialog);dialog.querySelector('.secondary').onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();
 async function save(image){const response=await fetch(`/api/menu-images/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({image_data:image})});if(!response.ok)throw Error();await loadMenuImages();dialog.close();toast('บันทึกรูปภาพแล้ว ✓')}
 dialog.querySelector('.danger').onclick=async()=>{try{await save('')}catch{dialog.querySelector('.image-message').textContent='บันทึกไม่ได้ กรุณาลองใหม่'}};
 dialog.querySelector('input').onchange=async e=>{const file=e.target.files[0];if(!file)return;if(file.size>3*1024*1024){dialog.querySelector('.image-message').textContent='รูปภาพต้องไม่เกิน 3 MB';return}const reader=new FileReader();reader.onload=async()=>{try{await save(reader.result)}catch{dialog.querySelector('.image-message').textContent='บันทึกรูปไม่ได้ กรุณาลองใหม่'}};reader.readAsDataURL(file)};
 dialog.showModal();
}
const originalCostRender=renderCostingRecipes;
renderCostingRecipes=function(){originalCostRender();const panel=document.querySelector('#costing-recipes-panel');if(!document.querySelector('#cost-type-tabs')){
 const tabs=document.createElement('div');tabs.id='cost-type-tabs';tabs.className='menu-type-tabs';tabs.style.marginBottom='14px';
 tabs.setAttribute('role','group');tabs.setAttribute('aria-label','เลือกประเภทสูตรและต้นทุน');
 [['all','ทั้งหมด'],['food','🍜 อาหารหลัก'],['drink','🥤 เครื่องดื่ม']].forEach(([value,label])=>{const b=document.createElement('button');b.type='button';b.innerHTML=`${label} <b>0</b>`;b.dataset.type=value;b.onclick=()=>{costType=value;renderCostingRecipes()};tabs.append(b)});panel.prepend(tabs)}
 document.querySelectorAll('#cost-type-tabs button').forEach(b=>{const selected=b.dataset.type===costType;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));b.querySelector('b').textContent=recipes.filter(x=>b.dataset.type==='all'||menuMainType(x)===b.dataset.type).length});
 document.querySelectorAll('#costing-recipes tr').forEach(row=>{const id=row.dataset.recipeId,menu=recipes.find(x=>String(x.recipe_id||x.id)===id);row.hidden=costType!=='all'&&menuMainType(menu)!==costType;
 const button=document.createElement('button');button.className='danger';button.textContent='ลบเมนู';button.onclick=async()=>{if(!confirm(`ลบเมนู ${menu.name}?`))return;try{const response=await fetch(`/api/recipes/${id}`,{method:'DELETE'});if(!response.ok){const body=await response.json();throw Error(body.error||'ลบไม่ได้')}await loadData();toast('ลบเมนูแล้ว')}catch(error){toast(error.message)}};row.querySelector('.cost-row-actions').append(button);
 });
 const body=document.querySelector('#costing-recipes');if(![...body.querySelectorAll('tr')].some(row=>!row.hidden))body.insertAdjacentHTML('beforeend','<tr><td colspan="8" class="menu-empty">ไม่พบเมนูในประเภทหรือคำค้นนี้</td></tr>');
};
loadMenuImages();
const renderIngredientsBeforeActions=renderCostingIngredients;
renderCostingIngredients=function(){renderIngredientsBeforeActions();document.querySelectorAll('#costing-ingredients tr[data-cost-id]').forEach(row=>{
 const id=row.dataset.costId,cell=row.lastElementChild;
 const edit=document.createElement('button');edit.type='button';edit.className='edit-cost-recipe';edit.textContent='แก้ไข';edit.onclick=()=>openStockForm(id);
 const remove=document.createElement('button');remove.type='button';remove.className='danger';remove.textContent='ลบ';remove.onclick=async()=>{const item=ingredients.find(x=>String(x.id)===id);if(!confirm(`ยืนยันลบวัตถุดิบ ${item.name}?`))return;remove.disabled=true;try{const response=await fetch(`/api/ingredients/${id}`,{method:'DELETE'});if(!response.ok){if(response.status===409)throw Error('ลบไม่ได้: วัตถุดิบนี้ถูกใช้ในสูตรหรือมีประวัติสต็อก');throw Error('ลบไม่ได้ กรุณาตรวจสอบฐานข้อมูล')}await loadData();toast('ลบวัตถุดิบแล้ว')}catch(error){toast(error.message)}finally{remove.disabled=false}};
 const actions=document.createElement('div');actions.className='cost-row-actions';while(cell.firstChild)actions.append(cell.firstChild);actions.append(edit,remove);cell.append(actions);
})};
if(document.querySelector('#costing-center'))renderCostingCenter();
