import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNextOutfitWithDebug, generationOrder, getActiveOutfitSlots, getEligibleSlotPool,
  emptyOutfitFilters, defaultGenerationLists, getGuidedScoreBreakdown, transitionOutfitLayering,
  rerollOutfitSlot, getStructuralIssues, applyOutfitAffinityDelta, getOutfitKey,
  normalizeLikedOutfitKeys, normalizeRecentOutfits, getGenerationDebugSignature,
  transitionOutfitLayeringWithMemory
} from './generation.js';

const garment = (id, type, garmentType, layerRoles = [], extra = {}) => ({id, type, garmentType, layerRoles, weight: 'Medium', styleTags: ['Casual'], status: 'Wardrobe', ...extra});
const wardrobe = [
  garment('base', 'T-Shirt', 'Top', ['Base'], {weight: 'Light'}),
  garment('mid', 'Knit Sweater', 'Top', ['Mid']),
  garment('outer', 'Wool Coat', 'Outerwear', ['Outer'], {weight: 'Heavy'}),
  garment('bottom', 'Jeans', 'Bottom'), garment('shoe', 'Sneakers', 'Footwear'),
  garment('head', 'Cap', 'Headwear'),
];
const lookup = Object.fromEntries(wardrobe.map(item => [item.id, item]));
const outfit = {TopInner: 'base', TopMid: 'mid', TopOuter: 'outer', Bottom: 'bottom', Footwear: 'shoe', Headwear: 'head'};
const filters = changes => ({...emptyOutfitFilters, ...changes});
const generate = (items = wardrobe, current = {}, locks = {}, layering = 3, options = {}) => buildNextOutfitWithDebug(items, current, locks, layering, options.excluded, options.generationLists, options.outfitFilters, null, options.generationMode, options.outfitAffinity, options.recentOutfits, {itemsById: options.itemsById ?? lookup});
const score = (item, slot, context = {}, f = emptyOutfitFilters, affinity = {}, recent = [], layering = 3) => getGuidedScoreBreakdown(item, slot, context, lookup, f, null, affinity, recent, layering);
const pool = (items, slot, context = {}, f = emptyOutfitFilters, layering = 3) => getEligibleSlotPool(items, slot, {}, defaultGenerationLists, layering, f, null, context, {...lookup, ...Object.fromEntries(items.map(item => [item.id,item]))});
const random = (value, action) => {const original = Math.random; Math.random = () => value; try {return action();} finally {Math.random = original;}};

test('both modes select in dependency order and propagate physical context', () => {
  const shorts = garment('shorts', 'Shorts', 'Bottom', [], {weight: 'Light'});
  for (const generationMode of ['guided', 'random']) {
    const result = generate([shorts, ...wardrobe.filter(item => item.garmentType !== 'Bottom')], {}, {}, 3, {generationMode, itemsById: {...lookup, shorts}});
    assert.equal(result.outfit.Bottom, 'shorts');
    assert.equal(result.outfit.TopOuter, null);
    if (generationMode === 'guided') assert.deepEqual(result.guidedDebugPayload.map(entry => entry.slot), generationOrder);
    else assert.deepEqual(result.guidedDebugPayload, []);
  }
});

for (const layering of [false, true, 3]) test(`generation only uses active slots in mode ${layering}`, () => {
  const result = generate(wardrobe, outfit, {TopMid: true, TopOuter: true}, layering);
  assert.equal(Boolean(result.outfit.TopMid), layering === 3);
  assert.equal(Boolean(result.outfit.TopOuter), Boolean(layering));
  if (layering !== 3) assert.equal(result.locked.TopMid, undefined);
  if (!layering) assert.equal(result.locked.TopOuter, undefined);
  assert.deepEqual(result.guidedDebugPayload.map(entry => entry.slot), generationOrder.filter(slot => getActiveOutfitSlots(layering).includes(slot) && !result.locked[slot]));
});

test('style and climate scoring activate independently; exclusions alone stay neutral', () => {
  for (const f of [filters({}), filters({styleExcluded: ['Formal']}), filters({climateExcluded: ['Snow']})]) {
    assert.equal(score(wardrobe[0], 'TopInner', {}, f).score, .8);
    assert.equal(score(wardrobe[0], 'TopInner', {}, f).breakdown.climate, undefined);
    assert.equal(score(wardrobe[0], 'TopInner', {}, f).breakdown.styleCoherence, undefined);
  }
  for (const f of [filters({style:['Casual']}), filters({climate:['Warm']}), filters({style:['Casual'],climate:['Warm']})]) {
    const b = score(wardrobe[0], 'TopInner', {}, f).breakdown;
    assert.equal('climate' in b, Boolean(f.climate.length));
    assert.equal('styleCoherence' in b, Boolean(f.style.length));
    for (const removed of ['baseline','weightContrast','mixedSeason','lonelyExtreme','styleStreakPenalty','noFilterVariety']) assert.equal(b[removed], undefined);
  }
});

