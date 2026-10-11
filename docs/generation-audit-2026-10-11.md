# Outfit generation audit — 11 October 2026

Audited implementation at commit `08ba730`. This is a source-code audit with targeted runtime reproductions, not a change to generation behavior. Existing suite: **395/395 tests pass**. Six targeted reproduction cases confirm the issues described below. Primary implementation: `src/lib/generation.js`; integration and debug UI: `src/App.jsx`; metadata defaults and type aliases: `src/lib/typeDefaults.js`.

## Main conclusion

Guided generation is a sequential, rule-filtered, weighted lottery. It does not optimize or rate a complete outfit, does not choose the highest-scoring item automatically, and does not use an AI model. It combines hand-written type/style/climate rules with favorites, like-derived affinity, and recent-outfit memory.

The current implementation is substantially designed around two upper-body slots. Three-layer eligibility works, but several scoring, climate, affinity, and transition behaviors have not been fully extended to the middle slot.

## Findings, in recommended order

| Priority | Finding | Observable consequence | Source |
|---|---|---|---|
| High | Explicit style/climate exclusions are relaxed with other context rules when the resulting pool is empty. | A Hot filter plus “exclude Casual” still returns a medium Casual beanie if that is the only headwear candidate. | `generation.js:1182`, `generation.js:1252` |
| High | Full generation builds its item lookup from the already collection/favorite-filtered source list. Locked items outside that list keep their IDs but cannot be inspected. | A locked shirt outside the selected collection plus an eligible mid-layer shirt can produce shirt-on-shirt. Climate, style, formal structure, and affinity context can also miss the locked garment. | `App.jsx:2971`, `generation.js:1996` |
| Medium | Reroll scoring includes the old item in the slot being replaced. | A heavy candidate replacing a light T-shirt receives an extreme-weight penalty even if no light garment will remain. Old style tags can also anchor the reroll and influence coherence/dominance. | `App.jsx:5197`, `generation.js:1740` |
| Medium | Middle-layer support is incomplete. | No TopMid selected-style bonus or style-completion bonus; no dedicated hot/cold top scoring; generic climate-chip weight; no learned pair affinities involving TopMid. A candidate is therefore treated differently when moved from Base to Mid. | `generation.js:504`, `generation.js:795`, `generation.js:1405`, `generation.js:1769`, `generation.js:105` |
| Medium | Debug “Style target” does not show the actual sampled no-filter target. | With no style filter, the label is the finished outfit’s classified style. The internal target is not returned in the debug payload, so the UI cannot tell you whether generation followed or drifted from it. | `App.jsx:2941`, `generation.js:1340`, `generation.js:2024` |
| Medium | Debug snapshots are checked against selected item IDs only. | Changing filters, item metadata, layering, likes, or other scoring context while keeping those IDs can leave old scores/reasons beside new context labels. Locked slots have no debug entries, so changing them may also leave other slots’ explanations apparently valid. | `App.jsx:2911` |
| Medium | Rerolls and fallback explanations do not receive a shared no-filter generation context. | Until an existing style anchor is available, the fallback target can be sampled separately for each candidate/scoring call. Candidate scores are then not necessarily based on the same target. | `App.jsx:5197`, `generation.js:1725`, `generation.js:2087` |
| Medium | The two-layer outer item is not revalidated when switching from 2 to 3 layers. | A shirt or sweater allowed in the outer position in mode 2 can remain there in mode 3 despite having no Outer role. A subsequent full generation corrects an unlocked slot. | `App.jsx:5281` |
| Low | A locked TopOuter survives full generation in single-layer mode. | It is hidden but can still affect style/context calculations, outfit keys, and memory. The locked check happens before the single-layer cleanup. Switching 3→1 also leaves the old outer ID until another operation clears it. | `generation.js:2004`, `App.jsx:5317` |
| Low | No-filter `avoidStyle` is created but dropped before preference scoring. | The specific avoidance subtraction in `getNoFilterPreference` never activates through the normal context builder. Other anti-streak mechanisms still work. | `generation.js:1362`, `generation.js:1725` |
| Low | “Top alternatives” includes the selected item. | It is a list containing the selection plus up to four highest-scoring others, sorted together—not the five best alternatives. If the selected item ranks low, the true fifth-best candidate is omitted. | `generation.js:1850` |

These priorities are recommendations. Some fallbacks may be deliberate product choices; their current behavior still differs from what “exclude” and “hard rule” normally imply.

