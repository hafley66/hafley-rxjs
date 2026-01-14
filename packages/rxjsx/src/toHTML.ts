import { VNode } from "snabbdom"

// List of void elements that don't need closing tags
const VOID_ELEMENTS: Record<string, boolean> = {
  area: true,
  base: true,
  br: true,
  col: true,
  embed: true,
  hr: true,
  img: true,
  input: true,
  link: true,
  meta: true,
  param: true,
  source: true,
  track: true,
  wbr: true,
}

// SVG container elements
const CONTAINER_ELEMENTS: Record<string, boolean> = {
  a: true,
  defs: true,
  g: true,
  marker: true,
  mask: true,
  "missing-glyph": true,
  pattern: true,
  svg: true,
  switch: true,
  symbol: true,
  text: true,
}

// Simple HTML escape function
function escape(str: string) {
  return str
  if (!str) return ""
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

// Simple selector parser (replaces parse-sel)
function parseSelector(sel: string) {
  // We're only handling tag names in this simplified version
  // Original parse-sel would handle classes and IDs in the selector
  return {
    tagName: sel || "div",
    id: "",
    className: "",
  }
}

export function initSnabdomToHtml(modules: any) {
  function parse(vnode: VNode, node: any) {
    const result: any = []
    const attributes = new Map([
      ["id", node.id],
      ["class", node.className],
    ])

    if (modules) {
      modules.forEach(function (fn: any) {
        fn(vnode, attributes)
      })
    }

    attributes.forEach(function (value, key) {
      if (value && value !== "") {
        result.push(key + '="' + escape(value) + '"')
      }
    })

    return result.join(" ")
  }

  return function renderToString(vnode: VNode) {
    if (typeof vnode === "undefined" || vnode === null) {
      return ""
    }

    if (!vnode.sel && typeof vnode.text === "string") {
      return escape(vnode.text)
    }

    vnode.data = vnode.data || {}

    // Support thunks
    if (
      vnode.data.hook &&
      typeof vnode.data.hook.init === "function" &&
      typeof vnode.data.fn === "function"
    ) {
      vnode.data.hook.init(vnode)
    }

    const node = parseSelector(vnode.sel!)
    const tagName = node.tagName
    const attributes = parse(vnode, node)
    const svg =
      vnode.data.ns === "http://www.w3.org/2000/svg"
    const tag = []

    if (tagName === "!") {
      return "<!--" + vnode.text + "-->"
    }

    // Open tag
    tag.push("<" + tagName)

    if (attributes.length) {
      tag.push(" " + attributes)
    }

    if (svg && CONTAINER_ELEMENTS[tagName] !== true) {
      tag.push(" /")
    }

    tag.push(">")

    // Close tag, if needed
    if (
      (VOID_ELEMENTS[tagName as any] !== true && !svg) ||
      (svg && CONTAINER_ELEMENTS[tagName] === true)
    ) {
      if (vnode.data.props?.innerHTML) {
        tag.push(vnode.data.props.innerHTML)
      } else if (vnode.text) {
        tag.push(escape(vnode.text))
      } else if (vnode.children) {
        vnode.children.forEach(function (child) {
          tag.push(renderToString(child))
        })
      }

      tag.push("</" + tagName + ">")
    }

    return tag.join("")
  }
}
