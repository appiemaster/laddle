// One modal window at a time, over a dimmed page. Escape, the X and a tap
// outside close it (unless it is `locked`).

import { h } from "./dom.ts";
import { Icons } from "./icons.ts";

let current: { el: HTMLElement; onClose?: () => void } | null = null;

export function isModalOpen(): boolean {
  return current !== null;
}

export function closeModal(): void {
  if (!current) return;
  const { el, onClose } = current;
  current = null;
  el.classList.add("closing");
  setTimeout(() => el.remove(), 160);
  onClose?.();
}

export function openModal(
  title: string,
  body: Node[],
  opts: { onClose?: () => void; className?: string } = {},
): HTMLElement {
  if (current) {
    current.el.remove();
    current = null;
  }
  const panel = h(
    "div",
    { class: `modal ${opts.className ?? ""}`.trim(), role: "dialog", "aria-modal": "true", "aria-label": title },
    h(
      "div",
      { class: "modal-head" },
      h("h2", {}, title),
      h("button", { class: "icon-btn close", "aria-label": "Close", html: Icons.close, onclick: closeModal }),
    ),
    h("div", { class: "modal-body" }, ...body),
  );
  const backdrop = h("div", {
    class: "backdrop",
    onclick: (e: Event) => {
      if (e.target === backdrop) closeModal();
    },
  });
  backdrop.append(panel);
  document.body.append(backdrop);
  current = { el: backdrop, onClose: opts.onClose };
  (panel.querySelector(".modal-body button") as HTMLElement | null)?.focus({ preventScroll: true });
  return panel;
}