### Confirmed reproduction results

Targeted calls against the actual exported functions produced:

```text
Only beanie available, Hot + exclude Casual: eligible pool = [beanie]
Locked Base shirt absent from source items: generated Mid = another shirt
Heavy top reroll, old light tee still in context: weightContrast = -0.90
Same candidate with old tee removed: weightContrast = 0
Formal shirt scored as TopMid: styleCompletion = 0, selectedStyleBonus = 0
Single-layer generation with locked outer: outer ID survives
```

The suite passing does not contradict these results: existing tests mostly exercise supported wardrobes with alternative candidates; they do not cover all fallback, filtered-lock, and three-layer cases.

## 1. End-to-end selection process

1. App filters the source library by favorite inclusion/exclusion and collections. Included collections use **any match**, excluded collections reject **any match**.
2. Generation copies the current outfit, clears unlocked visible slots, and retains locked IDs. Accessories are copied but are not part of the full generation loop.
3. With no explicit style selection, it builds one weighted target-style context for a full generation run.
4. It visits slots in this fixed order: **Headwear → Base → Mid → Outer → Bottom → Footwear**. Mid is skipped outside mode 3; Outer is skipped in single-layer mode, subject to the locked-slot issue above.
5. Each slot’s pool passes category/role/status/exclusion checks, top-layering checks, context checks, and compatibility checks.
6. Random mode chooses uniformly from the resulting pool. Guided mode scores every remaining candidate, then uses its score as its lottery weight.
7. The selection is immediately added to the partial outfit and affects all later slots. Locked items can influence selections from the start, when they are present in the lookup.
8. Empty eligible pools produce `null` slots. There is no overall backtracking, resampling of earlier selections, complete-outfit repair pass, or final validity guarantee.
9. Full Guided generation records the result in recent memory and captures per-selected-slot scoring snapshots. Full Random generation does not add its result to recent memory here.

This order makes early choices influential. Headwear is chosen before the main garments; its style tags count toward anchoring just like a coat or trousers. The generator does not pick a central garment first and then find the best complete set around it.

### Other ways to change an outfit

| Action | Current behavior |
|---|---|
| Full Generate | Sequential selection as above; respects visible-slot locks. |
| Reroll one slot | Eligible pool against current outfit, excludes current item, then Guided or Random selection. Can clear the slot if no different candidate exists. Does not capture a fresh detailed debug payload or add recent memory in this handler. |
| Cycle previous/next | Moves through eligible pool order, not score order. |
| Manual slot picker | Uses the full library and bypasses generation status filtering by passing `null`; still applies category/roles, top duplication rules, and compatibility fallback. Style/climate/collections/favorite generation filters do not constrain this base pool. |
| Switch layering | Fills newly needed slots with uniform `pickRandom`, even in Guided mode. Existing items are not fully revalidated. |
| Accessories | Full Generate preserves them. Accessory option selection uses category/slot/status/item-exclusion checks; it is not part of the Guided full-outfit scoring loop. |
| Load saved outfit | Restores saved slots/layering and adds the loaded outfit to recent memory. It is not regenerated to satisfy current filters. |

## 2. Eligibility and rule strength

### Strict pool restrictions

- Garment category must fit the slot.
- Status must be enabled; by default only Wardrobe is enabled. Item exclusion also removes a candidate. Unrecognized preserved statuses inherit Wardrobe inclusion unless explicitly configured.
- Favorite and collection source restrictions are strict for newly selected items.
- Base requires Base role when layering is active. Mid requires Mid role in mode 3. Outer requires Outer role in mode 3; in mode 2 it accepts **Mid or Outer**.
- Single-layer Base accepts any Top or Outerwear, regardless of its layer roles.
- Top slots cannot repeat an item ID or pair two recognized shirts. Two exactly normalized `sweatshirt` types or two exactly normalized `jacket` types are blocked. This latter rule uses exact type strings, not the broader type-alias matching used elsewhere.
- Locks preserve existing selections; locks do not certify that those items satisfy current filters or rules.

Top-layer restrictions do not have an empty-pool fallback. They can leave a slot blank. “No two shirts” covers shirt/overshirt variants recognized by the shared classifier, and excludes T-shirts and sweatshirts from the shirt category.

### Context restrictions with empty-pool fallback

All of the following are applied together. If **no candidate survives**, the function returns the pool from before these context checks. It does not relax only the least important rule, report the conflict, or keep explicit exclusions inviolable.

