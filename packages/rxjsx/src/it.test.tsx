/** @jsxImportSource ./ */
// @vitest-environment jsdom

import { test, expect } from "vitest"
import { jsx, Fragment } from "./jsx-runtime.tsx"
import { Observable, of, BehaviorSubject } from "rxjs"
import { map, take, toArray, filter } from "rxjs/operators"
import { VNode } from "snabbdom"

// Helper function to extract the structure of a VNode for easier testing
function extractNodeStructure(vnode: VNode): any {
  if (!vnode) return null

  const result: any = {
    sel: vnode.sel,
    data: { ...vnode.data },
  }

  if (vnode.children && Array.isArray(vnode.children)) {
    result.children = vnode.children.map(child => {
      if (typeof child === "string") return child
      return extractNodeStructure(child)
    })
  } else if (vnode.text) {
    result.text = vnode.text
  }

  return result
}

// Test basic static elements
test("JSX renders static elements", async () => {
  const element = <div>Hello World</div>

  const result = await element
    .pipe(take(1), map(extractNodeStructure))
    .toPromise()
  expect(result).toMatchInlineSnapshot(`
    {
      "children": [
        {
          "data": {},
          "sel": undefined,
          "text": "Hello World",
        },
      ],
      "data": {
        "attrs": {
          "data-myKey": undefined,
          "data-parentKey": undefined,
        },
        "data": {
          "className": undefined,
          "key": undefined,
        },
        "key": undefined,
        "on": {},
        "style": undefined,
      },
      "sel": "div",
    }
  `)
})

// Test nested elements
test("JSX renders nested elements", async () => {
  const element = (
    <div debug>
      <h1>Title</h1>
      <p>Paragraph</p>
    </div>
  )

  const result = await element
    .pipe(map(extractNodeStructure))
    .toPromise()

  expect(result).toMatchInlineSnapshot(`
    {
      "children": [
        {
          "children": [
            {
              "data": {},
              "sel": undefined,
              "text": "Title",
            },
          ],
          "data": {
            "attrs": {
              "data-IS_PURE": "1",
              "data-myKey": "undefined/0",
              "data-parentKey": undefined,
            },
            "data": {
              "key": "undefined/0",
            },
            "key": "undefined/0",
            "on": {},
            "props": {
              "className": undefined,
            },
            "style": undefined,
          },
          "sel": "h1",
        },
        {
          "children": [
            {
              "data": {},
              "sel": undefined,
              "text": "Paragraph",
            },
          ],
          "data": {
            "attrs": {
              "data-IS_PURE": "1",
              "data-myKey": "undefined/1",
              "data-parentKey": undefined,
            },
            "data": {
              "key": "undefined/1",
            },
            "key": "undefined/1",
            "on": {},
            "props": {
              "className": undefined,
            },
            "style": undefined,
          },
          "sel": "p",
        },
      ],
      "data": {
        "attrs": {
          "data-myKey": undefined,
          "data-parentKey": undefined,
        },
        "data": {
          "className": undefined,
          "key": undefined,
        },
        "key": undefined,
        "on": {},
        "style": undefined,
      },
      "sel": "div",
    }
  `)
})

// Test attributes
test("JSX renders attributes correctly", async () => {
  const element = (
    <div id="test" className="container">
      Content
    </div>
  )

  const result = await element
    .pipe(take(1), map(extractNodeStructure))
    .toPromise()

  expect(result.sel).toBe("div")
  expect(result.data.attrs.id).toBe("test")
  expect(result.data.class).toBe("container")
  expect(result.children[0].text).toBe("Content")
})

// Test observable children
test("JSX renders observable children", async () => {
  const content$ = of("Dynamic Content")
  const element = <div>{content$}</div>

  const result = await element
    .pipe(take(1), map(extractNodeStructure))
    .toPromise()

  expect(result.sel).toBe("div")
  expect(result.children[0].text).toBe("Dynamic Content")
})

// Test observable attributes
test("JSX renders observable attributes", async () => {
  const className$ = of("dynamic-class")
  const element = <div className={className$}>Content</div>

  const result = await element
    .pipe(take(1), map(extractNodeStructure))
    .toPromise()

  expect(result.sel).toBe("div")
  expect(result.data.class).toBe("dynamic-class")
  expect(result.children[0].text).toBe("Content")
})

// Test fragment
test("JSX renders fragments", async () => {
  const element = (
    <Fragment>
      <div>First</div>
      <div>Second</div>
    </Fragment>
  )

  // combinePartialArray emits incrementally - wait for emission with all children
  const result = await element
    .pipe(
      filter((vnode: VNode) => (vnode.children?.length ?? 0) >= 2),
      take(1),
      map(extractNodeStructure)
    )
    .toPromise()

  // snabbdom fragment returns sel: undefined (it's a virtual container)
  expect(result.sel).toBe(undefined)
  expect(result.children[0].sel).toBe("div")
  expect(result.children[0].children[0].text).toBe("First")
  expect(result.children[1].sel).toBe("div")
  expect(result.children[1].children[0].text).toBe("Second")
})

