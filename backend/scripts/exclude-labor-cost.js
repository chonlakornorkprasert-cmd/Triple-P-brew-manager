import {readFile,writeFile} from 'node:fs/promises';
const path=new URL('../database/costing-import.json',import.meta.url),data=JSON.parse(await readFile(path,'utf8'));
for(const recipe of data.recipes)recipe.items=recipe.items.filter(item=>item.ingredient!=='ค่าแรงและค่าใช้จ่ายแฝง');
data.ingredients=data.ingredients.filter(item=>item.name!=='ค่าแรงและค่าใช้จ่ายแฝง');
await writeFile(path,JSON.stringify(data,null,2)+'\n');