| Context | Attempted restriction |
|---|---|
| Excluded styles | Reject an item carrying any excluded style tag. |
| Excluded climates | Reject an item carrying any excluded inferred or manual climate tag. |
| Hot | Reject heavy Outerwear in TopOuter, wool coats in any slot, and beanies in Headwear. |
| Warm | Reject non-light beanies in Headwear. |
| Cold / Snow | Reject shorts/slides/sandals and sport tees in Base. With a light/sport tee already in Base, reject heavy Outerwear in Outer and boots in Footwear. |
| Rain | Reject slides/sandals. |
| Smart/Formal shirt in Base | Reject shorts in Bottom, even without a coat. Also checks an outerwear/shorts combination when evaluating Outer. |
| Selected style and existing anchors | Apply the style profiles below. |

The Cold rule against a tee under heavy outerwear is a taste heuristic, not a physical insulation model. It also does not recognize an insulating Mid as a reason to allow that combination.

### Compatibility fallback

Heavy Outerwear and warm-weather pieces—exact type `shorts`, or slide/sandal footwear—are treated as incompatible. This is checked when selecting **TopOuter, Bottom, or Footwear**. If every candidate is incompatible, the original pool is returned. Base and Mid do not run this compatibility filter, even if Outerwear is assigned those roles.

## 3. Style setup, targets, and dominant style

There are only four style tags: **Casual, Smart Casual, Formal, Athleisure**. Nonempty manual item tags replace inferred default tags. An empty tag list falls back to type defaults; it does not mean “style neutral.”

Examples of defaults:

| Type | Default styles |
|---|---|
| T-shirt / jeans / ordinary jacket | Casual |
| Shirt / trousers | Smart Casual + Formal |
| Sweatshirt / hoodie / ordinary sneakers | Casual + Athleisure |
| Knit sweater / twill jacket / leather sneakers / boots | Casual + Smart Casual |
| Sport tee / sport cap / sport pants | Athleisure |
| Wool coat / blazer / derby | Formal + Smart Casual (order varies by type) |

Rules often use type aliases in addition to tags. Changing an item’s tags alone does not necessarily remove a type-based prohibition.

### Selected-style modes

Casual can accompany the other selections without creating a separate mixed mode.

| Selected non-Casual styles | Internal profile |
|---|---|
| None, with Casual selected | Casual |
| Formal | Formal |
| Smart Casual | Smart Casual |
| Athleisure | Athleisure |
| Formal + Smart Casual | Formal bridge |
| Formal + Athleisure, including all three | Minimal |
| Smart Casual + Athleisure | Minimal bridge |
| No style selected at all | No-filter target sampling |

“Minimal” and “minimal bridge” are internal profile names, not extra metadata styles. They mainly avoid the exclusive single-style blocklists; later anchors can still constrain the result.

### Attempted style blocklists

- **Formal:** blocks shorts, slides, sandals, sport caps, beanies, fleece/shell jackets, hoodies, sweatshirts, sport tees, fleece sweaters, Athleisure-only items, and sneakers carrying Athleisure. Footwear must have Formal or Smart Casual support, or qualify as non-Athleisure leather sneakers. Also applies formal structure checks.
- **Formal bridge:** blocks shorts, slides, sandals, sport caps, beanies, fleece/shell jackets, hoodies, sweatshirts, and sport tees. It does not apply strict Formal’s structure requirement.
- **Smart Casual:** blocks slides/sandals, sport caps, beanies, fleece/shell jackets and sweaters, sport tees/long-sleeve tees/shorts, hoodies, sweatshirts, ordinary/thin/canvas sneakers, and Athleisure-only items.
- **Athleisure:** blocks derby shoes, wool coats/jackets, blazers, shirts/wool shirts, Formal-only items, and items whose styles are all Smart Casual/Formal.
- **Casual / mixed minimal modes:** no equivalent standalone blocklist.
- **Existing Smart Casual/Formal anchor:** additionally blocks sport caps/tees/long-sleeve tees/shorts and Athleisure-only items.
- **Existing Athleisure anchor:** additionally blocks derby shoes, jackets, jeans, boots, and Formal-only items.

All these style context checks remain subject to empty-pool fallback, including anchor restrictions in Random mode.

### Formal structure

Core slots are active upper-body slots, Bottom, and Footwear; Headwear is excluded. Strong anchors are Shirt in Base, trousers in Bottom, derby in Footwear, and blazer/wool coat/wool jacket in Outer. Mid has no strong-anchor classification.

