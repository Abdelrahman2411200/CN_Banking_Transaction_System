export type ScreenTheme = "light" | "dark";
export type ScreenFamily = "authentication" | "accounts";

export interface ScreenReference {
  folder: string;
  codePath: string;
  screenshotPath: string;
  theme: ScreenTheme;
  screenFamily: ScreenFamily;
  patternsUsed: string[];
}

const root = "stitch_remix_of_cn_banking_react_portal/stitch_remix_of_cn_banking_react_portal";

export const canonicalScreenReferences: ScreenReference[] = [
  {
    folder: "authentication",
    codePath: `${root}/authentication/code.html`,
    screenshotPath: `${root}/authentication/screen.png`,
    theme: "light",
    screenFamily: "authentication",
    patternsUsed: ["brand lockup", "form controls", "warning banner", "primary action"]
  },
  {
    folder: "authentication_dark",
    codePath: `${root}/authentication_dark/code.html`,
    screenshotPath: `${root}/authentication_dark/screen.png`,
    theme: "dark",
    screenFamily: "authentication",
    patternsUsed: ["dark theme", "form controls", "semantic alerts", "primary action"]
  },
  {
    folder: "account_management_1",
    codePath: `${root}/account_management_1/code.html`,
    screenshotPath: `${root}/account_management_1/screen.png`,
    theme: "light",
    screenFamily: "accounts",
    patternsUsed: ["Banking Ops shell", "account form", "metric cards", "action buttons"]
  },
  {
    folder: "account_management_dark",
    codePath: `${root}/account_management_dark/code.html`,
    screenshotPath: `${root}/account_management_dark/screen.png`,
    theme: "dark",
    screenFamily: "accounts",
    patternsUsed: ["dark Banking Ops shell", "account form", "status chips", "action buttons"]
  }
];