test('strict restrictions never restore an empty pool', () => {
  assert.deepEqual(pool([wardrobe[2]], 'TopOuter', {}, filters({climate:['Hot']})), []);
  assert.deepEqual(pool([wardrobe[0]], 'TopInner', {}, filters({styleExcluded:['Casual']})), []);
  const shirt = garment('shirt', 'Shirt', 'Top', ['Base'], {styleTags:['Formal']});
  assert.deepEqual(pool([shirt], 'TopInner', {}, filters({style:['Athleisure']})), []);
  const result = generate(wardrobe, {}, {}, 3, {outfitFilters:filters({styleExcluded:['Casual']})});
  assert.ok(Object.values(result.outfit).every(id => !id));
  assert.ok(result.guidedDebugPayload.every(entry => entry.reason && entry.itemId === null));
});

test('valid locks resolve outside source and filters; invalid category and role locks clear', () => {
  const result = generate(wardrobe.filter(item => item.id !== 'outer'), outfit, {TopOuter:true, TopInner:true}, 3, {outfitFilters:filters({styleExcluded:['Casual']})});
  assert.equal(result.outfit.TopOuter,'outer');
  assert.equal(result.outfit.TopInner,'base');
  const invalid = generate([], {TopInner:'outer', TopMid:'bottom'}, {TopInner:true,TopMid:true});
  assert.equal(invalid.outfit.TopInner,null);
  assert.equal(invalid.outfit.TopMid,null);
  assert.equal(invalid.locked.TopInner,undefined);
  assert.equal(invalid.locked.TopMid,undefined);
});

test('conflicting valid locks remain and report issues; candidates obey all active locks', () => {
  const shorts = garment('shorts','Shorts','Bottom');
  const result = generate(wardrobe, {...outfit,Bottom:'shorts'}, {Bottom:true,TopOuter:true}, 3, {itemsById:{...lookup,shorts}});
  assert.equal(result.outfit.Bottom,'shorts');
  assert.equal(result.outfit.TopOuter,'outer');
  assert.equal(result.issues.length,2);
  assert.equal(getStructuralIssues(outfit,{TopOuter:true},3,lookup).length,0);
  assert.equal(pool([shorts],'Bottom',{TopMid:'outer'}).length,0);
  assert.equal(pool([shorts],'Bottom',{TopMid:'outer'},emptyOutfitFilters,true).length,1);
});

test('mixed weights remain possible including a tee under a heavy coat in cold weather', () => {
  assert.equal(pool([wardrobe[0]],'TopInner',{TopOuter:'outer',Footwear:'shoe'},filters({climate:['Cold']})).length,1);
  assert.equal(score(wardrobe[0],'TopInner',{TopOuter:'outer'}).score,.8);
});

for (let mask=0; mask<8; mask++) test(`single-layer collapse transfers preferred eligible lock: ${mask}`, () => {
  const locks = Object.fromEntries(['TopInner','TopMid','TopOuter'].map((slot,index)=>[slot,Boolean(mask & (1<<index))]));
  const result = transitionOutfitLayering(outfit,locks,false,wardrobe);
  const preferred = ['TopOuter','TopMid','TopInner'].find(slot => locks[slot]) ?? 'TopOuter';
  assert.equal(result.outfit.TopInner,outfit[preferred]);
  assert.equal(Boolean(result.locked.TopInner),Boolean(locks[preferred]));
  assert.equal(result.outfit.TopOuter,null);
  assert.equal(result.outfit.TopMid,undefined);
  assert.equal(result.locked.TopOuter,undefined);
  assert.equal(result.locked.TopMid,undefined);
});

test('collapse discards invalid preferred garments before prioritizing locks and falls back strictly', () => {
  const result=transitionOutfitLayering({...outfit,TopOuter:'bottom'},{TopOuter:true,TopMid:true},false,wardrobe);
  assert.equal(result.outfit.TopInner,'mid'); assert.equal(result.locked.TopInner,true);
  const replacement=transitionOutfitLayering({TopOuter:'bottom'},{TopOuter:true},false,[wardrobe[0]],{itemsById:lookup});
  assert.equal(replacement.outfit.TopInner,'base'); assert.equal(replacement.locked.TopInner,undefined);
  const empty=transitionOutfitLayering({TopOuter:'bottom'},{TopOuter:true},false,wardrobe,{outfitFilters:filters({styleExcluded:['Casual']})});
  assert.equal(empty.outfit.TopInner,null);
});