Bridge items include non-Athleisure leather sneakers, boots, knit garments, and items with Casual + Smart Casual but no Formal. An attempted strict Formal outfit requires:

- At least two strong formal anchors, counting potential anchors in unfilled slots.
- At most two bridge items, counting slots forced to be bridges.
- At least as many potential/actual strong anchors as potential/actual bridges.
- Bridge footwear requires strong Shirt Base and trousers Bottom.
- A non-anchor Bottom requires derby footwear, or a remaining derby possibility.

The forward check looks for eligible possibilities in remaining slots. It is not a full search proving all of those possibilities can coexist.

### Dominant style and anchoring

Each item gives one vote to **each** of its style tags. Multi-tag items are not divided into fractional votes. Most votes wins. Ties follow insertion order, which depends on slot order and tag order.

The style chip prefers the first selected style within one vote of the leader. The debug “Dominant style” uses the same classifier without selected-style preference. Consequently those two labels can disagree.

An internal anchor normally forms after at least two picked items and at least two votes for a leading style. Without explicit style filters, a sport cap/tee/long-sleeve tee/shorts can anchor Athleisure immediately. After anchoring, later preferences tend to follow the emerging outfit rather than the initially sampled target.

After two picked items share a leading style, the internal scoring mode can also override the selected-style profile. Explicit filter matching still contributes separately, so a candidate can receive competing signals.

### No-filter variety

Starting weights are Casual **0.35**, Smart Casual **0.30**, Athleisure **0.20**, Formal **0.15**. These are inputs, not final output percentages. They are adjusted for:

- Eligible library style support, counting tags rather than complete buildable outfits.
- Up to eight recent dominant styles; recent-share denominator is at least four.
- Absence boost: +0.16 for unseen styles, +0.24 for unseen Athleisure; smaller boosts for styles seen once.
- Overshare reduction: `max(0, recentShare - baseWeight) × 1.8`.
- Repeat reduction: 1.05 for the style of both last outfits; otherwise 0.24 for the latest style.
- Support multiplier clamped to at least 0.2, at most 1.15 (Formal 1.08).
- Smart Casual bias ×1.10; Formal bias ×0.82; minimum final weight 0.02.

If the last two styles match and another style has weight above 0.08, the repeated style is removed from initial target sampling. When choosing the final unfilled slot, another safeguard removes candidates that would repeat that style, if any streak-safe candidates exist. That last safeguard is a genuine pool restriction within Guided selection, beyond soft score penalties.

No-filter preference combines average style weight ×4.4, average pool tag support ×1.2, target/anchor matches and several Smart Casual/Athleisure/Formal adjustments. The preference enters both style coherence and no-filter variety, so those labels partly represent the same signal.

## 4. Points, probabilities, ratings, and penalties

For each eligible candidate:

```text
component = clamp(raw component × scale, minimum, maximum)
selection weight = max(0.3, 0.8 + sum(all components))
probability = selection weight / sum(weights of eligible candidates)
```

Example: candidates weighing 6, 3, and 1 have probabilities 60%, 30%, and 10%. The 1-point candidate can still win. A very poor candidate has a positive 0.3 floor if it remains in the pool. There is no probability threshold, top-N-only draw, temperature/softmax, numeric user rating, whole-outfit score, or visual/color compatibility scoring.

### Every score component

The ranges below are configured bounds **after** multiplication and clipping. Some bounds are broader than reachable values in ordinary current execution.

