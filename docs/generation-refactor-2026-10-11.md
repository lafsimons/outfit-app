# Guided generation after simplification

Full generation selects Bottom → Outer → Footwear → Mid → Base → Headwear. Display order is unchanged. Guided uses weighted sampling; Random samples each eligible pool uniformly. Selection remains sequential, without backtracking or whole-outfit optimization.

## Always active

- Source collections, status, favorite filters, and individual exclusions restrict new selections.
- Category and active layer roles must fit. Single-layer Top accepts any Top or Outerwear, regardless of layered roles.
- Active upper garments cannot repeat an item, stack two shirts, or stack the existing exact non-stackable sweatshirt/jacket types.
- Heavy Outerwear cannot combine with shorts or sandals/slides across active slots.
- Eligible pools stay strict. If no eligible candidate exists, the slot stays empty.
- Valid active locks resolve from the complete wardrobe, even outside the selectable source or filters. Invalid category/role locks clear. Conflicting otherwise-valid locks remain visible and are reported in debug.

## Guided preferences

Starting selection weight is 0.8 and the floor is 0.3. Favorites contribute at most 0.3. Stored pair affinity contributes 0.14 per count, capped at 0.35 per relationship; historical item affinity contributes 0.05 per count, capped at 0.2. Combined affinity stays capped at 0.5. Existing recent-item penalties, exact-repeat penalties, and recent-liked pair boosts keep their coefficients and caps. Pair affinity is read from either endpoint, once per relationship. Mid–Outer, Mid–Base, and Mid–Bottom likes accumulate from future likes.

No automatic style target, style streak correction, garment-type baseline bonus, broad weight contrast, lonely extremes, cold tee-under-coat penalty, or mixed-season penalty remains.

## Explicit guidance

Included styles activate the existing selected profile's restrictions and scoring. Contextual comparisons only use selected styles, with Headwear excluded as an influencing garment. Descriptive dominance never changes that profile. Mid receives the existing Base completion values and upper-garment climate suitability values, plus selected-style bonuses. A formal Base or Mid shirt can anchor formal structure; existing anchor and bridge limits remain.

Included climates independently activate climate restrictions, suitability scores, and heat/cold outerwear adjustments. Passive weather remains informational until applied. Style/climate exclusion-only filters reject matching candidates without enabling positive guidance.

## Transitions and replacements

The pure layer transition helper returns assignments and locks together. Collapse considers eligible Outer → Mid → Base candidates, preferring locks and then the outermost unlocked garment; the lock moves with the winner. Other transitions retain valid placements before relocating displaced garments, locked first and then Base → Mid → Outer. Missing upper slots fill under the current mode and strict eligibility. Unplaceable assignments and locks clear.

Layer switches retain a separate in-session history of upper assignments and locks, restoring prior arrangements when layers return. Hidden garments do not participate in the active outfit. Changes to active assignments or locks reset this history, as do generation and loading another outfit. Restored garments are checked for category and role validity.

Rerolls remove the departing slot from context and exclude its previous item. Debug replaces earlier selection details with the latest reroll's results.

## Stored state and diagnostics

Inactive slots do not influence generation, classification, likes, or repetition. Recognized liked/recent keys canonicalize inactive assignments while preserving ordinary legacy key shapes. Like collisions merge without losing likes; recent ordering is preserved. Saved outfits and garment metadata are untouched.

Debug records per-slot selection context, source IDs, wardrobe metadata, filters, locks, preferences, actual history, and expected post-action history. Context changes invalidate historical selection details. Guidance Off, descriptive classifications, selection weights, starting weight, floor adjustments, empty pools, and conflicting locks are labeled separately. Alternatives exclude the selected item.

Image decoding and trace diagnostics are unchanged.

## Limits

Strict filters and sequential decisions can leave slots empty even where a different earlier choice could complete an outfit. Conflicting valid locks require user resolution. Historical Mid pair counts are not invented or backfilled. Random ignores preference weights while retaining eligibility restrictions.