test('expansion relocates single-layer outerwear and transfers its lock; contraction relocates Mid', () => {
  const expanded=transitionOutfitLayering({...outfit,TopInner:'outer',TopOuter:null,TopMid:null},{TopInner:true},3,wardrobe);
  assert.equal(expanded.outfit.TopOuter,'outer'); assert.equal(expanded.locked.TopOuter,true); assert.equal(expanded.locked.TopInner,undefined);
  assert.equal(expanded.outfit.TopInner,'base'); assert.equal(expanded.outfit.TopMid,'mid');
  const contracted=transitionOutfitLayering({TopInner:'base',TopMid:'mid'},{TopMid:true},true,wardrobe);
  assert.equal(contracted.outfit.TopOuter,'mid'); assert.equal(contracted.locked.TopOuter,true); assert.equal(contracted.locked.TopMid,undefined);
});

test('reroll removes departing item from context and alternatives; debug contains this action only', () => {
  const alt=garment('alt','Knit Sweater','Top',['Mid']);
  const result=rerollOutfitSlot([...wardrobe,alt],outfit,{},'TopMid',3,{itemsById:{...lookup,alt}});
  assert.equal(result.outfit.TopMid,'alt'); assert.equal(result.guidedDebugPayload.length,1);
  assert.equal(result.guidedDebugPayload[0].slot,'TopMid');
  assert.ok(!result.guidedDebugPayload[0].topCandidates.some(item=>['mid','alt'].includes(item.itemId)));
  assert.equal(rerollOutfitSlot(wardrobe,outfit,{},'TopMid',3).outfit.TopMid,null);
});

test('Mid shares explicit filter bonuses and climate values with Base; Headwear cannot influence style', () => {
  const f=filters({style:['Casual'],climate:['Warm']});
  const base=score(wardrobe[1],'TopInner',{},f).breakdown;
  const mid=score(wardrobe[1],'TopMid',{},f).breakdown;
  for(const key of ['styleCompletion','selectedStyleBonus','climate']) assert.equal(mid[key],base[key]);
  const formalHead=garment('head','Hat','Headwear',[],{styleTags:['Formal']});
  const a=getGuidedScoreBreakdown(wardrobe[1],'TopMid',{}, {...lookup,head:formalHead},filters({style:['Athleisure']}),null,{},[],3);
  const b=getGuidedScoreBreakdown(wardrobe[1],'TopMid',{Headwear:'head'}, {...lookup,head:formalHead},filters({style:['Athleisure']}),null,{},[],3);
  assert.deepEqual(a,b);
  assert.equal(score(wardrobe[0],'TopInner',{Bottom:'bottom',Footwear:'shoe'},filters({style:['Casual']})).breakdown.styleConflict,0);
});

test('affinity reads stored pairs from either endpoint once, accumulates Mid relationships, keeps caps', () => {
  const affinity=applyOutfitAffinityDelta({},outfit,1,3);
  assert.equal(affinity['pair|TopOuter|TopMid|outer|mid'],1);
  assert.equal(affinity['pair|TopMid|TopInner|mid|base'],1);
  assert.equal(affinity['pair|TopMid|Bottom|mid|bottom'],1);
  const pair={'pair|TopOuter|TopMid|outer|mid':1};
  assert.equal(score(wardrobe[2],'TopOuter',{TopMid:'mid'},emptyOutfitFilters,pair).breakdown.affinity,.14);
  assert.equal(score(wardrobe[1],'TopMid',{TopOuter:'outer'},emptyOutfitFilters,pair).breakdown.affinity,.14);
  assert.equal(score({...wardrobe[0],favorite:true},'TopInner').score,1.1);
  assert.equal(score(wardrobe[1],'TopMid',outfit,emptyOutfitFilters,Object.fromEntries(Object.keys(affinity).map(key=>[key,99]))).breakdown.affinity,.5);
  const inactive=applyOutfitAffinityDelta({},outfit,1,false);
  assert.ok(!Object.keys(inactive).some(key=>key.includes('TopMid')||key.includes('TopOuter')));
});

test('Random stays uniform despite favorites, affinity, and guidance weights', () => {
  const alt={...wardrobe[4],id:'alt',favorite:true};
  for (const [value,expected] of [[0,'shoe'],[.49,'shoe'],[.5,'alt'],[.999,'alt']]) {
    const result=random(value,()=>generate([wardrobe[4],alt],{}, {},false,{generationMode:'random',itemsById:{...lookup,alt},outfitAffinity:{'item|Footwear|alt':99}}));
    assert.equal(result.outfit.Footwear,expected);
  }
});