| Debug reason / component | Scale | Bounds | What it measures |
|---|---:|---:|---|
| Climate suitability | .45 | -1.5 to +2 | Requested climate tag overlap and type-specific climate adjustments. |
| Style match | .28 | -3 to +2.5 | Selected-style overlap, existing dominant tags, type conflicts; no-filter preference ×.4 when applicable. |
| Style completion | .40 | 0 to +2.5 | Canonical pieces for the internal style mode. Raw negative values are clipped to zero. |
| Style consistency | .60 | -2 to 0 | Emerging Formal vs Athleisure, Formal vs Casual-only, Smart Casual vs Athleisure-only. |
| Extreme weight mix penalty | .60 | -1 to 0 | Heavy candidate with any Light picked item, or reverse: raw -1.5 → **-.90**. |
| Cross-style conflict penalty | .65 | -1.5 to 0 | Formal/Athleisure mixing: raw -2.2 → **-1.43**, except when both are explicitly selected. |
| Outerwear adjusted for heat | .65 | -1.5 to 0 | Outerwear in TopOuter with Hot selected; combines two heat penalties and normally reaches **-1.5**. |
| Lonely extremes penalty | .60 | -.8 to 0 | Exactly one Heavy with ≥2 Light: **-.69**; one Light with ≥2 Heavy: **-.60**. |
| Clean baseline outfit | .70 | 0 to +1 | Shirt Base **+.63**, tee Base **+.56**, jeans/trousers Bottom or sneakers Footwear **+.84**. |
| Early style anchoring | .55 | 0 to +1.2 | Type bonuses before two items are picked; never for Headwear. |
| Selected style bonus | .45 | 0 to +1.4 | Matching explicit style: raw 2.8 Formal, 2.6 Athleisure, 2.2 Smart Casual, otherwise 1.2. Not Headwear or Mid. |
| Favorite item boost | .60 | 0 to +.3 | Favorite raw .5 → **+.30**. |
| Liked combo affinity | 1 | 0 to +.5 | Learned directional pairs and per-slot item likes. |
| Recent item repetition penalty | 1 | -.8 to 0 | Recent item reuse, plus same-slot reuse. |
| Exact outfit repetition penalty | 1 | -.5 to 0 | Exact completed outfit key in recent history. |
| Recent like combo boost | 1 | 0 to +.35 | Recently liked directional pairs matching current context. |
| Outerwear added for cold | .45 | -1.2 to +1 | Cold/Snow Outer slot: Outerwear raw +3 → **+1**; Top raw -4 → **-1.2**. |
| No-filter style variety | .14 | -.4 to +1 | No-filter preference ×.65 before normalization. |
| Cold light-top penalty | .28 | -1.2 to 0 | Light tee with heavy Outerwear or boots: **-.728**; both: **-1.176**. |
| Mixed-season penalty | .32 | -1.8 to 0 | Smart/Formal shirt + shorts + medium/heavy Outerwear: **-1.76**. |
| Style streak penalty | 1 | -.5 to 0 | Completed style equals last two: **-.5**; equals latest with ≥2 history entries: **-.2**. |

### Style-match raw points

- Selected-style overlap: +4 Casual mode; +6 other modes.
- No overlap: -5.5 Athleisure-only or Formal-only; otherwise -3.
- Formal/Formal-bridge tee types: -4.8; strict Formal cap -2.6 or jeans -2.
- Strict Formal non-Formal footwear: -5.4 leather sneakers, otherwise -6.
- Smart Casual sports/sandals/fleece/shell types: -4.5; hoodie/sweatshirt -2.6.
- Athleisure shirt/wool shirt/blazer/derby/wool outerwear: -6; entirely Smart Casual/Formal tags: -5.4.
- Existing dominant-tag overlap: +2 per overlapping tag. No overlap: -3 for Athleisure-only against non-Athleisure preference, otherwise -1.
- With no selected styles, add no-filter preference ×.4.

Several of these penalties are usually redundant with context filtering, but become relevant when fallback restores blocked candidates. Selected style can influence style match, completion, early anchoring, and selected-style bonus simultaneously.

### Style-completion raw points

| Mode | Main rewards |
|---|---|
| Formal | Shirt Base +6, trousers +6, derby +6, Formal-tag footwear another +2.4, blazer/wool-coat Outer +6, hat +1.5. |
| Formal bridge | Shirt/trousers/derby +3.5; leather sneakers +2.2; blazer/wool coat +3.5, jacket/wool jacket +2; hat +1.2. |
| Smart Casual | Shirt/wool-shirt Base +4.8, knit/casual-shirt/fleece Base +3.8; leather sneakers +4.2, boots +2.8, derby +1.6; blazer/wool coat Outer +4.2, other listed jackets +3.2; trousers +3.5, jeans +1.2, hat +1. |
| Athleisure | Sport tees Base +5, hoodie/sweatshirt/fleece Base +4.4; sneakers +4.8; sport cap +4.8, cap +3.8; shell/fleece Outer +4.4; sport shorts/pants +4.8, sweat pants +4.2, shorts +1.8. |
| Casual / minimal / minimal bridge | No dedicated completion rewards. |

Raw completion deductions for Formal cap/jeans/tees and bridge jeans are clipped to zero by this component’s nonnegative bounds. They do not create a negative completion penalty. Watch/belt completion branches exist but are not exercised by full outfit generation because accessories are outside its loop.

