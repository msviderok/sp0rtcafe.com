<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.

<!-- convex-ai-end -->

When reporting information to me, be extremely concise and sacrifice grammar for the sake of concision.

<!-- dnd-kit-start -->

# @dnd-kit

## Docs

- [DragDropManager](https://dndkit.com/concepts/drag-drop-manager.md): Orchestrate drag and drop interactions between elements.
- [Draggable](https://dndkit.com/concepts/draggable.md): Make elements draggable to drop them over droppable targets.
- [Droppable](https://dndkit.com/concepts/droppable.md): Create droppable targets for draggable elements.
- [Sortable](https://dndkit.com/concepts/sortable.md): Reorder elements in a list or across multiple lists.
- [Modifiers](https://dndkit.com/extend/modifiers.md): Transform and constrain drag movement.
- [Plugins](https://dndkit.com/extend/plugins.md): Extend beyond the core functionality with plugins.
- [Accessibility](https://dndkit.com/extend/plugins/accessibility.md): Manages ARIA attributes and screen reader announcements for drag and drop operations.
- [AutoScroller](https://dndkit.com/extend/plugins/auto-scroller.md): Automatically scrolls containers when dragging near edges.
- [Cursor](https://dndkit.com/extend/plugins/cursor.md): Updates cursor styles during drag operations.
- [Debug](https://dndkit.com/extend/plugins/debug.md): Visualize drag and drop operations for debugging.
- [Feedback](https://dndkit.com/extend/plugins/feedback.md): Manages visual feedback during drag operations, including top layer promotion and drop animations.
- [StyleInjector](https://dndkit.com/extend/plugins/style-injector.md): Centralized style injection for drag and drop operations.
- [Sensors](https://dndkit.com/extend/sensors.md): Detect user input and translate it into drag and drop operations.
- [Keyboard Sensor](https://dndkit.com/extend/sensors/keyboard-sensor.md): Detect keyboard input to initiate drag and drop operations.
- [Pointer Sensor](https://dndkit.com/extend/sensors/pointer-sensor.md): Detect pointer events to initiate drag and drop operations.
- [Overview](https://dndkit.com/overview.md): Learn how to build drag and drop interfaces with <span class="inline-logo">**dnd kit**</span>
- [Quickstart](https://dndkit.com/quickstart.md): Start building drag and drop interfaces with plain JavaScript in minutes.
- [DragDropProvider](https://dndkit.com/react/components/drag-drop-provider.md): Enable drag and drop interactions in your React application.
- [DragOverlay](https://dndkit.com/react/components/drag-overlay.md): Render a custom element as visual feedback during drag operations.
- [Migration guide](https://dndkit.com/react/guides/migration.md): A comprehensive guide to migrate from `@dnd-kit/core` to `@dnd-kit/react`
- [Multiple sortable lists](https://dndkit.com/react/guides/multiple-sortable-lists.md): Learn how to reorder sortable elements across multiple lists.
- [Managing sortable state](https://dndkit.com/react/guides/sortable-state-management.md): Learn how to manage sortable state with and without the move helper.
- [useDragDropMonitor](https://dndkit.com/react/hooks/use-drag-drop-monitor.md): Monitor drag and drop events in your React components.
- [useDraggable](https://dndkit.com/react/hooks/use-draggable.md): Use the `useDraggable` hook to make draggable elements that can dropped over droppable targets.
- [useDroppable](https://dndkit.com/react/hooks/use-droppable.md): Use the `useDroppable` hook to create droppable targets for draggable elements.
- [useSortable](https://dndkit.com/react/hooks/use-sortable.md): Use the `useSortable` hook to reorder elements in a list or across multiple lists.
- [Quickstart](https://dndkit.com/react/quickstart.md): Start building drag and drop interfaces with React in minutes.
- [DragDropProvider](https://dndkit.com/solid/components/drag-drop-provider.md): The DragDropProvider component creates and manages a DragDropManager instance for your SolidJS application.
- [DragOverlay](https://dndkit.com/solid/components/drag-overlay.md): Render a custom element as visual feedback during drag operations.
- [useDraggable](https://dndkit.com/solid/hooks/use-draggable.md): Make elements draggable with the useDraggable hook.
- [useDroppable](https://dndkit.com/solid/hooks/use-droppable.md): Create droppable targets with the useDroppable hook.
- [useSortable](https://dndkit.com/solid/hooks/use-sortable.md): Create sortable elements with the useSortable hook.
- [Quickstart](https://dndkit.com/solid/quickstart.md): Start building drag and drop interfaces with SolidJS in minutes.
- [DragDropProvider](https://dndkit.com/svelte/components/drag-drop-provider.md): The DragDropProvider component creates and manages a DragDropManager instance for your Svelte application.
- [DragOverlay](https://dndkit.com/svelte/components/drag-overlay.md): Render a custom element as visual feedback during drag operations.
- [createDraggable](https://dndkit.com/svelte/primitives/create-draggable.md): Make elements draggable with the createDraggable primitive.
- [createDroppable](https://dndkit.com/svelte/primitives/create-droppable.md): Create droppable targets with the createDroppable primitive.
- [createSortable](https://dndkit.com/svelte/primitives/create-sortable.md): Create sortable elements with the createSortable primitive.
- [Quickstart](https://dndkit.com/svelte/quickstart.md): Start building drag and drop interfaces with Svelte in minutes.
- [DragDropProvider](https://dndkit.com/vue/components/drag-drop-provider.md): The DragDropProvider component creates and manages a DragDropManager instance for your Vue application.
- [DragOverlay](https://dndkit.com/vue/components/drag-overlay.md): Render a custom element as visual feedback during drag operations.
- [useDraggable](https://dndkit.com/vue/composables/use-draggable.md): Make elements draggable with the useDraggable composable.
- [useDroppable](https://dndkit.com/vue/composables/use-droppable.md): Create droppable targets with the useDroppable composable.
- [useSortable](https://dndkit.com/vue/composables/use-sortable.md): Create sortable elements with the useSortable composable.
- [Quickstart](https://dndkit.com/vue/quickstart.md): Start building drag and drop interfaces with Vue in minutes.

Built with [Mintlify](https://mintlify.com).

<!-- dnd-kit-end -->

All UI components from src/components/ui must be wrapped in `clientOnly`.