test('legacy keys canonicalize inactive assignments, merge liked collisions, preserve recent order', () => {
  const legacy=JSON.stringify({layering:false,slots:{Headwear:'head',TopInner:'base',TopOuter:'outer',Bottom:'bottom',Footwear:'shoe'}});
  const key=getOutfitKey(outfit,false);
  assert.equal(JSON.parse(key).slots.TopOuter,null); assert.equal('TopMid' in JSON.parse(key).slots,false);
  assert.deepEqual(normalizeLikedOutfitKeys({[legacy]:true,[key]:true,unknown:true}),{[key]:true,unknown:true});
  const recent=normalizeRecentOutfits([{outfit,layering:false},{outfit:{...outfit,TopOuter:null},layering:false,liked:true},{outfit:{TopInner:'mid'},layering:false}]);
  assert.equal(recent.length,2); assert.equal(recent[0].liked,true); assert.equal(recent[1].outfit.TopInner,'mid');
  assert.equal(score(wardrobe[2],'TopOuter',{},emptyOutfitFilters,{},recent).breakdown.recentItemPenalty,0);
});

test('debug signature invalidates filters, metadata, likes, locks, source, recent history, and actions', () => {
  const context={outfit,locked:{},layering:3,itemsById:lookup,items:wardrobe,outfitFilters:emptyOutfitFilters,generationLists:defaultGenerationLists,excluded:{},generationMode:'guided',outfitAffinity:{},recentOutfits:[]};
  const original=getGenerationDebugSignature(context);
  for(const change of [
    {outfit:{...outfit,TopInner:null}}, {locked:{Bottom:true}}, {layering:false},
    {items:wardrobe.slice(1)}, {outfitFilters:filters({style:['Casual']})},
    {itemsById:{...lookup,base:{...lookup.base,weight:'Heavy'}}},
    {outfitAffinity:{'item|Bottom|bottom':1}}, {recentOutfits:[{outfit,layering:3}]}
  ]) assert.notEqual(getGenerationDebugSignature({...context,...change}),original);
});

test('Mid enforces shirt-on-shirt and exact non-stackable restrictions', () => {
  const shirt=garment('shirt','Shirt','Top',['Base','Mid']);
  const other=garment('other','Casual Shirt','Top',['Base','Mid']);
  const sweatshirt=garment('sweat','Sweatshirt','Top',['Base','Mid']);
  const otherSweat={...sweatshirt,id:'otherSweat'};
  const byId={shirt,other,sweat:sweatshirt,otherSweat};
  for (const [candidate,context] of [[shirt,{TopInner:'other'}],[other,{TopInner:'shirt'}],[sweatshirt,{TopInner:'otherSweat'}]]) {
    assert.deepEqual(getEligibleSlotPool([candidate],'TopMid',{},defaultGenerationLists,3,emptyOutfitFilters,null,context,byId),[]);
  }
});

test('a Mid formal shirt anchors bridge footwear when Base cannot', () => {
  const shirt=garment('shirt','Shirt','Top',['Mid'],{styleTags:['Formal']});
  const trousers=garment('trousers','Trousers','Bottom',[],{styleTags:['Formal']});
  const shoes=garment('leather','Leather Sneakers','Footwear',[],{styleTags:['Casual','Smart Casual']});
  const byId={...lookup,shirt,trousers,leather:shoes};
  const candidates=getEligibleSlotPool([shirt,trousers,shoes,...wardrobe],'Footwear',{},defaultGenerationLists,3,filters({style:['Formal']}),null,{TopInner:'base',TopMid:'shirt',Bottom:'trousers',TopOuter:'outer'},byId);
  assert.ok(candidates.some(item=>item.id==='leather'));
});

test('liked recent pair boosts work in both selection directions and weights reach the floor transparently', () => {
  const recent=[{outfit,layering:3,liked:true}];
  assert.equal(score(wardrobe[2],'TopOuter',{TopMid:'mid'},emptyOutfitFilters,{},recent).breakdown.recentLikedBoost,.12);
  assert.equal(score(wardrobe[1],'TopMid',{TopOuter:'outer'},emptyOutfitFilters,{},recent).breakdown.recentLikedBoost,.12);
  const history=Array.from({length:8},(_,index)=>({outfit:{...outfit,Headwear:`head${index}`},layering:3}));
  const result=score(wardrobe[0],'TopInner',{},emptyOutfitFilters,{},history);
  assert.equal(result.score,.3);
  assert.ok(result.breakdown.minimumWeightAdjustment>0);
  assert.equal(result.breakdown.startingWeight,.8);
});