### Likes and memory

Outfit Like increments per-item/per-slot counts and these directional pairs:

```text
Base → Bottom
Bottom → Footwear
Outer → Base
Outer → Bottom
```

Pair bonus is `.14 × count`, capped at .35 per pair; item bonus `.05 × count`, capped at .20; combined cap .50. Unliking reverses the increments, floored at zero. This is supportive positive reinforcement, not a learned model or negative rating system. Saving an outfit or favoriting a saved outfit is not itself the like-affinity operation.

Direction and generation order matter: Outer→Base is normally unused during a fresh unlocked full generation because Base is chosen before Outer. It can matter with a locked Outer or when rerolling Base. Mid receives item affinity but has no pair relationships.

Recent memory stores the latest **eight distinct outfit keys**, moving repeated keys to the front rather than keeping every event. Outfit keys include layering and visible-slot IDs, but not accessory IDs. Therefore accessory-only changes do not distinguish likes/exact-repetition keys.

Item-use penalties for recent positions 1–5 are `.22, .11, .04, .02, .01`, with extra same-slot penalties `.08, .04, .01, .005, .005`. Total cap -.8; with a normal single occurrence per distinct recent entry the current steps sum to at most -.54. Exact-repeat steps for positions 1–4 are `.4, .2, .1, .05` (cap -.5); distinct-key history means one matching key normally contributes only one step. Recent liked-pair rewards use `.12, .08, .04, .02` for positions 1–4, capped at +.35 overall.

Exact-repeat and completed-style checks require **every active slot to be populated**, including Headwear. If an optional-looking slot remains empty, those protections do not activate. Rerolls/cycling do not update memory in their handlers; full Guided generation, likes, and loading saved outfits do.

## 5. Climate, weather, and the debug climate label

### Climate input

Only explicitly applied climate filters guide generation. Merely loading weather does nothing to selection; `weatherData` is passed through but ignored by the preference resolver. “Apply weather” replaces included climates with suggestions while leaving other filter fields, including excluded climates, in place.

Weather suggestions are Hot at **≥21°C**, Warm at **16–<21°C**, Transitional at **8–<16°C**, Cold below **8°C**, with Rain/Snow added from weather condition codes. There is no direct temperature score, wind/chill/insulation/material model, or hourly planning.

Multiple selected climates add their scores and combine their context restrictions; this is not a choice of one climate. Hot + Cold can create contradictory demands and trigger pool fallback.

### Item climate inference

Manual climate tags are **added to** inferred tags; they do not override or remove them. The editor exposes Rain and Snow, while the engine understands all six climates.

- Hot: Light or tee/shirt/shorts/sandals type; excludes Heavy, Outerwear, coat, boots.
- Warm: Light/Medium or listed light everyday types; excludes Heavy, coat, boots, beanie, scarf.
- Cold/Snow: Heavy, Outerwear, or listed coat/jacket/knit/sweatshirt/hoodie/boots/beanie/scarf types; excludes shorts/sandals.
- Rain: any Outerwear or coat/jacket/boots/cap/shell type. This is broad suitability inference, not evidence of waterproofing.
- Transitional: Medium or listed jacket/knit/shirt/trousers/jeans/sneakers/blazer types; excludes Heavy, shorts, coat.

Because inferred climates overlap, excluding one climate can remove garments useful for another. For example, excluding Rain removes many ordinary jackets and caps.

### Raw climate scoring before ×.45 and clipping

Every matching requested climate tag adds **+1.4**. Additional rules:

| Climate | Type/slot adjustments |
|---|---|
| Hot | Cap +1.6; light beanie -1.5, other beanie -4.5. Base tee/shirt +3, LS tee +1, sweatshirt/knit/hoodie/wool shirt -2. Bottom shorts/trousers +2, jeans +1. Footwear sneakers/canvas +2, slides/sandals +1, boots -2. Outerwear Outer -4 Heavy or -2 other. Scarf -5. |
| Warm | Cap +1.1; light beanie -.8, other -2.6. Tee/shirt/sneakers/canvas/trousers/shorts +1. Heavy Outerwear -2. Scarf -3. |
| Cold/Snow | Base knit/sweatshirt/hoodie +3, shirt/wool shirt +1, tee -2. Outer wool coat/jacket +4, listed other jackets +2, other Outerwear +1, non-Outerwear -4. Footwear boots +3, leather sneakers +1, canvas -1. |
| Rain | Outerwear Outer +2; boots Footwear +2. |
| Transitional | Listed jacket/shirt/trousers/jeans/sneakers/blazer types +1; Heavy -1. |

