

## Summary
I'll add the ability to edit the order name (product_name) directly in the `OrderHeader` component by clicking on it, providing a quick inline editing experience without needing to open the full product details edit form.

## What I'll Implement

### Quick Inline Name Editing in Order Header
When you click on the order name in the header, it will become an editable input field. You can:
- Click on the order name to start editing
- Press **Enter** or click outside to save
- Press **Escape** to cancel
- See a pencil icon appear on hover to indicate it's editable

This is in addition to the existing edit functionality in the "Product Description" section which allows editing all details.

---

## Technical Details

### File Changes

#### `src/components/orders/OrderHeader.tsx`
- Add state for tracking edit mode (`isEditingName`) and the edited value (`editName`)
- Add a ref for auto-focusing the input when editing begins
- Replace the static `h1` title with a conditional render:
  - When not editing: Show the title with a pencil icon on hover
  - When editing: Show an input field with the current name
- Add handlers for:
  - `handleStartEditing`: Sets edit mode and initializes the input value
  - `handleSaveName`: Saves the new name to the database via Supabase
  - `handleCancelEdit`: Resets to view mode without saving
  - Keyboard handlers for Enter (save) and Escape (cancel)
- Add a new `onNameChange` prop to notify the parent component when the name is updated

#### `src/pages/OrderDetail.tsx`
- Add a new `handleNameChange` function that updates the order name in the database
- Pass this handler to the `OrderHeader` component via the new `onNameChange` prop
- The existing `fetchOrderData` function will refresh the order data after save

### User Experience
- Click on the order name to edit it
- A subtle pencil icon appears on hover to indicate editability
- Input automatically focuses when editing starts
- Save with Enter key or by clicking outside (blur)
- Cancel with Escape key
- Loading state shows while saving
- Toast notification confirms successful update