test('other transitions keep valid placements before relocating displaced locked garments', () => {
  const outer2={...wardrobe[2],id:'outer2'};
  const result=transitionOutfitLayering({TopInner:'base',TopMid:'outer2',TopOuter:'outer'},{TopMid:true},true,wardrobe,{itemsById:{...lookup,outer2}});
  assert.equal(result.outfit.TopOuter,'outer');
  assert.equal(result.locked.TopMid,undefined);
  assert.equal(result.locked.TopOuter,undefined);
});

test('both modes consume random selections in Bottom, Outer, Footwear, Mid, Base, Headwear order', () => {
  const items=wardrobe.flatMap(item=>[{...item,weight:'Medium'},{...item,id:`${item.id}2`,weight:'Medium'}]);
  const byId=Object.fromEntries(items.map(item=>[item.id,item]));
  for (const generationMode of ['guided','random']) {
    const previous=Math.random;
    const samples=[.1,.9,.1,.9,.1,.9];
    Math.random=()=>samples.shift();
    try {
      const result=generate(items,{}, {},3,{generationMode,itemsById:byId});
      assert.deepEqual(generationOrder.map(slot=>result.outfit[slot]),['bottom','outer2','shoe','mid2','base','head2']);
      assert.equal(samples.length,0);
    } finally {Math.random=previous;}
  }
});

test('debug records actual pre-selection contexts and expected post-action history', () => {
  const result=generate();
  const receipt=result.guidedDebugPayload[0].selectionContext;
  assert.deepEqual(receipt.recentOutfits,[]);
  assert.equal(receipt.expectedPostActionRecentHistory[0].key,getOutfitKey(result.outfit,3));
  assert.equal(receipt.metadata.length,wardrobe.length);
  for(const [index,entry] of result.guidedDebugPayload.entries()) {
    assert.equal(entry.selectionOutfit[entry.slot],null);
    for(const preceding of result.guidedDebugPayload.slice(0,index)) assert.equal(entry.selectionOutfit[preceding.slot],preceding.itemId);
  }
  const reroll=rerollOutfitSlot(wardrobe,outfit,{},'TopInner',3);
  assert.equal(reroll.guidedDebugPayload[0].selectionContext.outfit.TopInner,null);
  assert.deepEqual(reroll.guidedDebugPayload[0].selectionContext.expectedPostActionRecentHistory,[]);
});

for (const start of [false,true,3]) test(`layer toggles restore the same upper outfit from ${start}`, () => {
  const initial=generate(wardrobe,{}, {},start).outfit;
  let current=initial, locks={TopInner:true}, mode=start, memory={};
  for(let step=0;step<9;step++) {
    const nextMode=mode===3 ? false : mode ? 3 : true;
    const result=transitionOutfitLayeringWithMemory(current,locks,mode,nextMode,wardrobe,memory,{itemsById:lookup});
    current=result.outfit; locks=result.locked; memory=result.memory; mode=nextMode;
    if(mode===start) {
      assert.equal(getOutfitKey(current,mode),getOutfitKey(initial,start));
      assert.equal(locks.TopInner,true);
    }
  }
});

test('hidden layer memory stays outside the active outfit and revalidates restored garments', () => {
  const collapsed=transitionOutfitLayeringWithMemory(outfit,{},3,false,wardrobe);
  assert.equal(collapsed.outfit.TopMid,undefined);
  assert.equal(collapsed.outfit.TopOuter,null);
  const changedLookup={...lookup,mid:{...lookup.mid,garmentType:'Bottom'}};
  const restored=transitionOutfitLayeringWithMemory(collapsed.outfit,collapsed.locked,false,3,[],collapsed.memory,{itemsById:changedLookup});
  assert.equal(restored.outfit.TopMid,null);
  assert.equal(restored.outfit.TopInner,'base');
  assert.equal(restored.outfit.TopOuter,'outer');
});

test('changing the active outfit invalidates hidden layer memory', () => {
  const collapsed=transitionOutfitLayeringWithMemory(outfit,{},3,false,wardrobe);
  const changed={...collapsed.outfit,TopInner:'mid'};
  const restored=transitionOutfitLayeringWithMemory(changed,{},false,3,[],collapsed.memory,{itemsById:lookup});
  assert.equal(restored.outfit.TopMid,'mid');
  assert.equal(restored.outfit.TopInner,null);
  assert.equal(restored.outfit.TopOuter,null);
});