Soft heat/cold outerwear components apply in addition to this climate score. Mid gets climate tag overlap and any non-slot-specific rules, but misses Base/Outer-specific logic.

### Debug “Climate” is an output classification

It classifies the finished garments; it does **not** display requested climate or current weather. It scores six climates separately from Guided candidate scoring, using active non-accessory slots:

- Outerwear Outer gets weight 2.7 Light, 3.2 Medium, 4.1 Heavy, or 4.6 for heavy coat/puffer/wool types. Non-Outerwear Outer gets 1.9.
- Base gets 1.1/1.45/1.8 for Light/Medium/Heavy.
- Bottom gets 1.9, or 2.1 Heavy. Footwear gets 2.2, or 2.8 Heavy.
- Headwear gets .55; Mid falls through to generic **1.0**.
- Each inferred/manual climate tag receives that weight. Type bonuses then favor cold coats/boots, warm tees/shorts/sandals, transitional trousers/jackets, and rain combinations.
- Heavy coat + boots adds another +3.2 Cold and reduces Warm/Hot; shell jacket gives +2.2 Rain; sufficient rain cues add +1.8 Rain. Several close-score adjustments favor Warm over Hot, Cold over Snow, and Transitional over Warm.
- Highest score wins; ties prefer Transitional, Warm, Hot, Cold, Snow, Rain in that order. Maximum ≤.75 or no garments yields Everyday.

The climate chip’s points are separate from the per-slot “Climate suitability” reason. Neither is a real-world weather guarantee.

## 6. What the debug view does and does not explain

- **Mode:** current Guided/Random setting. Random hides score details, though its pool still uses the same context restrictions and fallbacks.
- **Style target:** explicit style filters joined together; with none, the current style chip. It is not the sampled internal target.
- **Climate:** finished-outfit climate classification described above.
- **Dominant style:** unweighted tag-vote winner over visible-slot IDs, without selected-style preference. This differs from the style chip, which can include accessories through `currentOutfitItems` and prefers selected styles near the lead. Hidden retained outer IDs can also affect these style calculations.
- **Selected score:** the normalized selection weight at that slot’s selection time. Later choices did not exist yet. It is not a rating of the item in the finished outfit.
- **Reasons:** only the three largest components by absolute magnitude, rounded to one decimal. Base .8, omitted components, and the .3 floor explain why visible reasons do not add up to the selected score. Zero-valued reasons can appear.
- **Top alternatives:** selected candidate plus at most four highest-scoring others, all sorted together. There are no probabilities or pool-size indicators.
- **Fallback summary:** reconstructs sequential scoring when detailed payload IDs no longer match. It uses default status settings, no shared no-filter target context, and the full item lookup rather than reproducing collection filtering. It is approximate, not a historical account of the original choice.
- **Summary values:** averages over slots where the component is nonzero, not sum and not average over all slots; shows up to six components, preferring absolute values ≥.2.
- No display of rejected candidates, exclusion reasons, fallback activation, actual target/anchor changes, raw points, full component breakdown, random draw, or final validation.

## 7. Recommended follow-up work

1. Split inviolable exclusions from relaxable taste rules. Show an empty slot/conflict when an explicit exclusion leaves no candidate; disclose any permitted relaxation.
2. Separate the complete wardrobe lookup from the selectable source pool so locks always participate in validation and scoring.
3. Score replacements against an outfit with the replaced slot removed. Reuse one stable target context for every candidate in a reroll and for debug reconstruction.
4. Complete Mid support across climate, style completion, selected-style bonuses, formal structure, pair affinities, active-slot cleanup, and layer transitions.
5. Return actual sampled target, anchors, eligible-pool size, probabilities, filtering reasons, relaxation events, and scoring-context identity in the debug payload. Label selection weights accordingly.
6. Decide whether generation should remain a sequential lottery or sample multiple complete outfits and rank/validate them. The latter would reduce early-slot bias and allow stronger whole-outfit rules.
7. Add regression coverage for the confirmed cases, empty pools, conflicting filters, locked items outside source filters, mode transitions, three-layer formal/cold outfits, and stale debug contexts.

No generator behavior was changed as part of this audit.
