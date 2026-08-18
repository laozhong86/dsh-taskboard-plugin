/** First-level product page: not a session view. */

export const PRODUCT_STAGE_EVENT = "dsh-product-stage";
const STAGE_ID = "taskboard";

export function claimProductStage(id: string): void {
  window.dispatchEvent(new CustomEvent(PRODUCT_STAGE_EVENT, { detail: { id } }));
}

export function createTaskboardStore() {
  let open = false;
  const listeners = new Set<() => void>();

  function emit() {
    for (const listener of listeners) listener();
  }

  window.addEventListener(PRODUCT_STAGE_EVENT, (event) => {
    const id = event instanceof CustomEvent ? (event.detail as { id?: string } | undefined)?.id : undefined;
    if (id !== STAGE_ID && open) {
      open = false;
      emit();
    }
  });

  return {
    getSnapshot: () => open,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set(next: boolean) {
      if (open === next) return;
      open = next;
      if (open) claimProductStage(STAGE_ID);
      emit();
    },
    toggle() {
      this.set(!open);
    },
  };
}

function sizableBox(node: Element | null): { top: number; left: number; width: number; height: number } | null {
  if (!node || typeof (node as HTMLElement).getBoundingClientRect !== "function") return null;
  const rect = (node as HTMLElement).getBoundingClientRect();
  if (rect.width >= 8 && rect.height >= 8) {
    return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
  }
  return null;
}

/** Cover the whole conversation column, including header and composer. */
export function readConversationBox() {
  let node: Element | null = document.querySelector('[data-slot="conversation"]');
  while (node) {
    const box = sizableBox(node);
    if (box) return box;
    node = node.parentElement;
  }
  const preferred = sizableBox(document.querySelector("[data-conversation-scroll]"));
  if (preferred) return preferred;
  const left = 56;
  return { top: 0, left, width: Math.max(8, window.innerWidth - left), height: Math.max(8, window.innerHeight) };
}
