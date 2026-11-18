const sidebarNav=document.querySelector('.sidebar nav');
const navigationGroups=[
 ['ภาพรวม',['dashboard']],
 ['งานหน้าร้าน',['orders','tables','menu']],
 ['วัตถุดิบและการผลิต',['stock','purchases','production']],
 ['ต้นทุนและการเงิน',['costing-center','expenses','reports']],
 ['ตั้งค่าระบบ',['settings']]
];
const navigationButtons=new Map([...document.querySelectorAll('.sidebar .nav-item[data-view]')].map(button=>[button.dataset.view,button]));
navigationButtons.set('expenses',expenseNav);
for(const [label,views] of navigationGroups){const section=document.createElement('section');section.className='navigation-group';section.setAttribute('aria-label',label);const heading=document.createElement('h2');heading.textContent=label;section.append(heading);for(const view of views){const button=navigationButtons.get(view);if(button){button.type='button';section.append(button)}}sidebarNav.append(section)}
const setViewBeforeGroupedNavigation=setView;
setView=function(id){setViewBeforeGroupedNavigation(id);for(const [view,button] of navigationButtons){button.classList.toggle('active',view===id);if(view===id)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current')}};
// Keep the existing expense action while making its label consistent.
expenseNav.innerHTML='<span>฿</span> ค่าใช้จ่าย';
