import { Observable } from "rxjs";
import type { HighlightedCode, Token } from "codehike/code";
import type { CodeHighlighterPlugin } from "streamdown";

type HighlightResult = NonNullable<ReturnType<CodeHighlighterPlugin["highlight"]>>;

const WHITESPACE = /(\s+)/;

/** Streamdown's shiki lines -> Code Hike's flat token list; whitespace stays bare so tokens match by word. */
export function toHighlightedCode(result: HighlightResult, code: string, lang: string, dark: boolean): HighlightedCode {
  const tokens: (Token | string)[] = [];
  result.tokens.forEach((line, index) => {
    if (index > 0) tokens.push("\n");
    for (const token of line) {
      const color = (dark ? token.htmlStyle?.["--shiki-dark"] : undefined) ?? token.color;
      for (const part of token.content.split(WHITESPACE)) {
        if (part === "") continue;
        tokens.push(WHITESPACE.test(part) ? part : color ? [part, color] : [part]);
      }
    }
  });
  return { value: code, code, annotations: [], tokens, lang, meta: "", themeName: dark ? "dark" : "light", style: {} };
}

function plain(code: string): HighlightResult {
  return { tokens: code.split("\n").map((content) => [{ content }]) };
}

/** Cold. One highlight through the md highlight slot; unsupported or absent means uncoloured tokens. */
export function highlight$(highlighter: CodeHighlighterPlugin | undefined, code: string, lang: string, dark: boolean): Observable<HighlightedCode> {
  return new Observable<HighlightedCode>((subscriber) => {
    const answer = (result: HighlightResult) => {
      subscriber.next(toHighlightedCode(result, code, lang, dark));
      subscriber.complete();
    };
    if (!highlighter || !lang || !highlighter.supportsLanguage(lang)) return answer(plain(code));
    const sync = highlighter.highlight({ code, language: lang, themes: highlighter.getThemes() }, answer);
    if (sync) answer(sync);
  });
}
