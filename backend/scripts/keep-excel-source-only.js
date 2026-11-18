import { readFile, writeFile } from 'node:fs/promises';

const sourceUrl = new URL('../database/costing-import.json', import.meta.url);
const data = JSON.parse(await readFile(sourceUrl, 'utf8'));
const excludedRecipes = data.recipes.filter(recipe => String(recipe.code).startsWith('NOODLE-'));
const recipes = data.recipes.filter(recipe => !String(recipe.code).startsWith('NOODLE-'));
const retainedIngredientNames = new Set(recipes.flatMap(recipe => recipe.items.map(item => item.ingredient)));
const excludedOnlyIngredientNames = new Set(
  excludedRecipes.flatMap(recipe => recipe.items.map(item => item.ingredient))
    .filter(name => !retainedIngredientNames.has(name))
);

data.recipes = recipes;
data.ingredients = data.ingredients.filter(item => !excludedOnlyIngredientNames.has(item.name));
data.missing_cost_ingredients = (data.missing_cost_ingredients || []).filter(name => !excludedOnlyIngredientNames.has(name));
data.generated_price_codes = (data.generated_price_codes || []).filter(code => !String(code).startsWith('NOODLE-'));
data.source_policy = 'Excel source only';

await writeFile(sourceUrl, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  recipes: data.recipes.length,
  ingredients: data.ingredients.length,
  removed_recipes: excludedRecipes.map(item => item.name),
  removed_ingredients: [...excludedOnlyIngredientNames]
}, null, 2));
