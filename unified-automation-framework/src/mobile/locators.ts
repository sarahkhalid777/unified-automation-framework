/**
 * Selector builders for Android, in order of preference:
 *  1. accessibility id (content-desc) - stable, and also what screen readers use
 *  2. resource id - stable as long as the developers don't rename views
 *  3. UiAutomator text selectors - for list items found by their visible label
 * XPath is deliberately missing: on Android it is slow and breaks on any layout change.
 */
export type Selector = string & { readonly __selector: unique symbol };

const quote = (text: string) => JSON.stringify(text); // UiSelector takes Java string literals

export const by = {
  accessibilityId: (id: string) => `~${id}` as Selector,
  resourceId: (appPackage: string, id: string) => `id=${appPackage}:id/${id}` as Selector,
  text: (text: string) => `android=new UiSelector().text(${quote(text)})` as Selector,
  textContains: (text: string) => `android=new UiSelector().textContains(${quote(text)})` as Selector,
};

/** Scrolls the first scrollable container until a view with this text is on screen. */
export function scrollIntoViewByText(text: string): Selector {
  return `android=new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().text(${quote(text)}))` as Selector;
}
