// Tiny element builder. Text is always set as text, never as HTML.

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k.includes('-') || k === 'for' || k === 'role' || k === 'list' || k === 'inputmode' || k === 'enterkeyhint' || k === 'autocapitalize') {
        el.setAttribute(k, v === true ? '' : v);
      } else if (k in el) {
        try { el[k] = v; } catch { el.setAttribute(k, v); }
      } else el.setAttribute(k, v === true ? '' : v);
    }
  }
  add(el, children);
  return el;
}

export function add(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false || c === '') continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const frag = (...children) => add(document.createDocumentFragment(), children);
