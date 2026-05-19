export default function WardrobeSelectionBar({
  selectedCount,
  bulkStyleTagDraft,
  setBulkStyleTagDraft,
  bulkClimateTagDraft,
  setBulkClimateTagDraft,
  styleTagOptions,
  editableClimateTagOptions,
  onClear,
  onDone,
  onMoveToInterested,
  onMoveToWishlist,
  onMoveToIncoming,
  onMoveToWardrobe,
  onMoveToSelling,
  onMoveToSold,
  onFavorite,
  onUnfavorite,
  onDelete,
  onAddStyle,
  onRemoveStyle,
  onAddClimate,
  onRemoveClimate
}) {
  return (
    <div className="wardrobe-selection-bar" aria-label="Wardrobe selection">
      <div className="wardrobe-selection-summary">
        <strong>{selectedCount} selected</strong>
        <div className="wardrobe-selection-actions">
          <button type="button" className="ghost-button" onClick={onClear} disabled={!selectedCount}>
            Clear
          </button>
          <button type="button" className="ghost-button" onClick={onDone}>
            Done
          </button>
        </div>
      </div>
      <div className="wardrobe-bulk-actions" aria-label="Selected item actions">
        <div className="wardrobe-bulk-group">
          <button type="button" className="ghost-button" onClick={onMoveToInterested} disabled={!selectedCount}>
            To interested
          </button>
          <button type="button" className="ghost-button" onClick={onMoveToWishlist} disabled={!selectedCount}>
            To wishlist
          </button>
          <button type="button" className="ghost-button" onClick={onMoveToIncoming} disabled={!selectedCount}>
            To incoming
          </button>
          <button type="button" className="ghost-button" onClick={onMoveToWardrobe} disabled={!selectedCount}>
            To wardrobe
          </button>
          <button type="button" className="ghost-button" onClick={onMoveToSelling} disabled={!selectedCount}>
            To selling
          </button>
          <button type="button" className="ghost-button" onClick={onMoveToSold} disabled={!selectedCount}>
            To sold
          </button>
          <button type="button" className="ghost-button" onClick={onFavorite} disabled={!selectedCount}>
            Favorite
          </button>
          <button type="button" className="ghost-button" onClick={onUnfavorite} disabled={!selectedCount}>
            Unfavorite
          </button>
          <button type="button" className="ghost-button danger" onClick={onDelete} disabled={!selectedCount}>
            Delete
          </button>
        </div>
        <div className="wardrobe-bulk-group">
          <label className="wardrobe-bulk-tag-control">
            <span>Style</span>
            <select value={bulkStyleTagDraft} onChange={(event) => setBulkStyleTagDraft(event.target.value)}>
              {styleTagOptions.map((tag) => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </label>
          <button type="button" className="ghost-button" onClick={onAddStyle} disabled={!selectedCount || !bulkStyleTagDraft}>
            Add style
          </button>
          <button type="button" className="ghost-button" onClick={onRemoveStyle} disabled={!selectedCount || !bulkStyleTagDraft}>
            Remove style
          </button>
        </div>
        <div className="wardrobe-bulk-group">
          <label className="wardrobe-bulk-tag-control">
            <span>Climate</span>
            <select value={bulkClimateTagDraft} onChange={(event) => setBulkClimateTagDraft(event.target.value)}>
              {editableClimateTagOptions.map((tag) => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </label>
          <button type="button" className="ghost-button" onClick={onAddClimate} disabled={!selectedCount || !bulkClimateTagDraft}>
            Add climate
          </button>
          <button type="button" className="ghost-button" onClick={onRemoveClimate} disabled={!selectedCount || !bulkClimateTagDraft}>
            Remove climate
          </button>
        </div>
      </div>
    </div>
  );
}
