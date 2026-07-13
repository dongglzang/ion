export interface NodePosition {
  id: string;
  x: number;
  y: number;
  size: number;
  opacity: number;
  isDragging: boolean;
  rotation?: number;
}

type Listener = () => void;
type PendingDeleteListener = (id: string) => void;
type DragStateListener = (id: string | null) => void;
type DeleteModeListener = (id: string | null) => void;
type HoverListener = (id: string | null) => void;

interface PositionStoreAPI {
  // === non-notifying per-frame source of truth ===
  // rAF가 set, FeedPhysics가 drag read-back 시 get. 절대 React 안 깨움.
  setPosition: (id: string, pos: NodePosition) => void;
  getPosition: (id: string) => NodePosition | undefined;
  getAllPositions: () => NodePosition[];
  removePosition: (id: string) => void;

  // === card ref registry (rAF가 DOM transform 직접 set용) ===
  registerCard: (id: string, el: HTMLDivElement) => void;
  unregisterCard: (id: string) => void;
  getCard: (id: string) => HTMLDivElement | undefined;

  // === drag read-back (non-notifying, called by FeedPhysics per frame) ===
  setDragPos: (id: string, x: number, y: number) => void;

  // === discrete state (notify on change) ===
  setDragging: (id: string | null) => void;
  getDraggingId: () => string | null;
  subscribeDragging: (cb: DragStateListener) => () => void;

  setDeleteMode: (id: string | null) => void;
  getDeleteModeId: () => string | null;
  subscribeDeleteMode: (cb: DeleteModeListener) => () => void;

  setHovered: (id: string | null) => void;
  getHoveredId: () => string | null;
  subscribeHovered: (cb: HoverListener) => () => void;

  // === velocity (drag-release) ===
  setDragVelocity: (id: string, vx: number, vy: number) => void;
  getDragVelocity: (id: string) => { vx: number; vy: number } | undefined;
  consumeDragVelocity: (id: string) => { vx: number; vy: number } | undefined;

  // === dismiss pipeline (event-based, no polling) ===
  markForDismissal: (id: string, vx: number, vy: number) => void;
  getDismissedId: () => string | null;
  getDismissDirection: () => { vx: number; vy: number } | null;
  consumeDismissedAndNotify: (id: string) => void;
  subscribePendingDelete: (cb: PendingDeleteListener) => () => void;
  consumePendingDataDelete: () => string | null;

  // === generic subscribe (rarely needed; subscribeDragging/DeleteMode/Hovered prefer) ===
  subscribe: (listener: Listener) => () => void;
}

// === state ===
const positions = new Map<string, NodePosition>(); // non-notifying, rAF source of truth
const cardRefs = new Map<string, HTMLDivElement>(); // rAF → DOM
const dragVelocities = new Map<string, { vx: number; vy: number }>();

// discrete state (notify on change)
let draggingId: string | null = null;
let deleteModeId: string | null = null;
let hoveredId: string | null = null;
let dismissedId: string | null = null;
let dismissDirection: { vx: number; vy: number } | null = null;
let pendingDataDeleteId: string | null = null;

// listener sets
const listeners = new Set<Listener>();
const pendingDeleteListeners = new Set<PendingDeleteListener>();
const draggingListeners = new Set<DragStateListener>();
const deleteModeListeners = new Set<DeleteModeListener>();
const hoverListeners = new Set<HoverListener>();

const notify = (set: Set<Listener>) => set.forEach((cb) => {
  try { (cb as (...a: unknown[]) => void)(); }
  catch (err) { console.error('[positionStore] listener threw', err); }
});
const notifyPendingDelete = (id: string) => pendingDeleteListeners.forEach((cb) => {
  try { cb(id); } catch (err) { console.error('[positionStore] pendingDelete listener threw', err); }
});
const notifyDragging = (id: string | null) => draggingListeners.forEach((cb) => {
  try { cb(id); } catch (err) { console.error('[positionStore] dragging listener threw', err); }
});
const notifyDeleteMode = (id: string | null) => deleteModeListeners.forEach((cb) => {
  try { cb(id); } catch (err) { console.error('[positionStore] deleteMode listener threw', err); }
});
const notifyHovered = (id: string | null) => hoverListeners.forEach((cb) => {
  try { cb(id); } catch (err) { console.error('[positionStore] hover listener threw', err); }
});

const positionStore: PositionStoreAPI = {
  // === non-notifying positions ===
  setPosition(id, pos) {
    positions.set(id, pos);
  },
  getPosition(id) {
    return positions.get(id);
  },
  getAllPositions() {
    return Array.from(positions.values());
  },
  removePosition(id) {
    positions.delete(id);
  },

  // === card refs ===
  registerCard(id, el) {
    cardRefs.set(id, el);
  },
  unregisterCard(id) {
    cardRefs.delete(id);
  },
  getCard(id) {
    return cardRefs.get(id);
  },

  // === drag read-back (non-notifying) ===
  setDragPos(id, x, y) {
    const p = positions.get(id);
    if (p) {
      p.x = x;
      p.y = y;
    } else {
      positions.set(id, { id, x, y, size: 0, opacity: 1, isDragging: true });
    }
  },

  // === dragging (notify) ===
  setDragging(id) {
    if (draggingId === id) return;
    draggingId = id;
    notify(listeners);
    notifyDragging(id);
  },
  getDraggingId() { return draggingId; },
  subscribeDragging(cb) {
    draggingListeners.add(cb);
    return () => { draggingListeners.delete(cb); };
  },

  // === delete mode (notify) ===
  setDeleteMode(id) {
    if (deleteModeId === id) return;
    deleteModeId = id;
    notify(listeners);
    notifyDeleteMode(id);
  },
  getDeleteModeId() { return deleteModeId; },
  subscribeDeleteMode(cb) {
    deleteModeListeners.add(cb);
    return () => { deleteModeListeners.delete(cb); };
  },

  // === hover (notify) ===
  setHovered(id) {
    if (hoveredId === id) return;
    hoveredId = id;
    notify(listeners);
    notifyHovered(id);
  },
  getHoveredId() { return hoveredId; },
  subscribeHovered(cb) {
    hoverListeners.add(cb);
    return () => { hoverListeners.delete(cb); };
  },

  // === velocity ===
  setDragVelocity(id, vx, vy) {
    dragVelocities.set(id, { vx, vy });
  },
  getDragVelocity(id) {
    return dragVelocities.get(id);
  },
  consumeDragVelocity(id) {
    const v = dragVelocities.get(id);
    dragVelocities.delete(id);
    return v;
  },

  // === dismiss ===
  markForDismissal(id, vx, vy) {
    dismissedId = id;
    dismissDirection = { vx, vy };
  },
  getDismissedId() { return dismissedId; },
  getDismissDirection() { return dismissDirection; },
  consumeDismissedAndNotify(id) {
    dismissedId = null;
    dismissDirection = null;
    pendingDataDeleteId = id;
    notify(listeners);
    notifyPendingDelete(id);
  },
  consumePendingDataDelete() {
    const id = pendingDataDeleteId;
    pendingDataDeleteId = null;
    return id;
  },
  subscribePendingDelete(cb) {
    pendingDeleteListeners.add(cb);
    return () => { pendingDeleteListeners.delete(cb); };
  },

  // === generic ===
  subscribe(listener) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};

export { positionStore };
