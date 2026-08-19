export function getIframeInjectScript(): string {
  return `
(function(){
  let selectedEl = null;
  let dragSrcEl = null;

  function send(msg) {
    parent.postMessage(msg, "*");
  }

  function getPath(el) {
    if (!el || el === document.body || el === document.documentElement) return [];
    const parent = el.parentElement;
    if (!parent) return [];
    const idx = Array.from(parent.children).indexOf(el);
    return [...getPath(parent), idx];
  }

  function selectElement(el) {
    if (!el || el === document.body || el === document.documentElement) return;
    if (selectedEl) selectedEl.classList.remove("__lp_selected");
    selectedEl = el;
    el.classList.add("__lp_selected");
    const cs = getComputedStyle(el);
    send({
      type: "element:select",
      path: getPath(el),
      tag: el.tagName.toLowerCase(),
      text: el.textContent?.trim().slice(0, 200) || "",
      styles: {
        color: cs.color,
        backgroundColor: cs.backgroundColor === "rgba(0, 0, 0, 0)" ? "" : cs.backgroundColor,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        fontFamily: cs.fontFamily.split(",")[0]?.trim().replace(/['"]/g, "") || "",
        textAlign: cs.textAlign,
        lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing,
        padding: cs.padding,
        margin: cs.margin,
        borderRadius: cs.borderRadius,
        border: cs.borderStyle === "none" ? "" : cs.border,
        backgroundImage: cs.backgroundImage === "none" ? "" : cs.backgroundImage,
        gap: cs.gap,
      },
      inlineStyles: el.getAttribute("style") || "",
      classes: el.className || "",
    });
  }

  function findElByPath(path) {
    let el = document.body;
    for (const idx of path) {
      if (!el || !el.children[idx]) return null;
      el = el.children[idx];
    }
    return el;
  }

  document.addEventListener("click", function(e) {
    e.preventDefault();
    e.stopPropagation();
    selectElement(e.target);
  }, true);

  document.addEventListener("dblclick", function(e) {
    e.preventDefault();
    e.stopPropagation();
    const el = e.target;
    if (!el || el === document.body) return;
    el.contentEditable = "true";
    el.focus();
    el.classList.add("__lp_editing");

    function finish() {
      el.contentEditable = "false";
      el.classList.remove("__lp_editing");
      el.removeEventListener("blur", finish);
      el.removeEventListener("keydown", onKey);
      send({ type: "element:text-update", path: getPath(el), text: el.innerHTML });
    }
    function onKey(ev) {
      if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); finish(); }
      if (ev.key === "Escape") { el.revertContent?.(); finish(); }
    }
    el.revertContent = el.innerHTML;
    el.addEventListener("blur", finish);
    el.addEventListener("keydown", onKey);
  }, true);

  document.addEventListener("dragstart", function(e) {
    const handle = e.target.closest(".__lp_drag_handle");
    if (!handle) return;
    dragSrcEl = handle.closest("[data-lp-editable]");
    if (!dragSrcEl) dragSrcEl = handle.parentElement;
    if (!dragSrcEl) return;
    e.dataTransfer.effectAllowed = "move";
    dragSrcEl.classList.add("__lp_dragging");
    send({ type: "element:drag-start", path: getPath(dragSrcEl) });
  }, true);

  document.addEventListener("dragover", function(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const target = e.target.closest("[data-lp-editable]") || e.target.parentElement;
    if (target && target !== dragSrcEl) {
      document.querySelectorAll(".__lp_drag_over_top,.__lp_drag_over_bottom").forEach(el => {
        el.classList.remove("__lp_drag_over_top","__lp_drag_over_bottom");
      });
      const rect = target.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (e.clientY < mid) target.classList.add("__lp_drag_over_top");
      else target.classList.add("__lp_drag_over_bottom");
    }
  }, true);

  document.addEventListener("dragend", function() {
    if (dragSrcEl) dragSrcEl.classList.remove("__lp_dragging");
    document.querySelectorAll(".__lp_drag_over_top,.__lp_drag_over_bottom").forEach(el => {
      el.classList.remove("__lp_drag_over_top","__lp_drag_over_bottom");
    });
    dragSrcEl = null;
  }, true);

  document.addEventListener("drop", function(e) {
    e.preventDefault();
    document.querySelectorAll(".__lp_drag_over_top,.__lp_drag_over_bottom").forEach(el => {
      el.classList.remove("__lp_drag_over_top",".__lp_drag_over_bottom");
    });
    if (!dragSrcEl) return;
    const target = e.target.closest("[data-lp-editable]") || e.target.parentElement;
    if (!target || target === dragSrcEl) return;
    const srcPath = getPath(dragSrcEl);
    const tgtPath = getPath(target);
    const rect = target.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    const position = e.clientY < mid ? "before" : "after";
    send({ type: "element:reorder", srcPath, tgtPath, position });
    dragSrcEl = null;
  }, true);

  window.addEventListener("message", function(e) {
    const msg = e.data;
    if (!msg || !msg.type) return;

    if (msg.type === "canvas:set-html") {
      document.open();
      document.write(msg.html);
      document.close();
      injectStyles(document);
      makeEditable(document);
      selectedEl = null;
    }

    if (msg.type === "canvas:set-editable") {
      makeEditable(document);
    }

    if (msg.type === "canvas:deselect") {
      if (selectedEl) {
        selectedEl.classList.remove("__lp_selected");
        selectedEl = null;
      }
    }

    if (msg.type === "canvas:update-html") {
      const tmp = document.createElement("div");
      tmp.innerHTML = msg.html;
      document.body.innerHTML = tmp.innerHTML || document.body.innerHTML;
      injectStyles(document);
      makeEditable(document);
      selectedEl = null;
    }
  });

  function makeEditable(doc) {
    const els = doc.querySelectorAll("section, div, header, footer, main, article, nav, aside, h1, h2, h3, h4, h5, h6, p, a, span, button, li, td, th, strong, em, img");
    els.forEach(el => {
      if (el.getAttribute("draggable") === "true") return;
      if (el.classList.contains("__lp_drag_handle")) return;
      el.setAttribute("draggable", "true");
      el.setAttribute("data-lp-editable", "true");
    });
  }

  function injectStyles(doc) {
    const existingStyle = doc.querySelector("style[data-lp-editor]");
    if (existingStyle) existingStyle.remove();
    const style = doc.createElement("style");
    style.setAttribute("data-lp-editor", "true");
    style.textContent = \`
      [data-lp-editable] { cursor: pointer; transition: outline 0.15s, box-shadow 0.15s; outline: 2px solid transparent; outline-offset: 2px; }
      [data-lp-editable]:hover { outline: 2px dashed rgba(99,102,241,0.4); }
      .__lp_selected { outline: 2px solid #6366f1 !important; outline-offset: 2px; box-shadow: 0 0 0 4px rgba(99,102,241,0.15); }
      .__lp_editing { outline: 2px solid #22c55e !important; outline-offset: 2px; cursor: text !important; box-shadow: 0 0 0 4px rgba(34,197,94,0.15); }
      .__lp_dragging { opacity: 0.4; }
      .__lp_drag_over_top { border-top: 3px solid #6366f1 !important; }
      .__lp_drag_over_bottom { border-bottom: 3px solid #6366f1 !important; }
    \`;
    doc.head.appendChild(style);
  }
})();`;
}