// Test dynamic list rendering
test("JSX renders lists of items", async () => {
  const items = ["Item 1", "Item 2", "Item 3"]
  const element = (
    <ul>
      {items.map(item => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )

  const result = await element
    .pipe(take(1), map(extractNodeStructure))
    .toPromise()

  expect(result.sel).toBe("ul")
  expect(result.children.length).toBe(3)
  expect(result.children[0].sel).toBe("li")
  expect(result.children[0].children[0].text).toBe("Item 1")
  expect(result.children[1].children[0].text).toBe("Item 2")
  expect(result.children[2].children[0].text).toBe("Item 3")
})

// Test reactive updates
test("JSX handles reactive updates", async () => {
  const counter = new BehaviorSubject(0)
  const element = (
    <div>Count: {counter.pipe(map(String))}</div>
  )

  // Emit updates before collecting (BehaviorSubject replays last value)
  const resultsPromise = element
    .pipe(take(3), map(extractNodeStructure), toArray())
    .toPromise()

  // Schedule emissions after subscription
  setTimeout(() => counter.next(1), 10)
  setTimeout(() => counter.next(2), 20)

  const results = await resultsPromise

  expect(results).toBeDefined()
  expect(results!.length).toBe(3)
  expect(results![0].children[0].text).toBe("Count: ")
  expect(results![0].children[1].text).toBe("0")
  expect(results![1].children[1].text).toBe("1")
  expect(results![2].children[1].text).toBe("2")
})

// Test conditional rendering
test("JSX handles conditional rendering", async () => {
  const showContent = new BehaviorSubject(false)

  const element = (
    <div>
      {showContent.pipe(
        map(show =>
          show ? <span>Visible Content</span> : null,
        ),
      )}
    </div>
  )

  const initialResult = await element
    .pipe(take(1), map(extractNodeStructure))
    .toPromise()

  showContent.next(true)

  const updatedResult = await element
    .pipe(take(1), map(extractNodeStructure))
    .toPromise()

  expect(initialResult.sel).toBe("div")
  expect(initialResult.children.length).toBe(0)

  expect(updatedResult.sel).toBe("div")
  expect(updatedResult.children.length).toBe(1)
  expect(updatedResult.children[0].sel).toBe("span")
  expect(updatedResult.children[0].children[0].text).toBe(
    "Visible Content",
  )
})

// Test nested observables
test("JSX handles nested observables", async () => {
  const innerContent$ = of("Inner Content")
  const outerContent$ = of(<span>{innerContent$}</span>)

  const element = <div>{outerContent$}</div>

  const result = await element
    .pipe(take(1), map(extractNodeStructure))
    .toPromise()

  expect(result.sel).toBe("div")
  expect(result.children[0].sel).toBe("span")
  expect(result.children[0].children[0].text).toBe(
    "Inner Content",
  )
})

// Test style attribute handling
test("JSX handles style attributes", async () => {
  const element = (
    <div style={{ color: "red", fontSize: "16px" }}>
      Styled Text
    </div>
  )

  const result = await element
    .pipe(take(1), map(extractNodeStructure))
    .toPromise()

  expect(result.sel).toBe("div")
  expect(result.data.style.color).toBe("red")
  expect(result.data.style.fontSize).toBe("16px")
  expect(result.children[0].text).toBe("Styled Text")
})

// Test observable style attributes
test("JSX handles observable style attributes", async () => {
  const style$ = of({ color: "blue", fontSize: "20px" })
  const element = <div style={style$}>Styled Text</div>

  const result = await element
    .pipe(take(1), map(extractNodeStructure))
    .toPromise()

  expect(result.sel).toBe("div")
  expect(result.data.style.color).toBe("blue")
  expect(result.data.style.fontSize).toBe("20px")
  expect(result.children[0].text).toBe("Styled Text")
})

// Test component rendering
test("JSX renders components", async () => {
  const SimpleComponent = (props: { title: string }) => {
    return <h1>{props.title}</h1>
  }

  const element = (
    <div>
      <SimpleComponent title="Hello" />
    </div>
  )

  const result = await element
    .pipe(take(1), map(extractNodeStructure))
    .toPromise()

  expect(result.sel).toBe("div")
  expect(result.children[0].sel).toBe("h1")
  expect(result.children[0].children[0].text).toBe("Hello")
})
