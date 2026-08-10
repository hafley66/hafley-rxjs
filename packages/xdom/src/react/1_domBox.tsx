import {
  createElement,
  type CSSProperties,
  type ElementType,
  type ReactElement,
  type ReactNode,
} from "react"
import {
  Dom as DomCore,
  type DomTemplate,
  type Params,
  type Values,
} from "../1_domTemplate.js"

export type BoxProps<Path extends string> = Values<Path> & {
  children?: ReactNode
  as?: ElementType
  className?: string
  style?: CSSProperties
}

export type DomTemplateR<Path extends string> = DomTemplate<Path> & {
  // Turnkey container: a display:contents element stamped with data-route +
  // inherited params, so delegated routing resolves without hand-built HTML.
  Box: (props: BoxProps<Path>) => ReactElement
}

export function Dom<const Path extends string>(template: Path): DomTemplateR<Path> {
  const dom = DomCore(template)
  const Box = ({ children, as = "div", className, style, ...values }: BoxProps<Path>) =>
    createElement(
      as,
      {
        className,
        ...dom.boxAttrs(values as unknown as Values<Path>),
        style: { display: "contents", ...style },
      },
      children,
    )
  return { ...dom, Box }
}
