import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import {
  chromium,
  type Browser,
  type Locator,
  type Page,
} from '@playwright/test';
import { externalWriting } from '../data/external-writing';
import { heroParagraphs, profile } from '../data/profile';

const root = process.cwd();
const port = 3011;
let baseUrl = `http://localhost:${port}`;
const existingBaseUrl = process.env.VISUAL_BASE_URL ?? 'http://localhost:3002';
const screenshotDir = path.join(root, 'test-results', 'visual');
const expectedHeroParagraphs = heroParagraphs.map((paragraph) =>
  paragraph
    .map((segment) => segment.text)
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
);

function colorBrightness(color: string) {
  const rgbMatch = color.match(/rgba?\((\d+), (\d+), (\d+)/);

  if (rgbMatch) {
    return (
      Number.parseInt(rgbMatch[1], 10) +
      Number.parseInt(rgbMatch[2], 10) +
      Number.parseInt(rgbMatch[3], 10)
    );
  }

  const labMatch = color.match(/lab\((-?\d+(?:\.\d+)?)/);

  if (labMatch) {
    return Number.parseFloat(labMatch[1]) * 7.65;
  }

  assert.fail(`expected an rgb or lab color, received: ${color}`);
}

async function isServerReady(url: string) {
  try {
    const response = await fetch(url);

    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(url: string) {
  const deadline = Date.now() + 45_000;

  while (Date.now() < deadline) {
    if (await isServerReady(url)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function screenshot(page: Page, name: string) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.join(screenshotDir, `${name}.png`),
    fullPage: true,
  });
}

async function cssColor(page: Page, value: string) {
  return page.evaluate((cssValue) => {
    const probe = document.createElement('span');

    probe.style.color = cssValue;
    document.body.append(probe);

    const color = getComputedStyle(probe).color;

    probe.remove();

    return color;
  }, value);
}

async function readRailRowColors({
  row,
  dotTestId = 'rail-dot',
  connectorTestId = 'rail-connector',
}: {
  row: Locator;
  dotTestId?: string;
  connectorTestId?: string;
}) {
  return row.evaluate(
    (element, testIds) => {
      const dot = element.querySelector<HTMLElement>(
        `[data-testid="${testIds.dotTestId}"]`
      );
      const connector = element.querySelector<HTMLElement>(
        `[data-testid="${testIds.connectorTestId}"]`
      );
      const dotStyle = dot ? getComputedStyle(dot) : null;
      const connectorStyle = connector ? getComputedStyle(connector) : null;

      // Org marks are inline SVGs colored through `color`; plain dots through
      // `background-color`. Report whichever the row uses as its accent.
      const dotIsMark = dot?.hasAttribute('data-rail-marker') ?? false;

      return {
        dotIsMark,
        dotAccentColor:
          (dotIsMark ? dotStyle?.color : dotStyle?.backgroundColor) ?? '',
        dotBackgroundColor: dotStyle?.backgroundColor ?? '',
        dotBorderColor: dotStyle?.borderTopColor ?? '',
        connectorBackgroundColor: connectorStyle?.backgroundColor ?? '',
        connectorColor: connectorStyle?.color ?? '',
        connectorBackgroundImage: connectorStyle?.backgroundImage ?? '',
      };
    },
    { dotTestId, connectorTestId }
  );
}

async function assertNeutralRailRowHoverAccent({
  page,
  row,
  hoverSource,
  accent,
  label,
  dotTestId = 'rail-dot',
  connectorTestId = 'rail-connector',
}: {
  page: Page;
  row: Locator;
  hoverSource: Locator;
  accent: 'r' | 'o' | 'y' | 'b';
  label: string;
  dotTestId?: string;
  connectorTestId?: string;
}) {
  const accentColor = await cssColor(page, `var(--roy-${accent})`);
  const before = await readRailRowColors({ row, dotTestId, connectorTestId });

  assert.notEqual(
    before.dotAccentColor,
    accentColor,
    `${label} should start neutral before hover`
  );

  const rowBox = await row.boundingBox();

  assert.ok(rowBox, `${label} should have a layout box`);

  await page.mouse.move(
    rowBox.x + rowBox.width - 2,
    rowBox.y + rowBox.height / 2
  );

  const rowHover = await readRailRowColors({
    row,
    dotTestId,
    connectorTestId,
  });

  assert.equal(
    rowHover.dotAccentColor,
    before.dotAccentColor,
    `${label} dot should not change when hovering non-link row space`
  );
  assert.equal(
    rowHover.connectorBackgroundColor,
    before.connectorBackgroundColor,
    `${label} connector background should not change on row hover`
  );
  assert.equal(
    rowHover.connectorColor,
    before.connectorColor,
    `${label} connector color should not change on row hover`
  );

  await hoverSource.hover();

  const linkHover = await readRailRowColors({
    row,
    dotTestId,
    connectorTestId,
  });

  assert.equal(
    linkHover.dotAccentColor,
    accentColor,
    `${label} dot should color only when the title link is hovered`
  );
  if (before.dotIsMark) {
    assert.equal(
      linkHover.dotBackgroundColor,
      before.dotBackgroundColor,
      `${label} dot background should not paint behind an org mark on hover`
    );
  }
  assert.equal(
    linkHover.connectorBackgroundColor,
    before.connectorBackgroundColor,
    `${label} connector background should stay unchanged on link hover`
  );
  assert.equal(
    linkHover.connectorColor,
    before.connectorColor,
    `${label} connector color should stay unchanged on link hover`
  );
  assert.equal(
    linkHover.connectorBackgroundImage,
    before.connectorBackgroundImage,
    `${label} connector pattern should stay unchanged on link hover`
  );

  await page.mouse.move(0, 0);
}

async function assertRailRowKeepsMarkerOnHover({
  page,
  row,
  hoverSource,
  label,
}: {
  page: Page;
  row: Locator;
  hoverSource: Locator;
  label: string;
}) {
  const before = await readRailRowColors({ row });

  await hoverSource.hover();

  const after = await readRailRowColors({ row });

  assert.equal(
    after.dotBackgroundColor,
    before.dotBackgroundColor,
    `${label} dot background should stay fixed on hover`
  );
  assert.equal(
    after.dotBorderColor,
    before.dotBorderColor,
    `${label} dot border should stay fixed on hover`
  );
  assert.equal(
    after.connectorBackgroundColor,
    before.connectorBackgroundColor,
    `${label} connector background should stay fixed on hover`
  );
  assert.equal(
    after.connectorColor,
    before.connectorColor,
    `${label} connector color should stay fixed on hover`
  );

  await page.mouse.move(0, 0);
}

async function assertThemeBootstrapBeforeHeader() {
  const html = await fetch(baseUrl).then((response) => response.text());
  const scriptIndex = html.indexOf('window.localStorage.getItem');
  const headerIndex = html.indexOf('data-testid="site-header"');

  assert.ok(scriptIndex >= 0, 'theme bootstrap script should render');
  assert.ok(headerIndex >= 0, 'site header should render');
  assert.ok(
    scriptIndex < headerIndex,
    'theme bootstrap should run before visible header markup'
  );
}

async function assertRoybBandPlacement(page: Page) {
  const placement = await page.evaluate(() => {
    const sitePage = document.querySelector<HTMLElement>(
      '[data-testid="site-page"]'
    );
    const header = document.querySelector('[data-testid="site-header"]');
    const wordmark = document.querySelector('[data-testid="wordmark"]');
    const wrap = document.querySelector('[data-testid="royb-band-wrap"]');
    const band = document.querySelector('[data-testid="royb-band"]');
    const headerStyle = header ? getComputedStyle(header) : null;
    const sitePageStyle = sitePage ? getComputedStyle(sitePage) : null;
    const bandStyle = band ? getComputedStyle(band) : null;
    const nextContent = document.querySelector(
      'main > section header span, [data-testid="blog-article-title"]'
    );
    const pageRect = sitePage?.getBoundingClientRect();

    return {
      headerBottom: header?.getBoundingClientRect().bottom ?? 0,
      headerBorderBottomWidth: Number.parseFloat(
        headerStyle?.borderBottomWidth ?? '0'
      ),
      wordmarkBottom: wordmark?.getBoundingClientRect().bottom ?? 0,
      wrapTop: wrap?.getBoundingClientRect().top ?? 0,
      bandTop: band?.getBoundingClientRect().top ?? 0,
      bandBottom: band?.getBoundingClientRect().bottom ?? 0,
      bandLeft: band?.getBoundingClientRect().left ?? 0,
      bandRight: band?.getBoundingClientRect().right ?? 0,
      bandHeight: band?.getBoundingClientRect().height ?? 0,
      bandBorderWidths: [
        bandStyle?.borderTopWidth,
        bandStyle?.borderRightWidth,
        bandStyle?.borderBottomWidth,
        bandStyle?.borderLeftWidth,
      ].map((width) => Number.parseFloat(width ?? '0')),
      pageInnerLeft:
        (pageRect?.left ?? 0) +
        Number.parseFloat(sitePageStyle?.borderLeftWidth ?? '0'),
      pageInnerRight:
        (pageRect?.right ?? 0) -
        Number.parseFloat(sitePageStyle?.borderRightWidth ?? '0'),
      nextContentTop: nextContent?.getBoundingClientRect().top ?? 0,
    };
  });

  const topGap = placement.bandTop - placement.wordmarkBottom;
  const bottomGap = placement.nextContentTop - placement.bandBottom;

  assert.equal(placement.bandHeight, 9, 'ROYB bar should be 9px tall');
  assert.equal(
    placement.headerBorderBottomWidth,
    0,
    'site header should not draw its own rule; the ROYB bar separates it'
  );
  assert.deepEqual(
    placement.bandBorderWidths,
    [1, 0, 1, 0],
    'ROYB bar should keep thin hard rules above and below only'
  );
  assert.ok(
    Math.abs(placement.bandTop - placement.headerBottom) <= 0.5,
    `ROYB bar should sit flush under the header: ${placement.bandTop} / ${placement.headerBottom}`
  );
  assert.ok(
    Math.abs(placement.wrapTop - placement.headerBottom) <= 1,
    'ROYB wrapper should stay directly after the in-page header'
  );
  assert.ok(
    Math.abs(topGap - 12) <= 1,
    `wordmark to ROYB bar should be the header's 12px: ${topGap}px`
  );
  assert.ok(
    Math.abs(bottomGap - 16) <= 1,
    `ROYB bar to first section should be 16px: ${bottomGap}px`
  );
  assert.ok(
    Math.abs(placement.bandLeft - placement.pageInnerLeft) <= 0.5 &&
      Math.abs(placement.bandRight - placement.pageInnerRight) <= 0.5,
    `ROYB bar should bleed edge to edge of the page: ${placement.bandLeft}-${placement.bandRight} vs ${placement.pageInnerLeft}-${placement.pageInnerRight}`
  );

  return {
    topGap: Number(topGap.toFixed(2)),
    bottomGap: Number(bottomGap.toFixed(2)),
  };
}

async function assertDarkRoybBandBorder(page: Page) {
  const result = await page.evaluate(() => {
    const band = document.querySelector<HTMLElement>(
      '[data-testid="royb-band"]'
    );
    const style = band ? getComputedStyle(band) : null;

    return {
      height: band?.getBoundingClientRect().height ?? 0,
      borderTopWidth: Number.parseFloat(style?.borderTopWidth ?? '0'),
      borderRightWidth: Number.parseFloat(style?.borderRightWidth ?? '0'),
      borderBottomWidth: Number.parseFloat(style?.borderBottomWidth ?? '0'),
      borderLeftWidth: Number.parseFloat(style?.borderLeftWidth ?? '0'),
      borderTopColor: style?.borderTopColor ?? '',
    };
  });

  assert.equal(result.height, 9, 'dark ROYB bar should keep the same height');
  assert.deepEqual(
    [
      result.borderTopWidth,
      result.borderRightWidth,
      result.borderBottomWidth,
      result.borderLeftWidth,
    ],
    [1, 0, 1, 0],
    'dark ROYB bar should render thin hard rules above and below'
  );
  assert.equal(
    result.borderTopColor,
    'rgb(85, 85, 85)',
    'dark ROYB border should use #555'
  );
}

async function assertSitePageShell(page: Page, expected: 'desktop' | 'mobile') {
  const result = await page.evaluate(() => {
    const root = document.documentElement;
    const originalClassName = root.className;
    const lengthProbe = document.createElement('div');
    lengthProbe.style.position = 'absolute';
    lengthProbe.style.visibility = 'hidden';
    lengthProbe.style.pointerEvents = 'none';
    lengthProbe.style.width = 'var(--site-mobile-breakpoint)';
    document.body.append(lengthProbe);
    const siteMobileBreakpointPx = lengthProbe.getBoundingClientRect().width;
    lengthProbe.style.width = 'var(--site-desktop-breakpoint)';
    const siteDesktopBreakpointPx = lengthProbe.getBoundingClientRect().width;
    lengthProbe.style.width = 'var(--site-paper-max-width)';
    const sitePaperMaxWidthPx = lengthProbe.getBoundingClientRect().width;
    lengthProbe.style.width = 'var(--site-page-max-width)';
    const sitePageMaxWidthPx = lengthProbe.getBoundingClientRect().width;
    lengthProbe.remove();
    const sitePage = document.querySelector<HTMLElement>(
      '[data-testid="site-page"]'
    );
    const header = document.querySelector<HTMLElement>(
      '[data-testid="site-header"]'
    );
    const footer = document.querySelector<HTMLElement>(
      '[data-testid="site-footer"]'
    );
    const sitePageStyle = sitePage ? getComputedStyle(sitePage) : null;
    const headerStyle = header ? getComputedStyle(header) : null;
    const footerStyle = footer ? getComputedStyle(footer) : null;
    const htmlStyle = getComputedStyle(root);
    const bodyStyle = getComputedStyle(document.body);
    const bodyRect = document.body.getBoundingClientRect();
    const pageRect = sitePage?.getBoundingClientRect();
    const headerRect = header?.getBoundingClientRect();
    const footerRect = footer?.getBoundingClientRect();

    root.classList.remove('light');
    root.classList.add('dark');

    const darkSitePageStyle = sitePage ? getComputedStyle(sitePage) : null;
    const darkHtmlStyle = getComputedStyle(root);
    const darkBodyStyle = getComputedStyle(document.body);
    const darkResult = {
      htmlBackground: darkHtmlStyle.backgroundColor,
      htmlBackgroundImage: darkHtmlStyle.backgroundImage,
      htmlBackgroundPosition: darkHtmlStyle.backgroundPosition,
      htmlBackgroundSize: darkHtmlStyle.backgroundSize,
      bodyBackground: darkBodyStyle.backgroundColor,
      bodyBackgroundImage: darkBodyStyle.backgroundImage,
      bodyBackgroundPosition: darkBodyStyle.backgroundPosition,
      bodyBackgroundSize: darkBodyStyle.backgroundSize,
      pageBackground: darkSitePageStyle?.backgroundColor ?? '',
      pageBackgroundImage: darkSitePageStyle?.backgroundImage ?? '',
      pageBorderColor: darkSitePageStyle?.borderTopColor ?? '',
      pageBoxShadow: darkSitePageStyle?.boxShadow ?? '',
    };

    root.className = originalClassName;

    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      siteMobileBreakpointPx,
      siteDesktopBreakpointPx,
      sitePaperMaxWidthPx,
      sitePageMaxWidthPx,
      htmlBackground: htmlStyle.backgroundColor,
      htmlBackgroundImage: htmlStyle.backgroundImage,
      htmlBackgroundPosition: htmlStyle.backgroundPosition,
      htmlBackgroundSize: htmlStyle.backgroundSize,
      bodyBackground: bodyStyle.backgroundColor,
      bodyBackgroundImage: bodyStyle.backgroundImage,
      bodyBackgroundPosition: bodyStyle.backgroundPosition,
      bodyBackgroundSize: bodyStyle.backgroundSize,
      bodyDisplay: bodyStyle.display,
      bodyTop: bodyRect.top,
      pageBackground: sitePageStyle?.backgroundColor ?? '',
      pageBackgroundImage: sitePageStyle?.backgroundImage ?? '',
      pageBorderColor: sitePageStyle?.borderTopColor ?? '',
      pageBorderTopWidth: Number.parseFloat(
        sitePageStyle?.borderTopWidth ?? '0'
      ),
      pageBoxShadow: sitePageStyle?.boxShadow ?? '',
      pagePaddingLeft: Number.parseFloat(sitePageStyle?.paddingLeft ?? '0'),
      pagePaddingRight: Number.parseFloat(sitePageStyle?.paddingRight ?? '0'),
      pageLeft: pageRect?.left ?? 0,
      pageRight: pageRect?.right ?? 0,
      pageTop: pageRect?.top ?? 0,
      pageBottom: pageRect?.bottom ?? 0,
      pageWidth: pageRect?.width ?? 0,
      headerPosition: headerStyle?.position ?? '',
      footerPosition: footerStyle?.position ?? '',
      headerPaddingTop: Number.parseFloat(headerStyle?.paddingTop ?? '0'),
      headerPaddingBottom: Number.parseFloat(headerStyle?.paddingBottom ?? '0'),
      footerPaddingTop: Number.parseFloat(footerStyle?.paddingTop ?? '0'),
      footerPaddingBottom: Number.parseFloat(footerStyle?.paddingBottom ?? '0'),
      headerLeft: headerRect?.left ?? 0,
      headerRight: headerRect?.right ?? 0,
      footerLeft: footerRect?.left ?? 0,
      footerRight: footerRect?.right ?? 0,
      dark: darkResult,
    };
  });

  assert.ok(
    result.siteMobileBreakpointPx > 0,
    'site mobile breakpoint token should resolve to a real length'
  );
  assert.ok(
    Math.abs(result.siteDesktopBreakpointPx - result.siteMobileBreakpointPx) <=
      1,
    'site desktop breakpoint should start immediately after the mobile breakpoint'
  );
  assert.ok(
    Math.abs(result.sitePageMaxWidthPx - result.sitePaperMaxWidthPx) <= 1,
    'paper sheet max width should stay tied to the paper width token'
  );
  assert.ok(
    result.sitePageMaxWidthPx < result.siteMobileBreakpointPx,
    'paper sheet max width should remain smaller than the mobile form breakpoint'
  );
  if (expected === 'desktop') {
    assert.ok(
      result.viewportWidth >= result.siteDesktopBreakpointPx,
      'desktop shell should only apply at or above the site desktop breakpoint'
    );
  } else {
    assert.ok(
      result.viewportWidth <= result.siteMobileBreakpointPx,
      'mobile shell should apply through the site mobile breakpoint'
    );
  }
  assert.equal(
    result.bodyDisplay,
    'flow-root',
    'body should prevent the page margin from shifting the ledger line origin'
  );
  assert.equal(
    result.bodyTop,
    0,
    'body should stay anchored at the viewport top'
  );
  assert.equal(
    result.pageBackgroundImage,
    'none',
    'paper sheet should stay solid'
  );
  assert.equal(
    result.headerPosition,
    'static',
    'site header should stay in the page flow'
  );
  assert.equal(
    result.footerPosition,
    'static',
    'site footer should stay in the page flow'
  );
  assert.equal(
    result.headerPaddingTop,
    12,
    'site header content should sit 12px from the paper top edge'
  );
  assert.equal(
    result.headerPaddingBottom,
    result.headerPaddingTop,
    'site header padding should be vertically symmetric'
  );
  assert.equal(
    result.footerPaddingTop,
    result.footerPaddingBottom,
    'site footer padding should be vertically symmetric'
  );
  assert.equal(
    result.footerPaddingBottom,
    10,
    'site footer content should sit 10px from the paper bottom edge'
  );
  assert.ok(
    Math.abs(result.headerLeft - (result.pageLeft + result.pagePaddingLeft)) <=
      1 &&
      Math.abs(
        result.headerRight - (result.pageRight - result.pagePaddingRight)
      ) <= 1 &&
      Math.abs(
        result.footerLeft - (result.pageLeft + result.pagePaddingLeft)
      ) <= 1 &&
      Math.abs(
        result.footerRight - (result.pageRight - result.pagePaddingRight)
      ) <= 1,
    'header and footer should live inside the paper sheet padding'
  );
  assert.equal(
    result.dark.pageBackgroundImage,
    'none',
    'dark mode paper sheet should stay solid'
  );

  if (expected === 'desktop') {
    assert.equal(
      result.htmlBackground,
      result.bodyBackground,
      'desktop html and body should share the ledger background'
    );
    assert.equal(
      result.htmlBackgroundImage,
      result.bodyBackgroundImage,
      'desktop html and body should share the ledger paper lines'
    );
    assert.equal(
      result.htmlBackgroundPosition,
      result.bodyBackgroundPosition,
      'desktop html and body should align the ledger paper lines'
    );
    assert.match(
      result.bodyBackgroundImage,
      /linear-gradient.*23px.*24px/,
      'desktop ledger should use paper-line background'
    );
    assert.equal(
      result.bodyBackgroundPosition,
      '0px 0px',
      'desktop ledger paper lines should place the first visible rule after a full gap'
    );
    assert.equal(
      result.bodyBackgroundSize,
      '100% 24px',
      'desktop ledger paper lines should follow the shared 24px rhythm'
    );
    assert.notEqual(
      result.bodyBackground,
      result.pageBackground,
      'desktop paper sheet should sit on a darker ledger background'
    );
    assert.ok(
      colorBrightness(result.pageBackground) >
        colorBrightness(result.bodyBackground),
      'desktop paper sheet should be lighter than the ledger background'
    );
    assert.equal(
      result.dark.htmlBackground,
      result.dark.bodyBackground,
      'dark desktop html and body should share the ledger background'
    );
    assert.equal(
      result.dark.htmlBackgroundImage,
      result.dark.bodyBackgroundImage,
      'dark desktop html and body should share the ledger paper lines'
    );
    assert.equal(
      result.dark.htmlBackgroundPosition,
      result.dark.bodyBackgroundPosition,
      'dark desktop html and body should align the ledger paper lines'
    );
    assert.match(
      result.dark.bodyBackgroundImage,
      /linear-gradient.*23px.*24px/,
      'dark desktop ledger should keep paper-line background'
    );
    assert.equal(
      result.dark.bodyBackgroundPosition,
      '0px 0px',
      'dark desktop ledger paper lines should place the first visible rule after a full gap'
    );
    assert.equal(
      result.dark.bodyBackgroundSize,
      '100% 24px',
      'dark desktop ledger paper lines should keep the same rhythm'
    );
    assert.notEqual(
      result.dark.bodyBackground,
      result.dark.pageBackground,
      'dark desktop should preserve page-on-ledger contrast'
    );
    assert.ok(
      colorBrightness(result.dark.pageBackground) >
        colorBrightness(result.dark.bodyBackground),
      'dark desktop paper sheet should be lighter than the ledger background'
    );
    assert.notEqual(
      result.dark.pageBorderColor,
      result.dark.pageBackground,
      'dark desktop page rule should remain high contrast'
    );
    assert.equal(
      result.pageBorderTopWidth,
      1,
      'desktop sheet should have a rule'
    );
    assert.notEqual(
      result.pageBoxShadow,
      'none',
      'desktop sheet should use a hard offset shadow'
    );
    assert.match(
      result.pageBoxShadow,
      /rgba\(.+\) 6px 6px 0px/,
      'paper shadow should be a lighter opacity-based 6px hard block'
    );
    assert.ok(
      result.pageTop > 0 && result.pageWidth < result.viewportWidth,
      'desktop sheet should reveal the ledger around the page'
    );
  } else {
    assert.equal(
      result.htmlBackground,
      result.bodyBackground,
      'mobile html and body should share a solid background'
    );
    assert.equal(
      result.bodyBackground,
      result.pageBackground,
      'mobile shell should not expose a separate ledger background'
    );
    assert.equal(
      result.htmlBackgroundImage,
      'none',
      'mobile html should drop the ledger paper lines'
    );
    assert.equal(
      result.bodyBackgroundImage,
      'none',
      'mobile body should drop the ledger paper lines'
    );
    assert.equal(
      result.dark.htmlBackground,
      result.dark.bodyBackground,
      'dark mobile html and body should share a solid background'
    );
    assert.equal(
      result.dark.bodyBackground,
      result.dark.pageBackground,
      'dark mobile shell should not expose a separate ledger background'
    );
    assert.equal(
      result.dark.htmlBackgroundImage,
      'none',
      'dark mobile html should drop the ledger paper lines'
    );
    assert.equal(
      result.dark.bodyBackgroundImage,
      'none',
      'dark mobile body should drop the ledger paper lines'
    );
    assert.equal(
      result.pageBorderTopWidth,
      0,
      'mobile sheet should drop the desktop page rule'
    );
    assert.equal(
      result.pageBoxShadow,
      'none',
      'mobile sheet should drop the desktop page shadow'
    );
    assert.equal(result.pageLeft, 0, 'mobile sheet should fill the viewport');
    assert.equal(
      Math.round(result.pageWidth),
      result.viewportWidth,
      'mobile sheet should stay full-width'
    );
  }

  return {
    siteMobileBreakpointPx: result.siteMobileBreakpointPx,
    siteDesktopBreakpointPx: result.siteDesktopBreakpointPx,
  };
}

async function assertVisibleOneLineDescriptions(page: Page) {
  const failures = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-one-line="true"]')]
      .filter((element) => {
        const rect = element.getBoundingClientRect();

        return rect.width > 0 && rect.height > 0;
      })
      .map((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const lineHeight = Number.parseFloat(style.lineHeight);

        return {
          text: element.textContent?.replace(/\s+/g, ' ').trim(),
          whiteSpace: style.whiteSpace,
          overflowX: style.overflowX,
          height: Number(rect.height.toFixed(2)),
          lineHeight,
        };
      })
      .filter(
        (item) =>
          item.whiteSpace !== 'nowrap' ||
          item.overflowX !== 'hidden' ||
          item.height > item.lineHeight * 1.5
      )
  );

  assert.deepEqual(failures, [], 'visible descriptions should be one line');
}

async function assertThemeToggleIsStable(page: Page) {
  const before = await page.getByTestId('site-page').boundingBox();
  const beforeClass = await page.locator('html').getAttribute('class');

  await page.getByTestId('theme-toggle').click();
  await page.waitForFunction(
    (initial) => document.documentElement.className !== initial,
    beforeClass
  );

  const afterClass = await page.locator('html').getAttribute('class');
  const after = await page.getByTestId('site-page').boundingBox();

  assert.ok(
    afterClass?.includes('dark') || afterClass?.includes('light'),
    'theme toggle should set an explicit root theme class'
  );
  assert.equal(
    Math.round(before?.width ?? 0),
    Math.round(after?.width ?? 0),
    'theme toggle should not change sheet width'
  );

  await page.getByTestId('theme-toggle').click();
  await page.waitForFunction(
    (current) => document.documentElement.className !== current,
    afterClass
  );
}

async function assertScrollbarStyles() {
  const css = await readFile(path.join(root, 'app', 'globals.css'), 'utf8');

  assert.ok(
    css.includes('scrollbar-gutter: auto'),
    'scrollbars should appear only when overflow needs them'
  );
  assert.ok(
    css.includes('::-webkit-scrollbar-thumb') &&
      css.includes('border-radius: 0 !important'),
    'scrollbar thumb should be square'
  );
  assert.ok(
    css.includes('var(--section-color, var(--roy-b)) 20%') &&
      css.includes(
        'box-shadow: inset 0 -0.42em 0 var(--link-hover-highlight)'
      ) &&
      !css.includes('--roy-r-highlight') &&
      !css.includes('--section-highlight'),
    'link hover highlight should use section color at 20% alpha'
  );
  const railGutterMatches = css.match(/--rail-gutter:/g) ?? [];
  const railMarkerMatches = css.match(/--rail-marker-size:/g) ?? [];

  assert.ok(
    css.includes('--rail-gutter: 2rem') &&
      railGutterMatches.length === 1 &&
      css.includes('--rail-marker-size: 0.75rem') &&
      railMarkerMatches.length === 1,
    'rail gutter and marker sizing should be centralized as root tokens'
  );
}

async function assertHome(page: Page) {
  const result = await page.evaluate(() => {
    const main = document.querySelector('main');
    const header = document.querySelector('[data-testid="site-header"]');
    const wordmarkLinks = [
      ...document.querySelectorAll<HTMLElement>('[data-testid="wordmark"] a'),
    ];
    const wordmarkLinkTextSpans = [
      ...document.querySelectorAll<HTMLElement>(
        '[data-testid="wordmark"] .royb-link-highlight'
      ),
    ];
    const themeToggle = document.querySelector('[data-testid="theme-toggle"]');
    const themeToggleClassName = themeToggle
      ? [themeToggle, ...themeToggle.querySelectorAll('*')]
          .map((element) => element.className)
          .join(' ')
      : '';
    const heroSection = document.querySelector('[data-testid="hero-section"]');
    const heroHeader = heroSection?.querySelector<HTMLElement>('header');
    const heroContent = heroSection?.querySelector<HTMLElement>(
      '[data-testid="hero-content"]'
    );
    const heroVisibleTitleElement = heroSection?.querySelector<HTMLElement>(
      '[data-testid="hero-title"], [data-testid="hero-title-mobile"]'
    );
    const heroSemanticTitle = heroSection?.querySelector<HTMLElement>('h1');
    const heroContentRect = heroContent?.getBoundingClientRect();
    const heroContactColumn = heroContent?.querySelector<HTMLElement>(
      '[data-testid="hero-contact-column"]'
    );
    const heroContactColumnRect = heroContactColumn?.getBoundingClientRect();
    const heroContactColumnStyle = heroContactColumn
      ? getComputedStyle(heroContactColumn)
      : null;
    const heroStoryColumn = heroContent?.querySelector<HTMLElement>(
      '[data-testid="hero-story-column"]'
    );
    const heroStoryColumnRect = heroStoryColumn?.getBoundingClientRect();
    const heroStoryColumnStyle = heroStoryColumn
      ? getComputedStyle(heroStoryColumn)
      : null;
    const heroStory = heroContent?.querySelector<HTMLElement>(
      '[data-testid="hero-story"]'
    );
    const heroStoryRect = heroStory?.getBoundingClientRect();
    const heroContactIndex = heroContactColumn?.firstElementChild as
      | HTMLElement
      | null
      | undefined;
    const heroContactDetails =
      heroContactIndex?.querySelector<HTMLElement>('div');
    const heroContactLabels = [
      ...(heroContactColumn?.querySelectorAll('a') ?? []),
    ].map((link) => link.textContent?.trim() ?? '');
    const heroPortrait = document.querySelector<HTMLElement>(
      '[data-testid="hero-portrait"]'
    );
    const heroPortraitStyle = heroPortrait
      ? getComputedStyle(heroPortrait)
      : null;
    const heroPortraitRect = heroPortrait?.getBoundingClientRect();
    const experienceSection = document.querySelector('#experience');
    const experienceTitle = experienceSection?.querySelector('header h2');
    const experienceTitleStyle = experienceTitle
      ? getComputedStyle(experienceTitle)
      : null;
    const firstGroupLabel = experienceSection?.querySelector(
      '[data-testid="experience-group-label"]'
    );
    const experienceGroupLabelStyles = [
      ...(experienceSection?.querySelectorAll<HTMLElement>(
        '[data-testid="experience-group-label"]'
      ) ?? []),
    ].map((label) => {
      const style = getComputedStyle(label);
      const rect = label.getBoundingClientRect();
      const toggleRect = label.parentElement?.getBoundingClientRect();
      const name = label.querySelector<HTMLElement>(
        '[data-testid="experience-group-label-name"]'
      );
      const nameStyle = name ? getComputedStyle(name) : null;

      return {
        text: label.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        className: label.className,
        color: style.color,
        fontFamily: style.fontFamily,
        fontSize: Number.parseFloat(style.fontSize),
        justifySelf: style.justifySelf,
        letterSpacing: style.letterSpacing,
        textDecorationLine: style.textDecorationLine,
        textTransform: style.textTransform,
        nameStyle: {
          fontFamily: nameStyle?.fontFamily ?? '',
          fontSize: Number.parseFloat(nameStyle?.fontSize ?? '0'),
          letterSpacing: nameStyle?.letterSpacing ?? '',
          textTransform: nameStyle?.textTransform ?? '',
        },
        width: rect.width,
        left: rect.left,
        toggleWidth: toggleRect?.width ?? 0,
        toggleLeft: toggleRect?.left ?? 0,
      };
    });
    const firstRailTitle = experienceSection?.querySelector(
      '[data-testid="rail-title"]'
    );
    const experienceLinks = [
      ...(experienceSection?.querySelectorAll<HTMLAnchorElement>('a') ?? []),
    ].map((link) => ({
      text: link.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      rawText: link.textContent ?? '',
      whiteSpace: getComputedStyle(link).whiteSpace,
      href: link.href,
    }));
    const experienceTitleRuns = [
      ...(experienceSection?.querySelectorAll<HTMLElement>(
        '[data-testid="experience-title-run"]'
      ) ?? []),
    ].map((run) => ({
      text: run.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      rawText: run.textContent ?? '',
      whiteSpace: getComputedStyle(run).whiteSpace,
    }));
    const advisorLabels = [
      ...(experienceSection?.querySelectorAll<HTMLElement>(
        '[data-testid="advisor-label"]'
      ) ?? []),
    ].map((label) => {
      const style = getComputedStyle(label);

      return {
        text: label.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        color: style.color,
        fontFamily: style.fontFamily,
        fontSize: Number.parseFloat(style.fontSize),
        fontWeight: Number.parseInt(style.fontWeight, 10),
        marginLeft: Number.parseFloat(style.marginLeft),
        paddingLeft: Number.parseFloat(style.paddingLeft),
        textTransform: style.textTransform,
        letterSpacing: style.letterSpacing,
      };
    });
    const advisorGapCount =
      experienceSection?.querySelectorAll(
        '[data-testid="advisor-underline-gap"]'
      ).length ?? 0;
    const footer = document.querySelector('[data-testid="site-footer"]');
    const footerUpdate = footer?.querySelector<HTMLElement>(
      '[data-testid="site-footer-updated"]'
    );
    const footerQuote = footer?.querySelector<HTMLElement>(
      '[data-testid="site-footer-quote"]'
    );
    const footerUpdateStyle = footerUpdate
      ? getComputedStyle(footerUpdate)
      : null;
    const footerQuoteStyle = footerQuote ? getComputedStyle(footerQuote) : null;
    const topLevelSections = [...document.querySelectorAll('main > section')];
    const rootStyle = getComputedStyle(document.documentElement);
    const sectionMarkerData = topLevelSections.map((section) => {
      const marker = section.querySelector<HTMLElement>('header span');
      const style = marker ? getComputedStyle(marker) : null;
      const rect = marker?.getBoundingClientRect();

      return {
        left: rect?.left ?? 0,
        right: rect?.right ?? 0,
        width: rect?.width ?? 0,
        center: rect ? rect.left + rect.width / 2 : 0,
        fontSize: Number.parseFloat(style?.fontSize ?? '0'),
        fontWeight: Number.parseInt(style?.fontWeight ?? '0', 10),
        color: style?.color ?? '',
      };
    });
    const bodyStyle = getComputedStyle(document.body);
    const bodyColor = bodyStyle.color;
    const bodyBackgroundColor = bodyStyle.backgroundColor;
    const bodyFontFamily = bodyStyle.fontFamily;
    const pageBackgroundColor = getComputedStyle(
      document.querySelector<HTMLElement>('[data-testid="site-page"]') ??
        document.body
    ).backgroundColor;
    const readingProbe = document.createElement('span');

    readingProbe.className = 'reading-copy';
    document.body.append(readingProbe);
    const readingFontFamily = getComputedStyle(readingProbe).fontFamily;
    readingProbe.remove();
    const sectionLabelColors = topLevelSections.map((section) => {
      const label = section.querySelector<HTMLElement>('header h2');

      return label ? getComputedStyle(label).color : '';
    });
    const sectionLabelFontWeights = topLevelSections.map((section) => {
      const label = section.querySelector<HTMLElement>('header h2');

      return label
        ? Number.parseInt(getComputedStyle(label).fontWeight, 10)
        : 0;
    });
    const sectionLabelLefts = topLevelSections.map(
      (section) =>
        section.querySelector<HTMLElement>('header h2')?.getBoundingClientRect()
          .left ?? 0
    );
    const sectionLefts = topLevelSections.map(
      (section) => section.getBoundingClientRect().left
    );
    const sectionContentGaps = topLevelSections
      .slice(1)
      .map((section, index) => {
        const previousSection = topLevelSections[index];
        const previousContent =
          previousSection?.lastElementChild as HTMLElement | null;
        const currentHeader = section.querySelector<HTMLElement>('header');

        return (
          (currentHeader?.getBoundingClientRect().top ?? 0) -
          (previousContent?.getBoundingClientRect().bottom ?? 0)
        );
      });
    const lastSection = topLevelSections[topLevelSections.length - 1];
    const lastSectionContent =
      lastSection?.lastElementChild as HTMLElement | null;
    const writingFooterGap =
      (footer?.getBoundingClientRect().top ?? 0) -
      (lastSectionContent?.getBoundingClientRect().bottom ?? 0);
    const sharedRowTitleLefts = [
      experienceSection
        ?.querySelector<HTMLElement>('[data-testid="experience-group-label"]')
        ?.getBoundingClientRect().left ?? 0,
      experienceSection
        ?.querySelector<HTMLElement>('[data-testid="rail-title"]')
        ?.getBoundingClientRect().left ?? 0,
      document
        .querySelector<HTMLElement>(
          '#publications [data-testid="publication-title-wrap"]'
        )
        ?.getBoundingClientRect().left ?? 0,
      document
        .querySelector<HTMLElement>('#writing [data-testid="rail-title"]')
        ?.getBoundingClientRect().left ?? 0,
    ].filter((left) => left > 0);
    const markerData = [
      ...document.querySelectorAll<HTMLElement>(
        '[data-testid="rail-dot"], [data-testid="publication-dot"]'
      ),
    ].map((dot) => {
      const rect = dot.getBoundingClientRect();
      const row = dot.closest('li');
      const title = row?.querySelector<HTMLElement>(
        '[data-testid="rail-title"], [data-testid="publication-title"]'
      );
      const titleRect = title?.getBoundingClientRect();
      const titleStyle = title ? getComputedStyle(title) : null;
      const titleFontSize = Number.parseFloat(titleStyle?.fontSize ?? '0');
      const parsedLineHeight = Number.parseFloat(titleStyle?.lineHeight ?? '0');
      const titleLineHeight =
        Number.isFinite(parsedLineHeight) && parsedLineHeight > 0
          ? parsedLineHeight
          : titleFontSize * 1.25;

      return {
        left: rect.left,
        width: rect.width,
        center: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
        titleFirstLineCenterY: titleRect
          ? titleRect.top + Math.min(titleRect.height, titleLineHeight) / 2
          : 0,
      };
    });
    const connectorCenters = [
      ...document.querySelectorAll<HTMLElement>(
        [
          '[data-testid="rail-connector"]',
          '[data-testid="publication-connector"]',
          '[data-testid="writing-action-connector"]',
          '[data-testid="publication-action-connector"]',
        ].join(', ')
      ),
    ].map((connector) => {
      const rect = connector.getBoundingClientRect();

      return rect.left + rect.width / 2;
    });
    const [writingActionRail, publicationActionRail] = [
      '#writing',
      '#publications',
    ].map((selector) => {
      const row = document.querySelector<HTMLElement>(
        `${selector} [data-testid$="action-row"]`
      );
      const connector = document.querySelector<HTMLElement>(
        `${selector} [data-testid$="action-connector"]`
      );
      const link = row?.querySelector<HTMLElement>('a, button');
      const rowRect = row?.getBoundingClientRect();
      const connectorRect = connector?.getBoundingClientRect();
      const linkRect = link?.getBoundingClientRect();
      const connectorStyle = connector ? getComputedStyle(connector) : null;

      return {
        rowExists: Boolean(row),
        connectorBackgroundImage: connectorStyle?.backgroundImage ?? '',
        paddingTop: row
          ? Number.parseFloat(getComputedStyle(row).paddingTop)
          : 0,
        connectorCenter: connectorRect
          ? connectorRect.left + connectorRect.width / 2
          : 0,
        connectorTop: connectorRect?.top ?? 0,
        connectorBottom: connectorRect?.bottom ?? 0,
        rowTop: rowRect?.top ?? 0,
        rowBottom: rowRect?.bottom ?? 0,
        linkLeft: linkRect?.left ?? 0,
        linkBottom: linkRect?.bottom ?? 0,
      };
    });
    const railRowPaddingBottoms = [
      ...document.querySelectorAll<HTMLElement>(
        '#experience ul, #publications ul, #writing ul'
      ),
    ].flatMap((list) =>
      [...list.children]
        .slice(0, -1)
        .filter(
          (row): row is HTMLElement =>
            row instanceof HTMLElement &&
            Boolean(
              row.querySelector(
                '[data-testid="rail-dot"], [data-testid="publication-dot"]'
              )
            )
        )
        .map((row) => Number.parseFloat(getComputedStyle(row).paddingBottom))
    );
    const groups = [
      ...document.querySelectorAll('[data-testid="experience-group"]'),
    ].map((group) => {
      const toggle = group.querySelector<HTMLElement>(
        '[data-testid="experience-group-toggle"]'
      );
      const showMore = [...group.querySelectorAll('button')].find(
        (button) => button.textContent?.trim() === 'show more...'
      );
      const showMoreWrap = group.querySelector<HTMLElement>(
        '[data-testid="experience-more-row"]'
      );
      const showMoreRect = showMore?.getBoundingClientRect();

      return {
        kind: group.getAttribute('data-group'),
        expanded: toggle?.getAttribute('aria-expanded') ?? '',
        rows: group.querySelectorAll('[data-testid="rail-title"]').length,
        text: group.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        hasShowMore: Boolean(showMore),
        togglePaddingBottom: toggle
          ? Number.parseFloat(getComputedStyle(toggle).paddingBottom)
          : 0,
        showMorePaddingTop: showMoreWrap
          ? Number.parseFloat(getComputedStyle(showMoreWrap).paddingTop)
          : 0,
        showMoreLeft: showMoreRect?.left ?? 0,
        marginBottom: Number.parseFloat(getComputedStyle(group).marginBottom),
      };
    });
    const experienceDescriptionStyles = [
      ...(experienceSection?.querySelectorAll<HTMLElement>(
        'p[data-rail-description="true"]'
      ) ?? []),
    ].map((description) => {
      const style = getComputedStyle(description);

      return {
        color: style.color,
        fontFamily: style.fontFamily,
        fontSize: Number.parseFloat(style.fontSize),
        fontWeight: Number.parseInt(style.fontWeight, 10),
        lineHeight: style.lineHeight,
        textTransform: style.textTransform,
      };
    });
    const experienceLineLabels = [
      ...(experienceSection?.querySelectorAll<HTMLElement>(
        '[data-testid="experience-line-label"]'
      ) ?? []),
    ].map((label) => label.textContent?.trim() ?? '');
    const experienceLineLabelsItalic = [
      ...(experienceSection?.querySelectorAll<HTMLElement>(
        '[data-testid="experience-line-label"]'
      ) ?? []),
    ].every((label) => getComputedStyle(label).fontStyle === 'italic');
    const dots = [...document.querySelectorAll('[data-testid="rail-dot"]')].map(
      (dot) => {
        const mark = dot.querySelector<SVGElement>('svg[data-org-mark]');
        const markRect = mark?.getBoundingClientRect();
        const dotRect = dot.getBoundingClientRect();

        return {
          state: dot.getAttribute('data-state'),
          className: dot.className,
          border: Number.parseFloat(getComputedStyle(dot).borderTopWidth),
          borderColor: getComputedStyle(dot).borderTopColor,
          backgroundColor: getComputedStyle(dot).backgroundColor,
          color: getComputedStyle(dot).color,
          hasMark: Boolean(mark),
          markCenterOffsetX: markRect
            ? markRect.left +
              markRect.width / 2 -
              (dotRect.left + dotRect.width / 2)
            : 0,
          markCenterOffsetY: markRect
            ? markRect.top +
              markRect.height / 2 -
              (dotRect.top + dotRect.height / 2)
            : 0,
          markHeight: markRect?.height ?? 0,
        };
      }
    );
    const publicationButtons = document.querySelectorAll(
      '[data-testid="publication-row-button"]'
    );
    const publicationOpenDetails = document.querySelectorAll(
      '[data-testid="publication-open"]'
    );
    const publicationTitles = [
      ...document.querySelectorAll<HTMLElement>(
        '#publications [data-testid="publication-title"]'
      ),
    ];
    const publicationTitleLineChecks = publicationTitles.map((title) => {
      const wordRects: Record<
        string,
        {
          top: number;
          bottom: number;
        } | null
      > = {
        organic: null,
        polymers: null,
      };

      for (const word of Object.keys(wordRects)) {
        const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode() as Text | null;

        while (node) {
          const index = node.data.indexOf(word);

          if (index >= 0) {
            const range = document.createRange();

            range.setStart(node, index);
            range.setEnd(node, index + word.length);

            const rect = range.getBoundingClientRect();

            range.detach();

            wordRects[word] = {
              top: rect.top,
              bottom: rect.bottom,
            };

            break;
          }

          node = walker.nextNode() as Text | null;
        }
      }

      const organic = wordRects.organic;
      const polymers = wordRects.polymers;

      return {
        text: title.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        organicPolymersSameLine:
          Boolean(organic && polymers) &&
          Math.abs((organic?.top ?? 0) - (polymers?.top ?? 0)) <= 1 &&
          Math.abs((organic?.bottom ?? 0) - (polymers?.bottom ?? 0)) <= 1,
      };
    });
    const publicationAuthors = [
      ...document.querySelectorAll('[data-testid="publication-authors"]'),
    ].map((authors) => authors.textContent?.replace(/\s+/g, ' ').trim() ?? '');
    const publicationAuthorStyles = [
      ...document.querySelectorAll<HTMLElement>(
        '[data-testid="publication-authors"]'
      ),
    ].map((authors) => {
      const style = getComputedStyle(authors);

      return {
        color: style.color,
        fontFamily: style.fontFamily,
        fontSize: Number.parseFloat(style.fontSize),
        fontWeight: Number.parseInt(style.fontWeight, 10),
        lineHeight: style.lineHeight,
        textTransform: style.textTransform,
      };
    });
    const publicationSelfAuthors = [
      ...document.querySelectorAll('[data-testid="publication-author-self"]'),
    ].map((author) => author.textContent?.trim() ?? '');
    const publicationSelfAuthorStyles = [
      ...document.querySelectorAll<HTMLElement>(
        '[data-testid="publication-author-self"]'
      ),
    ].map((author) => {
      const style = getComputedStyle(author);

      return {
        className: author.className,
        fontStyle: style.fontStyle,
        fontWeight: Number.parseInt(style.fontWeight, 10),
      };
    });
    const publicationRows = [
      ...(document
        .querySelector('#publications')
        ?.querySelectorAll('[data-testid="publication-row"]') ?? []),
    ].map((row) =>
      [...row.querySelectorAll<HTMLElement>('[data-testid]')].map((element) =>
        element.getAttribute('data-testid')
      )
    );
    const publicationTextStacks = [
      ...(document
        .querySelector('#publications')
        ?.querySelectorAll<HTMLElement>(
          '[data-testid="publication-title-wrap"] > span'
        ) ?? []),
    ].map((stack) => {
      const style = getComputedStyle(stack);

      return {
        className: stack.className,
        display: style.display,
        flexDirection: style.flexDirection,
        rowGap: Number.parseFloat(style.rowGap),
      };
    });
    const publicationChildMarginTops = [
      ...(document
        .querySelector('#publications')
        ?.querySelectorAll<HTMLElement>(
          '[data-testid="publication-authors"], [data-testid="publication-meta-line"]'
        ) ?? []),
    ].map((element) => Number.parseFloat(getComputedStyle(element).marginTop));
    const writingDots = [
      ...(document
        .querySelector('#writing')
        ?.querySelectorAll('[data-testid="rail-dot"]') ?? []),
    ].map((dot) => dot.className);
    const writingNewTags = [
      ...(document.querySelector('#writing')?.querySelectorAll('span') ?? []),
    ]
      .map((element) => element.textContent?.trim() ?? '')
      .filter((text) => text === 'New');
    const writingPostTags = [
      ...(document
        .querySelector('#writing')
        ?.querySelectorAll<HTMLElement>('[data-post-tag]') ?? []),
    ].map((tag) => {
      const style = getComputedStyle(tag);

      return {
        label: tag.textContent?.trim() ?? '',
        kind: tag.dataset.postTag ?? '',
        backgroundColor: style.backgroundColor,
        borderRadius: Number.parseFloat(style.borderRadius),
        borderStyle: style.borderTopStyle,
        fontFamily: style.fontFamily,
        textTransform: style.textTransform,
      };
    });
    const writingMeta = [
      ...(document
        .querySelector('#writing')
        ?.querySelectorAll('[data-testid="writing-row-meta"]') ?? []),
    ].map((meta) => meta.textContent?.replace(/\s+/g, ' ').trim() ?? '');
    const writingMetaStyles = [
      ...(document
        .querySelector('#writing')
        ?.querySelectorAll<HTMLElement>('[data-testid="writing-row-meta"]') ??
        []),
    ].map((meta) => {
      const style = getComputedStyle(meta);

      return {
        color: style.color,
        fontFamily: style.fontFamily,
        fontSize: Number.parseFloat(style.fontSize),
        fontWeight: Number.parseInt(style.fontWeight, 10),
        lineHeight: style.lineHeight,
        textTransform: style.textTransform,
      };
    });
    const writingDates = [
      ...(document
        .querySelector('#writing')
        ?.querySelectorAll('[data-testid="rail-title"]') ?? []),
    ].map(
      (title) =>
        title.nextElementSibling?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    );
    const writingTitleWeights = [
      ...(document
        .querySelector('#writing')
        ?.querySelectorAll<HTMLElement>('[data-testid="rail-title"]') ?? []),
    ].map((title) => Number.parseInt(getComputedStyle(title).fontWeight, 10));
    const writingDescriptions = [
      ...(document
        .querySelector('#writing')
        ?.querySelectorAll('p[data-one-line="true"]') ?? []),
    ];
    const writingConnectors = [
      ...(document
        .querySelector('#writing')
        ?.querySelectorAll<HTMLElement>('[data-testid="rail-connector"]') ??
        []),
    ].map((connector) => {
      const style = getComputedStyle(connector);

      return {
        backgroundImage: style.backgroundImage,
        backgroundColor: style.backgroundColor,
      };
    });
    const publicationDots = [
      ...(document
        .querySelector('#publications')
        ?.querySelectorAll('[data-testid="publication-dot"]') ?? []),
    ].map((dot) => dot.className);
    const publicationConnectors = [
      ...document.querySelectorAll<HTMLElement>(
        '#publications [data-testid="publication-connector"]'
      ),
    ].map((connector) => {
      const style = getComputedStyle(connector);

      return {
        backgroundImage: style.backgroundImage,
        backgroundColor: style.backgroundColor,
      };
    });
    const publicationMetaLines = [
      ...(document
        .querySelector('#publications')
        ?.querySelectorAll('[data-testid="publication-meta-line"]') ?? []),
    ].map((meta) => meta.className);
    const publicationMetaLineTexts = [
      ...(document
        .querySelector('#publications')
        ?.querySelectorAll('[data-testid="publication-meta-line"]') ?? []),
    ].map((meta) => meta.textContent?.replace(/\s+/g, ' ').trim() ?? '');
    const publicationPaddedSlashCount = [
      ...(document
        .querySelector('#publications')
        ?.querySelectorAll<HTMLElement>(
          '[data-testid="publication-meta-line"] span'
        ) ?? []),
    ].filter(
      (element) =>
        element.textContent === '/' &&
        (element.className.includes('px-') ||
          getComputedStyle(element).paddingLeft !== '0px' ||
          getComputedStyle(element).paddingRight !== '0px')
    ).length;
    const publicationMetaLineStyles = [
      ...(document
        .querySelector('#publications')
        ?.querySelectorAll<HTMLElement>(
          '[data-testid="publication-meta-line"]'
        ) ?? []),
    ].map((meta) => {
      const style = getComputedStyle(meta);

      return {
        color: style.color,
        fontFamily: style.fontFamily,
        fontSize: Number.parseFloat(style.fontSize),
        fontWeight: Number.parseInt(style.fontWeight, 10),
        lineHeight: style.lineHeight,
        textTransform: style.textTransform,
      };
    });
    const publicationDateStyles = [
      ...(document
        .querySelector('#publications')
        ?.querySelectorAll('[data-testid="publication-date"]') ?? []),
    ].map((date) => {
      const style = getComputedStyle(date);

      return {
        fontSize: Number.parseFloat(style.fontSize),
        textTransform: style.textTransform,
        letterSpacing: style.letterSpacing,
        color: style.color,
      };
    });
    const mutedProbe = document.createElement('span');

    mutedProbe.style.color = 'var(--muted-foreground)';
    document.body.append(mutedProbe);
    const mutedToken = getComputedStyle(mutedProbe).color;
    mutedProbe.remove();

    const showMoreActionStyles = [...document.querySelectorAll('a, button')]
      .filter((element) =>
        /show more/i.test(element.textContent?.replace(/\s+/g, ' ') ?? '')
      )
      .map((element) => {
        const style = getComputedStyle(element);

        return {
          text: element.textContent?.replace(/\s+/g, ' ').trim() ?? '',
          left: element.getBoundingClientRect().left,
          color: style.color,
          fontSize: Number.parseFloat(style.fontSize),
          fontVariantCaps: style.fontVariantCaps,
          textTransform: style.textTransform,
        };
      });
    const highlightedLinkClassNames = [
      ...document.querySelectorAll<HTMLElement>('a.royb-link-highlight'),
    ].map((link) => link.className);
    const jsonLdTypes = [
      ...document.querySelectorAll<HTMLScriptElement>(
        'script[type="application/ld+json"]'
      ),
    ].map((script) => {
      try {
        return JSON.parse(script.textContent ?? '{}')['@type'] as string;
      } catch {
        return 'invalid';
      }
    });

    return {
      canonicalHref:
        document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
          ?.href ?? '',
      ogUrl:
        document
          .querySelector<HTMLMetaElement>('meta[property="og:url"]')
          ?.getAttribute('content') ?? '',
      h1Texts: [...document.querySelectorAll('h1')].map(
        (heading) => heading.textContent?.replace(/\s+/g, ' ').trim() ?? ''
      ),
      jsonLdTypes,
      mainWidth: main?.getBoundingClientRect().width ?? 0,
      bodyColor,
      bodyBackgroundColor,
      pageBackgroundColor,
      bodyFontFamily,
      readingFontFamily,
      bodyText: document.body.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      mainText: main?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      headerText: header?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      wordmarkLinkDisplays: wordmarkLinks.map(
        (link) => getComputedStyle(link).display
      ),
      wordmarkLinkTextStyles: wordmarkLinkTextSpans.map((text) => {
        const style = getComputedStyle(text);

        return {
          text: text.textContent?.replace(/\s+/g, ' ').trim() ?? '',
          className: text.className,
          textDecorationLine: style.textDecorationLine,
        };
      }),
      headerPaddingLeft: header
        ? Number.parseFloat(getComputedStyle(header).paddingLeft)
        : 0,
      headerPaddingRight: header
        ? Number.parseFloat(getComputedStyle(header).paddingRight)
        : 0,
      themeToggleText:
        (themeToggle as HTMLElement | null)?.innerText
          .replace(/\s+/g, ' ')
          .trim() ?? '',
      themeToggleClassName,
      heroVisibleTitleExists: Boolean(heroVisibleTitleElement),
      heroSemanticTitleClassName: heroSemanticTitle?.className ?? '',
      heroStoryLeft: heroStoryRect?.left ?? 0,
      heroContactText:
        heroSection?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      dukeLinkHref:
        heroSection?.querySelector<HTMLAnchorElement>(
          'a[href="https://www.duke.edu/"]'
        )?.href ?? '',
      heroHeaderContentGap:
        (heroContentRect?.top ?? 0) -
        (heroHeader?.getBoundingClientRect().bottom ?? 0),
      heroContentWidth: heroContentRect?.width ?? 0,
      heroContactColumnWidth: heroContactColumnRect?.width ?? 0,
      heroStoryAlignSelf: heroStoryColumnStyle?.alignSelf ?? '',
      heroStoryDividerCenterDelta:
        heroStoryColumnRect && heroContactColumnRect
          ? heroStoryColumnRect.top +
            heroStoryColumnRect.height / 2 -
            (heroContactColumnRect.top + heroContactColumnRect.height / 2)
          : Number.POSITIVE_INFINITY,
      heroStoryDividerTopGap:
        heroStoryColumnRect && heroContactColumnRect
          ? heroStoryColumnRect.top - heroContactColumnRect.top
          : Number.POSITIVE_INFINITY,
      heroStoryDividerBottomGap:
        heroStoryColumnRect && heroContactColumnRect
          ? heroContactColumnRect.bottom - heroStoryColumnRect.bottom
          : Number.POSITIVE_INFINITY,
      heroStoryDividerStyle: heroContactColumnStyle?.borderRightStyle ?? '',
      heroStoryDividerColor: heroContactColumnStyle?.borderRightColor ?? '',
      heroContactIndexGap: heroContactIndex
        ? Number.parseFloat(getComputedStyle(heroContactIndex).rowGap)
        : 0,
      heroContactDetailsGap: heroContactDetails
        ? Number.parseFloat(getComputedStyle(heroContactDetails).rowGap)
        : 0,
      heroContactLabels,
      heroPortraitExists: Boolean(heroPortrait),
      heroPortraitWidth: heroPortraitRect?.width ?? 0,
      heroPortraitHeight: heroPortraitRect?.height ?? 0,
      heroPortraitBorderTop: heroPortraitStyle?.borderTopWidth ?? '',
      heroPortraitObjectFit: heroPortraitStyle?.objectFit ?? '',
      heroPortraitImageRendering: heroPortraitStyle?.imageRendering ?? '',
      sectionMarkers: topLevelSections.map(
        (section) =>
          section
            .querySelector('header span')
            ?.textContent?.replace(/\s+/g, ' ')
            .trim() ?? ''
      ),
      sectionLabels: topLevelSections.map(
        (section) =>
          section
            .querySelector('header h2')
            ?.textContent?.replace(/\s+/g, ' ')
            .trim() ?? ''
      ),
      sectionBorders: topLevelSections.map((section) =>
        Number.parseFloat(getComputedStyle(section).borderTopWidth)
      ),
      sectionDividerStyles: topLevelSections.map(
        (section) => getComputedStyle(section).borderTopStyle
      ),
      sectionDividerColors: topLevelSections.map(
        (section) => getComputedStyle(section).borderTopColor
      ),
      sectionDividerImages: topLevelSections.map(
        (section) => getComputedStyle(section).backgroundImage
      ),
      sectionDividerMargins: topLevelSections.map((section) =>
        Number.parseFloat(getComputedStyle(section).marginTop)
      ),
      sectionDividerPaddings: topLevelSections.map((section) =>
        Number.parseFloat(getComputedStyle(section).paddingTop)
      ),
      viewportHeight: window.innerHeight,
      railGutter: rootStyle.getPropertyValue('--rail-gutter').trim(),
      railMarkerSize: rootStyle.getPropertyValue('--rail-marker-size').trim(),
      sectionLabelLefts,
      sectionLefts,
      sectionMarkerLefts: sectionMarkerData.map((marker) => marker.left),
      sectionMarkerRights: sectionMarkerData.map((marker) => marker.right),
      sectionMarkerWidths: sectionMarkerData.map((marker) => marker.width),
      sectionMarkerCenters: sectionMarkerData.map((marker) => marker.center),
      sectionMarkerFontSizes: sectionMarkerData.map(
        (marker) => marker.fontSize
      ),
      sectionMarkerFontWeights: sectionMarkerData.map(
        (marker) => marker.fontWeight
      ),
      sectionMarkerColors: sectionMarkerData.map((marker) => marker.color),
      sectionLabelColors,
      sectionLabelFontWeights,
      sectionContentGaps,
      writingFooterGap,
      sharedRowTitleLefts,
      markerLefts: markerData.map((marker) => marker.left),
      markerWidths: markerData.map((marker) => marker.width),
      markerCenters: markerData.map((marker) => marker.center),
      markerTitleCenterOffsets: markerData.map(
        (marker) => marker.centerY - marker.titleFirstLineCenterY
      ),
      connectorCenters,
      railRowPaddingBottoms,
      experienceTitleLeft: experienceTitle?.getBoundingClientRect().left ?? 0,
      experienceTitleStyle: {
        fontFamily: experienceTitleStyle?.fontFamily ?? '',
        fontSize: Number.parseFloat(experienceTitleStyle?.fontSize ?? '0'),
        letterSpacing: experienceTitleStyle?.letterSpacing ?? '',
        textTransform: experienceTitleStyle?.textTransform ?? '',
      },
      firstGroupLabelLeft: firstGroupLabel?.getBoundingClientRect().left ?? 0,
      firstRailTitleLeft: firstRailTitle?.getBoundingClientRect().left ?? 0,
      experienceLinks,
      experienceTitleRuns,
      advisorLabels,
      advisorGapCount,
      experienceGroupLabelStyles,
      experienceLegendExists: Boolean(
        experienceSection?.querySelector('[data-testid="experience-legend"]')
      ),
      groups,
      experienceDescriptionStyles,
      experienceLineLabels,
      experienceLineLabelsItalic,
      dots,
      writingDots,
      writingNewTags,
      writingPostTags,
      writingMeta,
      writingMetaStyles,
      writingDates,
      writingTitleWeights,
      writingDescriptionCount: writingDescriptions.length,
      writingConnectors,
      writingActionRail,
      publicationDots,
      publicationConnectors,
      publicationActionRail,
      publicationMetaLines,
      publicationMetaLineTexts,
      publicationPaddedSlashCount,
      publicationMetaLineStyles,
      publicationDateStyles,
      publicationAuthors,
      publicationAuthorStyles,
      publicationSelfAuthors,
      publicationSelfAuthorStyles,
      publicationRows,
      publicationTextStacks,
      publicationChildMarginTops,
      hasCoursesSection: Boolean(document.querySelector('#courses')),
      publicationsTitle:
        document
          .querySelector('#publications header h2')
          ?.textContent?.replace(/\s+/g, ' ')
          .trim() ?? '',
      publicationRailExists: Boolean(
        document.querySelector('[data-testid="publication-rail"]')
      ),
      publicationButtonCount: publicationButtons.length,
      publicationOpenDetailCount: publicationOpenDetails.length,
      publicationTitleCount: publicationTitles.length,
      publicationTitleTexts: publicationTitles.map(
        (title) => title.textContent?.replace(/\s+/g, ' ').trim() ?? ''
      ),
      publicationTitleLineChecks,
      publicationTitleSubscripts: publicationTitles.map((title) =>
        [...title.querySelectorAll('sub')].map(
          (subscript) => subscript.textContent ?? ''
        )
      ),
      publicationTitleHrefs: publicationTitles.map((title) =>
        title instanceof HTMLAnchorElement ? title.href : ''
      ),
      publicationTitleDecorations: publicationTitles.map(
        (title) => getComputedStyle(title).textDecorationLine
      ),
      publicationTitleClassName: publicationTitles[0]?.className ?? '',
      mutedToken,
      showMoreActionStyles,
      highlightedLinkClassNames,
      footerBorderTopWidth: footer
        ? Number.parseFloat(getComputedStyle(footer).borderTopWidth)
        : 0,
      footerRight: footer?.getBoundingClientRect().right ?? 0,
      footerUpdateLeft: footerUpdate?.getBoundingClientRect().left ?? 0,
      footerLeft: footer?.getBoundingClientRect().left ?? 0,
      footerQuoteRight: footerQuote?.getBoundingClientRect().right ?? 0,
      footerUpdateText:
        footerUpdate?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      footerQuoteText:
        footerQuote?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      footerText: footer?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      footerUpdateWhiteSpace: footerUpdateStyle?.whiteSpace ?? '',
      footerQuoteTextAlign: footerQuoteStyle?.textAlign ?? '',
    };
  });

  assert.ok(result.mainWidth <= 800, 'main document should stay narrow');
  assert.equal(result.canonicalHref, 'https://imt.sh/');
  assert.equal(result.ogUrl, 'https://imt.sh');
  assert.deepEqual(result.h1Texts, ['Islam Tayeb']);
  assert.ok(result.jsonLdTypes.includes('Person'));
  assert.equal(result.heroVisibleTitleExists, false);
  assert.ok(
    result.heroSemanticTitleClassName.includes('sr-only'),
    'home h1 should stay semantic without rendering the large hero name'
  );
  assert.equal(result.heroPortraitExists, true, 'hero portrait should render');
  assert.ok(result.heroPortraitWidth > 0, 'hero portrait should have width');
  assert.ok(
    Math.abs(result.heroPortraitWidth - result.heroPortraitHeight) <= 1,
    `hero portrait should stay square: ${result.heroPortraitWidth} x ${result.heroPortraitHeight}`
  );
  assert.ok(
    result.heroPortraitWidth <= result.heroContactColumnWidth,
    `hero portrait should stay inside the contact column: ${result.heroPortraitWidth} / ${result.heroContactColumnWidth}`
  );
  assert.equal(result.heroPortraitBorderTop, '0px');
  assert.equal(result.heroPortraitObjectFit, 'cover');
  assert.notEqual(result.heroPortraitImageRendering, 'pixelated');
  assert.equal(result.heroContactIndexGap, 8);
  assert.equal(result.heroContactDetailsGap, 2);
  assert.ok(
    result.heroHeaderContentGap >= 11 && result.heroHeaderContentGap <= 13,
    `About/content gap should match the blog index header gap: ${result.heroHeaderContentGap}`
  );
  assert.ok(
    result.heroContentWidth > 0 &&
      Math.abs(
        result.heroContactColumnWidth / result.heroContentWidth - 0.25
      ) <= 0.02,
    `hero contact column should take 25% of the content row: ${result.heroContactColumnWidth} / ${result.heroContentWidth}`
  );
  assert.equal(result.heroStoryAlignSelf, 'center');
  assert.ok(
    Math.abs(result.heroStoryDividerCenterDelta) <= 1,
    `hero story should be vertically centered against the divider: ${result.heroStoryDividerCenterDelta}`
  );
  assert.ok(
    Math.abs(
      result.heroStoryDividerTopGap - result.heroStoryDividerBottomGap
    ) <= 1,
    `hero story divider gaps should balance: ${result.heroStoryDividerTopGap} / ${result.heroStoryDividerBottomGap}`
  );
  assert.equal(
    result.heroStoryDividerStyle,
    'dotted',
    'hero portrait/text divider should be dotted'
  );
  assert.deepEqual(result.sectionMarkers, ['§1', '§2', '§3', '§4']);
  assert.deepEqual(result.sectionLabels, [
    'About',
    'Experience',
    'Selected Publications',
    'Writing',
  ]);
  assert.deepEqual(
    result.sectionBorders,
    [0, 1, 1, 1],
    'homepage separators should use one simple 1px border'
  );
  assert.deepEqual(
    result.sectionDividerStyles.slice(1),
    ['dotted', 'dotted', 'dotted'],
    'homepage section separators should use dotted borders'
  );
  assert.ok(
    result.sectionDividerColors
      .slice(1)
      .every((color) => color === result.heroStoryDividerColor),
    'homepage section separators should match the hero divider color'
  );
  assert.equal(
    result.sectionDividerImages[0],
    'none',
    'About should not render a section separator above itself'
  );
  assert.ok(
    result.sectionDividerImages.every((image) => image === 'none'),
    'homepage section separators should not use painted background rules'
  );
  assert.deepEqual(
    result.sectionDividerMargins.map((margin) => Math.round(margin)),
    [0, 8, 8, 8],
    'homepage section separators should offset the existing section bottom padding'
  );
  assert.deepEqual(
    result.sectionDividerPaddings.map((padding) => Math.round(padding)),
    [0, 24, 24, 24],
    'homepage section separators should keep balanced 1.5x section spacing'
  );
  const normalSectionGap = result.sectionContentGaps[0];

  assert.ok(
    result.sectionContentGaps.every(
      (gap) => Math.abs(gap - normalSectionGap) <= 1
    ),
    `top-level content gaps should match: ${result.sectionContentGaps.join(', ')}`
  );
  assert.ok(result.writingFooterGap >= 32, 'Writing/footer gap should breathe');
  assert.equal(Number.parseFloat(result.railGutter), 2);
  assert.equal(Number.parseFloat(result.railMarkerSize), 0.75);
  assert.ok(
    result.sectionLabelLefts.every(
      (left) => Math.abs(left - result.sectionLabelLefts[0]) <= 1
    ),
    'top-level section labels should share one content edge'
  );
  assert.ok(
    result.sharedRowTitleLefts.every(
      (left) => Math.abs(left - result.sectionLabelLefts[0]) <= 1
    ),
    'rail row titles should align with top-level section labels'
  );
  assert.ok(
    result.sectionLefts.every(
      (left) => Math.abs(left - result.sectionLefts[0]) <= 1
    ),
    'top-level sections should share one left edge'
  );
  assert.ok(
    result.sectionMarkerLefts.every(
      (left) => Math.abs(left - result.sectionLefts[0]) <= 1
    ),
    'section markers should touch the section left edge'
  );
  assert.ok(
    result.markerLefts.every(
      (left) => Math.abs(left - result.sectionLefts[0]) <= 1
    ),
    'rail markers should touch the section left edge'
  );
  assert.ok(
    result.sectionMarkerRights.every(
      (right) => result.sectionLabelLefts[0] - right >= 8
    ),
    'section markers should remain in the rail gutter before content text'
  );
  assert.ok(
    result.sectionMarkerFontSizes.every((size) => Math.round(size) === 16),
    'section markers should follow the promoted 16px section label size'
  );
  assert.ok(
    result.sectionMarkerFontWeights.every((weight) => weight >= 700) &&
      result.sectionLabelFontWeights.every((weight) => weight >= 700),
    'section headers should use bold mono labels'
  );
  assert.ok(
    result.sectionMarkerWidths.every((width) => Math.round(width) === 14),
    'section marker text should have a fixed 14px width'
  );
  assert.deepEqual(
    result.sectionLabelColors,
    result.sectionMarkerColors,
    'section title labels should use their section accent color'
  );
  assert.ok(
    result.markerWidths.every((width) => Math.round(width) === 12),
    'rail markers should match the shared 12px marker size'
  );
  const expectedAxis = result.sectionLefts[0] + result.markerWidths[0] / 2;

  assert.ok(
    result.markerCenters.every(
      (center) => Math.abs(center - expectedAxis) <= 1
    ),
    'rail marker centers should share the left-flush rail axis'
  );
  assert.ok(
    result.markerTitleCenterOffsets.every((offset) => Math.abs(offset) <= 1.25),
    'rail markers should be vertically centered against the first title line'
  );
  assert.ok(
    result.connectorCenters.every(
      (center) => Math.abs(center - expectedAxis) <= 1
    ),
    'rail connectors should share the left-flush rail axis'
  );
  assert.equal(result.hasCoursesSection, false, 'Courses should stay hidden');
  assert.ok(
    !result.heroContactText.includes('location') &&
      !result.heroContactText.includes('hometown'),
    'hero metadata should only keep contact links'
  );
  assert.deepEqual(result.heroContactLabels, [
    'Email',
    'LinkedIn',
    'GitHub',
    'X',
    'Scholar',
  ]);
  for (const copy of expectedHeroParagraphs) {
    assert.ok(result.bodyText.includes(copy), `hero should include: ${copy}`);
  }
  assert.equal(result.dukeLinkHref, 'https://www.duke.edu/');
  assert.ok(
    !result.bodyText.includes('Finding the Right Answer Was Never the Point'),
    'external writing should stay off the home writing preview'
  );
  assert.equal(
    result.mainText.includes(profile.email),
    expectedHeroParagraphs.some((copy) => copy.includes(profile.email))
  );
  assert.ok(!result.mainText.includes('islam.tayeb@duke.edu'));
  for (const label of ['experience', 'publications', 'courses', 'writing']) {
    assert.ok(
      !result.headerText.includes(label),
      `header should not include ${label} shortcut`
    );
  }
  assert.equal(
    result.themeToggleText,
    'light',
    'theme toggle should show only the current theme name as text'
  );
  assert.ok(
    !result.themeToggleClassName.includes('hover:') &&
      !result.themeToggleClassName.includes('active:'),
    'theme toggle should not have hover or active visual classes'
  );
  assert.deepEqual(
    result.wordmarkLinkDisplays,
    ['flex', 'flex'],
    'wordmark links should preserve their icon/text flex layout'
  );
  assert.deepEqual(
    result.wordmarkLinkTextStyles.map((item: { text: string }) => item.text),
    ['islam', 'blog'],
    'wordmark should render only the label text through the ROYB underline primitive'
  );
  assert.ok(
    result.wordmarkLinkTextStyles.every(
      (item: { className: string; textDecorationLine: string }) =>
        item.className.includes('royb-link') &&
        item.className.includes('royb-link-highlight') &&
        item.className.includes('royb-link-fragment') &&
        item.textDecorationLine.includes('underline')
    ),
    'wordmark labels should share the ROYB underline treatment while icons stay outside it'
  );
  assert.equal(
    result.headerPaddingLeft + result.headerPaddingRight,
    0,
    'navbar should not add left/right padding'
  );
  assert.ok(
    Math.abs(result.experienceTitleLeft - result.firstGroupLabelLeft) <= 1,
    'Experience title should align with group labels'
  );
  assert.ok(
    Math.abs(result.experienceTitleLeft - result.firstRailTitleLeft) <= 1,
    'Experience title should align with row titles'
  );
  assert.deepEqual(
    result.experienceGroupLabelStyles.map(
      (label: { text: string }) => label.text
    ),
    ['Research', 'Engineering', 'Teaching']
  );
  assert.ok(
    result.experienceGroupLabelStyles.every(
      (label: {
        nameStyle: {
          fontFamily: string;
          fontSize: number;
          textTransform: string;
          letterSpacing: string;
        };
      }) =>
        label.nameStyle.fontFamily === result.experienceTitleStyle.fontFamily &&
        label.nameStyle.fontSize === 14 &&
        label.nameStyle.fontSize < result.experienceTitleStyle.fontSize &&
        label.nameStyle.textTransform ===
          result.experienceTitleStyle.textTransform &&
        Math.abs(
          Number.parseFloat(label.nameStyle.letterSpacing) -
            label.nameStyle.fontSize * 0.2
        ) <= 0.1
    ),
    'experience group label names should use uppercase letter-spaced subheading typography'
  );
  assert.ok(
    result.experienceGroupLabelStyles.every(
      (label: { text: string }) => !/\(\d+\)/.test(label.text)
    ),
    'experience group labels should not show a role count'
  );
  assert.ok(
    result.experienceGroupLabelStyles.every(
      (label: { textDecorationLine: string }) =>
        label.textDecorationLine.includes('underline')
    ),
    'experience group labels should be underlined to read as clickable'
  );
  assert.ok(
    result.experienceGroupLabelStyles.every(
      (label: { className: string }) =>
        label.className.includes('royb-link') &&
        label.className.includes('royb-link-highlight') &&
        !label.className.includes('royb-link-plain') &&
        label.className.includes('section-color-o') &&
        label.className.includes('w-fit') &&
        label.className.includes('justify-self-start')
    ),
    'experience group labels should use the shared ROYB link primitive'
  );
  assert.ok(
    result.experienceGroupLabelStyles.every(
      (label: {
        justifySelf: string;
        width: number;
        toggleWidth: number;
        left: number;
        toggleLeft: number;
      }) =>
        label.justifySelf.endsWith('start') &&
        label.width > 0 &&
        label.toggleWidth > 0 &&
        label.toggleWidth > label.width &&
        label.toggleWidth - label.width >= 28 &&
        label.toggleWidth - label.width <= 40 &&
        Math.abs(label.left - label.toggleLeft - 32) <= 1
    ),
    'experience group toggle hover boxes should include only the gutter and label'
  );

  const research = result.groups.find((group) => group.kind === 'research');
  const engineering = result.groups.find(
    (group) => group.kind === 'engineering'
  );
  const teaching = result.groups.find((group) => group.kind === 'teaching');

  assert.equal(research?.expanded, 'true', 'research should default open');
  assert.equal(research?.rows, 3, 'research should show all 3 rows');
  assert.ok(research?.text.includes('Research'));
  assert.equal(research?.hasShowMore, false, 'research should not show more');
  assert.ok(!research?.text.includes('Matthew Lentz'));
  assert.ok(research?.text.includes('Philip Romero'));
  assert.ok(research?.text.includes('Navid NaderiAlizadeh'));
  assert.ok(research?.text.includes('Mahmoud Abdelnaby'));
  assert.ok(
    result.advisorLabels.some(
      (label) =>
        label.text === 'Philip Romero' &&
        label.color === result.mutedToken &&
        label.fontFamily === result.readingFontFamily &&
        label.fontSize === 16 &&
        label.fontWeight === 400 &&
        label.marginLeft === 0 &&
        label.paddingLeft === 0 &&
        label.textTransform === 'none' &&
        label.letterSpacing === 'normal'
    ),
    'advisor labels should use the muted normal-weight Open Sans reading style without spacing hacks'
  );
  assert.ok(
    result.advisorGapCount === 0 &&
      result.experienceLinks.some(
        (link) =>
          link.text === 'Duke University Philip Romero' &&
          link.rawText === 'Duke University Philip Romero' &&
          link.whiteSpace === 'break-spaces'
      ),
    'advisor organization and PI labels should be one inline underlined text run with one breakable space'
  );
  assert.ok(
    !research?.text.includes('Duke University /') &&
      !teaching?.text.includes('Operating Systems /'),
    'advisor labels should sit after the organization without slash separators'
  );
  assert.ok(!research?.text.includes('incoming Aug 2026'));
  assert.ok(research?.text.includes('Aug 2025 - Present'));
  assert.ok(!research?.text.includes('Aug 2025 - present'));
  assert.ok(
    research?.text.includes(
      'Collabs & Grants: Microsoft Research + Anthropic (AI for Science Program)'
    ),
    'the Romero row should carry a labeled collabs line'
  );
  assert.ok(
    result.experienceLinks.some(
      (link) =>
        link.text === 'Microsoft Research' &&
        link.href === 'https://www.microsoft.com/en-us/research/people/kevyan/'
    ),
    'Microsoft Research should link to Kevin Yang'
  );
  assert.ok(
    research?.text.includes('Outputs: AI Scientist Summer Workshop (Poster)'),
    'the Romero row should carry a labeled outputs line for the poster'
  );
  assert.ok(
    result.experienceLinks.some(
      (link) =>
        link.text === 'Anthropic (AI for Science Program)' &&
        link.href === 'https://www.anthropic.com/news/ai-for-science-program'
    ),
    'the whole Anthropic run should link to the program page'
  );
  assert.ok(
    result.experienceLinks.some(
      (link) =>
        link.text === 'AI Scientist Summer Workshop' &&
        link.href === 'https://ai-scientist-workshop.github.io/'
    ),
    'the workshop name should link to the workshop site'
  );
  assert.ok(
    research?.text.includes('Outputs: Preprint') &&
      result.experienceLinks.some(
        (link) =>
          link.text === 'Preprint' &&
          link.href === 'https://doi.org/10.13140/RG.2.2.11182.98880'
      ),
    'the Navid row should carry a linked preprint line'
  );
  assert.ok(
    research?.text.includes('Collabs & Grants: Saudi Aramco') &&
      research?.text.includes(
        'Outputs: 3 publications @ Q1 journals in applied ML, organic synthesis, and a review'
      ) &&
      ['applied ML', 'organic synthesis', 'a review'].every((text) =>
        result.experienceLinks.some((link) => link.text === text)
      ),
    'the KFUPM row should carry a line linking each of the three papers'
  );
  assert.ok(!research?.text.includes('% Microsoft Research'));
  assert.ok(!result.bodyText.includes('Lentz Lab'));
  assert.ok(!result.bodyText.includes('Romero Lab'));
  assert.ok(!result.bodyText.includes('PI '));

  assert.equal(engineering?.expanded, 'false');
  assert.equal(engineering?.rows, 0, 'engineering should default collapsed');
  assert.equal(
    engineering?.hasShowMore,
    false,
    'engineering should not show more'
  );
  assert.deepEqual(
    result.experienceLineLabels,
    [
      'Collabs & Grants:',
      'Outputs:',
      'Outputs:',
      'Collabs & Grants:',
      'Outputs:',
    ],
    'research description lines should carry lead-in labels'
  );
  assert.ok(
    result.experienceLineLabelsItalic,
    'description line labels should render italic'
  );
  assert.equal(teaching?.expanded, 'false');
  assert.equal(teaching?.rows, 0, 'teaching should default collapsed');
  assert.equal(teaching?.hasShowMore, false, 'teaching should not show more');
  assert.equal(
    teaching?.togglePaddingBottom,
    0,
    'final closed Teaching toggle should not add bottom whitespace'
  );
  assert.ok(teaching?.text.includes('Teaching'));
  assert.ok(
    (teaching?.marginBottom ?? 0) < (research?.marginBottom ?? 0),
    'closed groups should use tighter vertical spacing than open groups'
  );

  const metadataStyle = {
    color: result.bodyColor,
    fontFamily: result.readingFontFamily,
    fontSize: 16,
    fontWeight: 400,
    textTransform: 'none',
  };
  const matchesMetadataStyle = (style: {
    color: string;
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    textTransform: string;
  }) =>
    style.color === metadataStyle.color &&
    style.fontFamily === metadataStyle.fontFamily &&
    style.fontSize === metadataStyle.fontSize &&
    style.fontWeight === metadataStyle.fontWeight &&
    style.textTransform === metadataStyle.textTransform;

  assert.ok(
    result.experienceDescriptionStyles.length >= 1 &&
      result.experienceDescriptionStyles.every(
        (style) =>
          style.color === result.bodyColor &&
          style.fontFamily === result.readingFontFamily &&
          style.fontSize === 16 &&
          style.textTransform === 'none'
      ),
    'experience descriptions should use the promoted readable body style'
  );

  const incomingDots = result.dots.filter((dot) => dot.state === 'incoming');
  const presentDots = result.dots.filter((dot) => dot.state === 'present');
  const endedDots = result.dots.filter((dot) => dot.state === 'ended');

  const experienceDots = [...incomingDots, ...presentDots, ...endedDots];

  assert.ok(
    experienceDots.length > 0 && experienceDots.every((dot) => dot.hasMark),
    'every experience row should carry an org mark'
  );
  assert.ok(
    experienceDots.every(
      (dot) =>
        dot.border === 0 &&
        dot.backgroundColor === 'rgba(0, 0, 0, 0)' &&
        Math.abs(dot.markCenterOffsetX) <= 0.75 &&
        Math.abs(dot.markCenterOffsetY) <= 0.75 &&
        dot.markHeight >= 10 &&
        dot.markHeight <= 20
    ),
    'org marks should sit centered on the dot position, weighted around the 12px dot, with no box behind them'
  );
  assert.ok(
    incomingDots.every((dot) => dot.className.includes('text-roy-o')),
    'incoming org marks should be solid orange, not hollow'
  );
  assert.ok(presentDots.every((dot) => dot.className.includes('text-roy-o')));
  assert.ok(
    endedDots.every((dot) => dot.className.includes('text-foreground/75'))
  );
  assert.equal(result.experienceLegendExists, false);
  assert.ok(
    result.writingDots.every((dot) => dot.includes('bg-foreground/75')),
    'writing dots should all be neutral with no New highlight'
  );
  assert.deepEqual(result.writingNewTags, []);
  assert.deepEqual(
    result.writingPostTags.map((tag) => [tag.kind, tag.label]),
    [['technical', 'technical']]
  );
  assert.ok(
    result.writingPostTags.every(
      (tag) =>
        tag.borderStyle === 'dotted' &&
        tag.borderRadius === 0 &&
        tag.fontFamily.includes('monospace') &&
        tag.textTransform === 'uppercase' &&
        tag.backgroundColor !== 'rgba(0, 0, 0, 0)'
    ),
    'post tags should render as square, dotted, filled mono specimens'
  );
  assert.ok(
    result.writingMeta.every(
      (meta) =>
        /^\d+(?:\.\d+)?K? words \(\d+ mins\)$/.test(meta) &&
        !/\b\d+(?:\.\d+)?k\b/.test(meta)
    ),
    'home writing metadata should use uppercase-K word counts and parenthesized mins'
  );
  assert.ok(
    result.writingMetaStyles.every(matchesMetadataStyle),
    'writing word/time metadata should use readable body-scale metadata'
  );
  assert.ok(
    result.writingTitleWeights.every((weight) => weight === 600),
    'home writing preview titles should render at font-weight 600'
  );
  assert.ok(
    result.writingDates.every((date) => /^[A-Z][a-z]{2} \d{4}$/.test(date)),
    'home writing dates should use month-year only'
  );
  assert.equal(
    result.writingDescriptionCount,
    0,
    'writing preview should not render post descriptions'
  );
  assert.ok(
    result.writingConnectors
      .slice(0, -1)
      .every((connector) => connector.backgroundImage === 'none'),
    'writing rail should use solid connectors between visible rows'
  );
  assert.match(
    result.writingConnectors.at(-1)?.backgroundImage ?? '',
    /repeating-linear-gradient/,
    'writing rail should continue with a dashed connector after the final visible row'
  );
  assert.ok(
    result.writingActionRail.rowExists,
    'writing see-more action should be a rail row'
  );
  assert.equal(
    result.writingActionRail.connectorBackgroundImage,
    '',
    'writing see-more action should not draw a rail connector'
  );
  assert.equal(
    result.writingActionRail.paddingTop,
    0,
    'writing see-more action should not add extra top padding'
  );
  assert.ok(
    Math.abs(result.writingActionRail.linkLeft - result.sectionLabelLefts[0]) <=
      1,
    'writing see-more action should align with the rail text edge'
  );
  assert.ok(
    result.railRowPaddingBottoms.length > 0 &&
      result.railRowPaddingBottoms.every((padding) => padding === 8),
    'experience, publication, and writing rail rows should use pb-2 between rows'
  );

  for (const term of [
    'PyTorch',
    'FastAPI',
    'Next.js',
    'tRPC',
    'Python',
    'Research Assistant',
    'Software Engineer Intern',
  ]) {
    assert.ok(!result.bodyText.includes(term), `${term} should not render`);
  }

  assert.equal(result.publicationsTitle, 'Selected Publications');
  assert.ok(
    result.publicationRailExists,
    'publications should use rail layout'
  );
  assert.equal(
    result.publicationButtonCount,
    0,
    'publication rows should not render disclosure buttons'
  );
  assert.equal(
    result.publicationOpenDetailCount,
    0,
    'publication rows should not render explanatory detail paragraphs'
  );
  assert.ok(
    result.publicationDots.every((dot) => dot.includes('bg-foreground/75')),
    'publication rail markers should be neutral'
  );
  assert.ok(
    result.publicationConnectors
      .slice(0, -1)
      .every((connector) => connector.backgroundImage === 'none'),
    'publication rail should use solid connectors between visible rows'
  );
  assert.match(
    result.publicationConnectors.at(-1)?.backgroundImage ?? '',
    /repeating-linear-gradient/,
    'publication rail should continue with a dashed connector after the final visible row'
  );
  assert.ok(
    result.publicationActionRail.rowExists,
    'publication see-more action should be a rail row'
  );
  assert.equal(
    result.publicationActionRail.connectorBackgroundImage,
    '',
    'publication see-more action should not draw a rail connector'
  );
  assert.equal(
    result.publicationActionRail.paddingTop,
    0,
    'publication see-more action should not add extra top padding'
  );
  assert.ok(
    Math.abs(
      result.publicationActionRail.linkLeft - result.sectionLabelLefts[0]
    ) <= 1,
    'publication see-more action should align with the rail text edge'
  );
  assert.ok(
    result.publicationMetaLines.every(
      (className) =>
        className.includes('text-muted-foreground') &&
        className.includes('font-normal') &&
        !className.includes('font-mono') &&
        !className.includes('uppercase') &&
        !className.includes('text-roy-y')
    ),
    'publication type/venue metadata should use muted date color'
  );
  assert.ok(
    result.publicationAuthorStyles.every(matchesMetadataStyle),
    'publication authors should use readable body-scale metadata'
  );
  assert.ok(
    result.publicationMetaLineStyles.every(
      (style) =>
        style.color === result.mutedToken &&
        style.fontFamily === metadataStyle.fontFamily &&
        style.fontSize === metadataStyle.fontSize &&
        style.fontWeight === metadataStyle.fontWeight &&
        style.textTransform === metadataStyle.textTransform
    ),
    'publication type and journal should match publication date color'
  );
  assert.deepEqual(result.publicationMetaLineTexts, [
    'Research Article / Journal of Environmental Chemical Engineering',
    'Pre-print',
    'Research Article / Journal of CO2 Utilization',
  ]);
  assert.equal(
    result.publicationPaddedSlashCount,
    0,
    'publication type/venue separator should be plain spaced text, not a padded slash element'
  );
  assert.ok(
    result.publicationDateStyles.every((style) => style.fontSize === 14),
    'publication dates should match rail meta font size'
  );
  assert.ok(
    result.publicationAuthors.every((authors) =>
      authors.includes('Islam Tayeb')
    )
  );
  assert.equal(
    result.publicationTitleCount,
    result.publicationAuthors.length,
    'each publication title should be the row link'
  );
  assert.ok(
    result.publicationTitleHrefs.every((href) => href.startsWith('https://')),
    'publication titles should link externally'
  );
  assert.ok(
    result.publicationTitleDecorations.every((decoration) =>
      decoration.includes('underline')
    ),
    'publication title links should stay visibly underlined'
  );
  assert.deepEqual(result.publicationTitleTexts, [
    'Machine learning for predicting and optimizing the CO2 uptake in porous organic polymers',
    'Primal dual continual learning for robust antibody design',
    'Post-synthetic modification of UiO-66 analogue metal-organic framework as potential solid sorbent for direct air capture',
  ]);
  assert.equal(
    result.publicationTitleLineChecks[0]?.organicPolymersSameLine,
    true,
    'first publication title should keep organic polymers on one rendered line'
  );
  assert.deepEqual(result.publicationTitleSubscripts, [['2'], [], []]);
  assert.equal(
    result.publicationSelfAuthors.length,
    result.publicationAuthors.length,
    'each publication author row should emphasize Islam Tayeb'
  );
  assert.ok(
    result.publicationSelfAuthors.every((author) => author === 'Islam Tayeb'),
    'Islam Tayeb should be emphasized in every publication author row'
  );
  assert.ok(
    result.publicationSelfAuthorStyles.every(
      (style: { className: string; fontStyle: string; fontWeight: number }) =>
        style.className.includes('font-semibold') &&
        style.className.includes('italic') &&
        style.fontStyle === 'italic' &&
        style.fontWeight === 600
    ),
    'Islam Tayeb author spans should render semibold italic'
  );
  assert.ok(
    !result.publicationTitleClassName.includes('text-balance'),
    'publication titles should avoid balance wrappers that create awkward short final lines'
  );
  assert.ok(
    result.publicationRows.every((row) => {
      const authorIndex = row.indexOf('publication-authors');
      const metaIndex = row.indexOf('publication-meta-line');

      return authorIndex >= 0 && metaIndex > authorIndex;
    }),
    'publication type and journal should render under the authors'
  );
  assert.ok(
    result.publicationTextStacks.every(
      (stack: {
        className: string;
        display: string;
        flexDirection: string;
        rowGap: number;
      }) =>
        stack.className.includes('gap-0.5') &&
        stack.display === 'flex' &&
        stack.flexDirection === 'column' &&
        stack.rowGap === 2
    ),
    'publication title, authors, and metadata should use a gap-0.5 vertical stack'
  );
  assert.ok(
    result.publicationChildMarginTops.every(
      (marginTop: number) => marginTop === 0
    ),
    'publication author and metadata rows should not add top margins'
  );
  assert.ok(
    result.publicationDateStyles.every(
      (style) => style.textTransform === 'none'
    ),
    'publication dates should keep natural month casing'
  );
  assert.ok(
    result.publicationDateStyles.every((style) => {
      const tracking =
        style.letterSpacing === 'normal'
          ? 0
          : Number.parseFloat(style.letterSpacing);

      return Number.isFinite(tracking) && tracking < 1;
    }),
    'publication dates should not use wide tracking'
  );
  assert.ok(
    result.showMoreActionStyles.every(
      (style) => style.color === result.mutedToken
    ),
    'show more actions should use the same muted grey as metadata labels'
  );
  assert.ok(
    result.highlightedLinkClassNames.every((className) =>
      className.includes('royb-link-fragment')
    ),
    'home highlighted links should share the fragment-aware underline primitive'
  );
  assert.ok(
    result.showMoreActionStyles.every(
      (style) =>
        style.fontVariantCaps === 'normal' &&
        style.fontSize === 14 &&
        style.textTransform === 'none'
    ),
    'show more actions should stay date-sized normal text without CSS text transforms'
  );
  assert.ok(
    result.showMoreActionStyles.every(
      (style) => Math.abs(style.left - result.sectionLabelLefts[0]) <= 1
    ),
    'show more actions should align with the rail text edge'
  );
  assert.equal(result.footerBorderTopWidth, 1);
  assert.ok(result.bodyText.includes('show more on Scholar...'));
  assert.ok(result.bodyText.includes('show more on blog...'));
  assert.equal(result.footerUpdateText, 'Last updated Oct 4, 2026');
  assert.ok(result.footerQuoteText.includes('plz enjoy game'));
  assert.ok(result.footerQuoteText.includes('rrtyui'));
  assert.ok(!result.footerText.includes('Links:'));
  assert.equal(result.footerUpdateWhiteSpace, 'nowrap');
  assert.equal(result.footerQuoteTextAlign, 'right');
  assert.ok(
    Math.abs(result.footerLeft - result.footerUpdateLeft) <= 1,
    'footer update text should sit at the left edge'
  );
  assert.ok(
    Math.abs(result.footerRight - result.footerQuoteRight) <= 1,
    'footer quote should sit at the right edge'
  );
}

async function assertPostTagTypographyAndAlignment(page: Page, label: string) {
  const result = await page.evaluate(() => {
    const blueProbe = document.createElement('span');

    blueProbe.style.color = 'var(--roy-b)';
    document.body.append(blueProbe);
    const blue = getComputedStyle(blueProbe).color;
    blueProbe.remove();

    const groups = [
      ...document.querySelectorAll<HTMLElement>('[data-post-tags]'),
    ].map((group) => {
      const titleLink = group.parentElement?.querySelector('a');
      const titleRects = titleLink
        ? [...titleLink.getClientRects()].filter(
            (rect) => rect.width > 0 && rect.height > 0
          )
        : [];
      const titleLine = titleRects.at(-1);
      const groupRect = group.getBoundingClientRect();

      const titleLeft = titleRects.length
        ? Math.min(...titleRects.map((rect) => rect.left))
        : 0;

      return {
        verticalAlign: getComputedStyle(group).verticalAlign,
        // A tag that does not fit beside the title wraps to its own line,
        // starting at the title's left edge.
        wrapped:
          !!titleLine &&
          groupRect.top >= titleLine.bottom - 1 &&
          Math.abs(
            groupRect.left -
              Number.parseFloat(getComputedStyle(group).marginLeft) -
              titleLeft
          ) <= 1,
        offset: titleLine
          ? groupRect.top +
            groupRect.height / 2 -
            (titleLine.top + titleLine.height / 2)
          : Number.POSITIVE_INFINITY,
      };
    });
    const tags = [
      ...document.querySelectorAll<HTMLElement>('[data-post-tag]'),
    ].map((tag) => {
      const style = getComputedStyle(tag);

      return {
        kind: tag.dataset.postTag ?? '',
        color: style.color,
        fontWeight: Number.parseInt(style.fontWeight, 10),
      };
    });

    return { blue, groups, tags };
  });

  assert.ok(result.groups.length > 0, `${label} should render post tag groups`);
  assert.ok(
    result.groups.every(({ verticalAlign }) => verticalAlign === 'middle'),
    `${label} post tag groups should use middle vertical alignment`
  );
  assert.ok(
    result.groups.every(
      ({ offset, wrapped }) => wrapped || Math.abs(offset) <= 2
    ),
    `${label} tag centers should align with their title line: ${result.groups
      .map(({ offset }) => offset.toFixed(2))
      .join(', ')}`
  );
  assert.ok(
    result.tags.every(({ fontWeight }) => fontWeight === 400),
    `${label} tag labels should use regular weight`
  );
  assert.ok(
    result.tags
      .filter(({ kind }) => kind === 'new')
      .every(({ color }) => color === result.blue),
    `${label} NEW tag text should use the blue token`
  );
}

async function assertMobileHeroContactUnderStory(page: Page) {
  const result = await page.evaluate(() => {
    const visibleTitle = document.querySelector<HTMLElement>(
      '[data-testid="hero-title"], [data-testid="hero-title-mobile"]'
    );
    const heroSection = document.querySelector('[data-testid="hero-section"]');
    const heroHeader = heroSection?.querySelector<HTMLElement>('header');
    const heroStory = heroSection?.querySelector<HTMLElement>(
      '[data-testid="hero-story"]'
    );
    const heroContactColumn = heroSection?.querySelector<HTMLElement>(
      '[data-testid="hero-contact-column"]'
    );
    const heroContactMobile = heroSection?.querySelector<HTMLElement>(
      '[data-testid="hero-contact-mobile"]'
    );
    const heroPortrait = document.querySelector<HTMLElement>(
      '[data-testid="hero-portrait"]'
    );
    const heroContactDetails = heroContactMobile?.querySelector<HTMLElement>(
      '[data-testid="hero-contact-details"]'
    );
    const heroHeaderRect = heroHeader?.getBoundingClientRect();
    const heroStoryRect = heroStory?.getBoundingClientRect();
    const heroContactColumnRect = heroContactColumn?.getBoundingClientRect();
    const heroContactMobileRect = heroContactMobile?.getBoundingClientRect();
    const portraitRect = heroPortrait?.getBoundingClientRect();
    const contactDetailsRect = heroContactDetails?.getBoundingClientRect();

    return {
      visibleTitleExists: Boolean(visibleTitle),
      headerStoryGap: (heroStoryRect?.top ?? 0) - (heroHeaderRect?.bottom ?? 0),
      storyContactGap:
        (heroContactMobileRect?.top ?? 0) - (heroStoryRect?.bottom ?? 0),
      storyContactLeftDelta:
        (heroContactMobileRect?.left ?? 0) - (heroStoryRect?.left ?? 0),
      desktopContactDisplay: heroContactColumn
        ? getComputedStyle(heroContactColumn).display
        : '',
      desktopContactHeight: heroContactColumnRect?.height ?? 0,
      mobileContactDisplay: heroContactMobile
        ? getComputedStyle(heroContactMobile).display
        : '',
      exists: Boolean(heroPortrait),
      display: heroPortrait ? getComputedStyle(heroPortrait).display : '',
      width: portraitRect?.width ?? 0,
      height: portraitRect?.height ?? 0,
      contactTopGap:
        (contactDetailsRect?.top ?? 0) - (heroContactMobileRect?.top ?? 0),
      contactLabel:
        heroContactDetails
          ?.querySelector('span')
          ?.textContent?.replace(/\s+/g, ' ')
          .trim() ?? '',
      contactLinks: [...(heroContactDetails?.querySelectorAll('a') ?? [])].map(
        (link) => link.textContent?.trim() ?? ''
      ),
    };
  });

  assert.equal(result.visibleTitleExists, false);
  assert.ok(
    result.headerStoryGap >= 11 && result.headerStoryGap <= 13,
    `mobile story should sit directly under the About header: ${result.headerStoryGap}`
  );
  assert.ok(
    result.storyContactGap >= 11 && result.storyContactGap <= 13,
    `mobile contact should sit directly under the hero story: ${result.storyContactGap}`
  );
  assert.ok(
    Math.abs(result.storyContactLeftDelta) <= 1,
    `mobile contact should align with the hero story: ${result.storyContactLeftDelta}`
  );
  assert.equal(result.desktopContactDisplay, 'none');
  assert.equal(result.desktopContactHeight, 0);
  assert.equal(result.mobileContactDisplay, 'block');
  assert.equal(result.exists, true);
  assert.equal(result.display, 'none');
  assert.equal(result.width, 0);
  assert.equal(result.height, 0);
  assert.ok(
    Math.abs(result.contactTopGap) <= 1,
    `mobile contact should start without a hidden portrait gap: ${result.contactTopGap}`
  );
  assert.equal(result.contactLabel, 'contact');
  assert.deepEqual(result.contactLinks, [
    'Email',
    'LinkedIn',
    'GitHub',
    'X',
    'Scholar',
  ]);
}

async function assertMobileRailDescriptionsWrap(page: Page) {
  const result = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        '#experience p[data-rail-description="true"]'
      ),
    ].map((description) => {
      const style = getComputedStyle(description);
      const rect = description.getBoundingClientRect();

      return {
        text: description.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        whiteSpace: style.whiteSpace,
        overflowX: style.overflowX,
        textOverflow: style.textOverflow,
        height: rect.height,
        lineHeight: Number.parseFloat(style.lineHeight),
      };
    })
  );

  assert.ok(result.length > 0, 'mobile experience descriptions should render');
  assert.ok(
    result.every(
      (description) =>
        description.whiteSpace === 'normal' &&
        description.overflowX === 'visible' &&
        description.textOverflow === 'clip'
    ),
    'mobile experience descriptions should use normal wrapping instead of truncation'
  );
  assert.ok(
    result.some(
      (description) => description.height > description.lineHeight * 1.5
    ),
    'at least one mobile experience description should wrap across lines'
  );
}

async function assertMobileRailDateLayout({
  page,
  selector,
  label,
  singleLineDates = [],
  requireActualWrap = false,
}: {
  page: Page;
  selector: string;
  label: string;
  singleLineDates?: string[];
  requireActualWrap?: boolean;
}) {
  const result = await page.evaluate((selector) => {
    const dates = [...document.querySelectorAll<HTMLElement>(selector)].map(
      (date) => {
        const style = getComputedStyle(date);
        const rect = date.getBoundingClientRect();

        return {
          text: date.textContent?.replace(/\s+/g, ' ').trim() ?? '',
          whiteSpace: style.whiteSpace,
          minWidth: style.minWidth,
          maxWidth: style.maxWidth,
          height: rect.height,
          lineHeight: Number.parseFloat(style.lineHeight),
        };
      }
    );

    return {
      dates,
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
    };
  }, selector);

  assert.ok(result.dates.length > 0, `${label} should render`);
  assert.ok(
    result.dates.every(
      (date) =>
        date.whiteSpace === 'normal' &&
        date.minWidth !== '0px' &&
        date.maxWidth !== 'none'
    ),
    `${label} should use balanced mobile metadata sizing`
  );
  assert.ok(
    result.documentScrollWidth <= result.documentClientWidth + 1,
    `${label} should not cause horizontal overflow: ${result.documentScrollWidth} / ${result.documentClientWidth}`
  );

  for (const text of singleLineDates) {
    const date = result.dates.find((candidate) => candidate.text === text);

    assert.ok(date, `${label} should include ${text}`);
    assert.ok(
      date.lineHeight > 0 && date.height <= date.lineHeight * 1.5,
      `${label} should keep ${text} on one line when space is available`
    );
  }

  if (requireActualWrap) {
    assert.ok(
      result.dates.some(
        (date) => date.lineHeight > 0 && date.height > date.lineHeight * 1.5
      ),
      `${label} should allow at least one long date to wrap`
    );
  }
}

async function assertMobileFooterAlignment(page: Page) {
  const result = await page.evaluate(() => {
    const footer = document.querySelector<HTMLElement>(
      '[data-testid="site-footer"]'
    );
    const update = footer?.querySelector<HTMLElement>(
      '[data-testid="site-footer-updated"]'
    );
    const quote = footer?.querySelector<HTMLElement>(
      '[data-testid="site-footer-quote"]'
    );
    const updateStyle = update ? getComputedStyle(update) : null;
    const quoteStyle = quote ? getComputedStyle(quote) : null;
    const footerRect = footer?.getBoundingClientRect();
    const updateRect = update?.getBoundingClientRect();

    return {
      footerClientWidth: footer?.clientWidth ?? 0,
      footerScrollWidth: footer?.scrollWidth ?? 0,
      footerVisibleText: footer?.innerText?.replace(/\s+/g, ' ').trim() ?? '',
      footerLeft: footerRect?.left ?? 0,
      updateLeft: updateRect?.left ?? 0,
      updateHeight: updateRect?.height ?? 0,
      updateText: update?.innerText?.replace(/\s+/g, ' ').trim() ?? '',
      updateFontSize: Number.parseFloat(updateStyle?.fontSize ?? '0'),
      updateLineHeight: Number.parseFloat(updateStyle?.lineHeight ?? '0'),
      updateWhiteSpace: updateStyle?.whiteSpace ?? '',
      quoteDisplay: quoteStyle?.display ?? '',
    };
  });

  assert.ok(
    result.footerScrollWidth <= result.footerClientWidth + 1,
    `mobile footer should not overflow horizontally: ${result.footerScrollWidth} / ${result.footerClientWidth}`
  );
  assert.equal(result.updateWhiteSpace, 'nowrap');
  assert.equal(result.updateText, 'Last updated Oct 4, 2026');
  assert.equal(result.updateFontSize, 14);
  assert.equal(result.footerVisibleText, 'Last updated Oct 4, 2026');
  assert.equal(result.quoteDisplay, 'none');
  assert.ok(!result.footerVisibleText.includes('plz enjoy game'));
  assert.ok(!result.footerVisibleText.includes('rrtyui'));
  assert.ok(
    Math.abs(result.footerLeft - result.updateLeft) <= 1,
    'mobile footer update should stay on the left edge'
  );
  assert.ok(
    result.updateHeight <= result.updateLineHeight * 1.25,
    `mobile footer update should stay one line: ${result.updateHeight} / ${result.updateLineHeight}`
  );
}

async function assertWrappedInlineHighlight({
  page,
  selector,
  label,
  colorVariable,
}: {
  page: Page;
  selector: string;
  label: string;
  colorVariable: string;
}) {
  const titleLink = page.locator(selector).first();

  assert.ok((await titleLink.count()) > 0, `${label} should render`);
  await titleLink.hover();

  const result = await page.evaluate(
    ({ selector, colorVariable }) => {
      const link = document.querySelector<HTMLElement>(selector);
      const style = link ? getComputedStyle(link) : null;
      const probe = document.createElement('span');

      probe.style.color = colorVariable;
      document.body.append(probe);

      const expectedColor = getComputedStyle(probe).color;

      probe.remove();

      const range = document.createRange();

      if (link) {
        range.selectNodeContents(link);
      }

      const contentRects = [...range.getClientRects()].filter(
        (rect) => rect.width > 0 && rect.height > 0
      );
      const elementRects = link
        ? [...link.getClientRects()].filter(
            (rect) => rect.width > 0 && rect.height > 0
          )
        : [];

      return {
        text: link?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        contentLineCount: contentRects.length,
        elementLineCount: elementRects.length,
        display: style?.display ?? '',
        boxShadow: style?.boxShadow ?? '',
        color: style?.color ?? '',
        decoration: style?.textDecorationLine ?? '',
        expectedColor,
      };
    },
    { selector, colorVariable }
  );

  assert.ok(
    result.contentLineCount > 1,
    `${label} should wrap before testing multiline highlight: ${result.contentLineCount}`
  );
  assert.ok(
    result.elementLineCount > 1,
    `${label} anchor should expose per-line fragments, not one block box: ${result.elementLineCount}`
  );
  assert.equal(result.display, 'inline', `${label} should stay inline`);
  assert.ok(result.boxShadow.includes('inset'));
  assert.equal(result.color, result.expectedColor);
  assert.equal(result.decoration, 'none');
}

async function assertMobileHomeWrappedHighlights(page: Page) {
  await assertWrappedInlineHighlight({
    page,
    selector: 'a[href="https://sites.duke.edu/navid/"]',
    label: 'mobile experience advisor org link',
    colorVariable: 'var(--roy-o)',
  });
  await assertWrappedInlineHighlight({
    page,
    selector: '#writing a[href="/blog/on-agent-memory-fidelity"]',
    label: 'mobile home writing title',
    colorVariable: 'var(--roy-b)',
  });
  await assertWrappedInlineHighlight({
    page,
    selector: '#publications [data-testid="publication-title"]',
    label: 'mobile publication title',
    colorVariable: 'var(--roy-y)',
  });
}

async function assertMobileBlogWrappedHighlight(page: Page) {
  await assertWrappedInlineHighlight({
    page,
    selector: 'a[href="/blog/on-agent-memory-fidelity"]',
    label: 'mobile blog index title',
    colorVariable: 'var(--roy-b)',
  });
}

async function assertPublicationTitleUnderline(page: Page) {
  const firstTitle = page
    .locator('#publications [data-testid="publication-title"]')
    .first();

  await firstTitle.hover();

  const result = await page.evaluate(() => {
    const title = document.querySelector<HTMLElement>(
      '#publications [data-testid="publication-title"]:hover'
    );
    const style = title ? getComputedStyle(title) : null;
    const probe = document.createElement('span');

    probe.style.color = 'var(--roy-y)';
    document.body.append(probe);

    const yellowToken = getComputedStyle(probe).color;

    probe.remove();

    return {
      boxShadow: style?.boxShadow ?? '',
      color: style?.color ?? '',
      decoration: style?.textDecorationLine ?? '',
      skipInk: style?.textDecorationSkipInk ?? '',
      yellowToken,
    };
  });

  assert.ok(result.boxShadow.includes('inset'));
  assert.equal(result.color, result.yellowToken);
  assert.equal(result.decoration, 'none');
  assert.equal(result.skipInk, 'auto');
}

type ExperienceGroupToggleHighlightResult = {
  boxShadow: string;
  color: string;
  decoration: string;
  skipInk: string;
  orangeToken: string;
};

async function readExperienceGroupToggleHighlight(
  page: Page,
  stateSelector: ':hover' | ':active'
): Promise<ExperienceGroupToggleHighlightResult> {
  return page.evaluate((selector) => {
    const label = document.querySelector<HTMLElement>(
      `[data-testid="experience-group-toggle"]${selector} [data-testid="experience-group-label"]`
    );
    const style = label ? getComputedStyle(label) : null;
    const probe = document.createElement('span');

    probe.style.color = 'var(--roy-o)';
    document.body.append(probe);

    const orangeToken = getComputedStyle(probe).color;

    probe.remove();

    return {
      boxShadow: style?.boxShadow ?? '',
      color: style?.color ?? '',
      decoration: style?.textDecorationLine ?? '',
      skipInk: style?.textDecorationSkipInk ?? '',
      orangeToken,
    };
  }, stateSelector);
}

function assertExperienceGroupToggleHighlight(
  result: ExperienceGroupToggleHighlightResult,
  state: string
) {
  assert.ok(
    result.boxShadow.includes('inset'),
    `experience group label should highlight on ${state}`
  );
  assert.equal(result.color, result.orangeToken);
  assert.equal(result.decoration, 'none');
  assert.equal(result.skipInk, 'auto');
}

async function assertExperienceGroupLabelHoverHighlight(page: Page) {
  const teachingToggle = page
    .locator('[data-testid="experience-group-toggle"]', {
      hasText: /Teaching/,
    })
    .first();
  const teachingLabel = teachingToggle
    .locator('[data-testid="experience-group-label"]')
    .first();

  await teachingLabel.hover();
  assertExperienceGroupToggleHighlight(
    await readExperienceGroupToggleHighlight(page, ':hover'),
    'category label hover'
  );

  const labelBox = await teachingLabel.boundingBox();
  assert.ok(
    labelBox,
    'Teaching experience group label should have a layout box'
  );
  await page.mouse.move(
    labelBox.x + labelBox.width / 2,
    labelBox.y + labelBox.height / 2
  );
  await page.mouse.down();
  assertExperienceGroupToggleHighlight(
    await readExperienceGroupToggleHighlight(page, ':active'),
    'category label press'
  );
  await page.mouse.move(0, 0);
  await page.mouse.up();
}

async function assertExperienceTitleHoverColors(page: Page) {
  const readHover = async () =>
    page.evaluate(() => {
      const hovered = document.querySelector<HTMLElement>(
        '[data-testid="experience-title-run"]:hover'
      );
      const advisor = hovered?.querySelector<HTMLElement>(
        '[data-testid="advisor-label"]'
      );
      const probe = document.createElement('span');
      const foregroundProbe = document.createElement('span');
      const mutedProbe = document.createElement('span');

      probe.style.color = 'var(--roy-o)';
      foregroundProbe.style.color = 'var(--foreground)';
      mutedProbe.style.color = 'var(--muted-foreground)';
      document.body.append(probe);
      document.body.append(foregroundProbe);
      document.body.append(mutedProbe);

      const orangeToken = getComputedStyle(probe).color;
      const foregroundToken = getComputedStyle(foregroundProbe).color;
      const mutedToken = getComputedStyle(mutedProbe).color;

      probe.remove();
      foregroundProbe.remove();
      mutedProbe.remove();

      return {
        text: hovered?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        titleColor: hovered ? getComputedStyle(hovered).color : '',
        advisorColor: advisor ? getComputedStyle(advisor).color : '',
        titleDecoration: hovered
          ? getComputedStyle(hovered).textDecorationLine
          : '',
        advisorDecoration: advisor
          ? getComputedStyle(advisor).textDecorationLine
          : '',
        orangeToken,
        foregroundToken,
        mutedToken,
      };
    });

  const researchTitle = page
    .locator('[data-testid="experience-title-run"]', {
      hasText: 'Duke University Philip Romero',
    })
    .first();

  await researchTitle.locator('[data-testid="advisor-label"]').hover();
  const researchHover = await readHover();

  assert.equal(researchHover.text, 'Duke University Philip Romero');
  assert.equal(researchHover.titleColor, researchHover.orangeToken);
  assert.equal(researchHover.advisorColor, researchHover.orangeToken);

  const teachingTitle = page
    .locator(
      '[data-testid="experience-group"][data-group="teaching"] [data-testid="experience-title-run"]',
      { hasText: 'Operating Systems Matthew Lentz' }
    )
    .first();
  const teachingSeparator = await teachingTitle.evaluate((element) => ({
    tagName: element.tagName,
    className: element.className,
    rawText: element.textContent ?? '',
    whiteSpace: getComputedStyle(element).whiteSpace,
    decoration: getComputedStyle(element).textDecorationLine,
  }));

  // The course link wraps the whole title run, including the instructor
  // label, as one inline underlined run with a single breakable space.
  assert.equal(teachingSeparator.tagName, 'A');
  assert.ok(teachingSeparator.className.includes('royb-link'));
  assert.equal(teachingSeparator.rawText, 'Operating Systems Matthew Lentz');
  assert.equal(teachingSeparator.whiteSpace, 'break-spaces');
  assert.equal(teachingSeparator.decoration, 'underline');

  await teachingTitle.locator('[data-testid="advisor-label"]').hover();
  const teachingHover = await readHover();

  assert.equal(teachingHover.text, 'Operating Systems Matthew Lentz');
  assert.equal(teachingHover.titleColor, teachingHover.orangeToken);
  assert.equal(teachingHover.advisorColor, teachingHover.orangeToken);
}

async function assertHomeRailHoverAccents(page: Page) {
  const endedExperienceRow = page
    .locator('#experience li', {
      hasText: 'Duke University Navid NaderiAlizadeh',
    })
    .first();
  const publicationRow = page
    .locator('#publications [data-testid="publication-row"]')
    .first();
  const olderWritingRow = page
    .locator('#writing li', { hasText: 'On Fingerspitzengefühl' })
    .first();

  await assertNeutralRailRowHoverAccent({
    page,
    row: endedExperienceRow,
    hoverSource: endedExperienceRow.locator(
      '[data-testid="experience-title-run"]'
    ),
    accent: 'o',
    label: 'ended experience row',
  });
  await assertNeutralRailRowHoverAccent({
    page,
    row: publicationRow,
    hoverSource: publicationRow.locator('[data-testid="publication-title"]'),
    accent: 'y',
    dotTestId: 'publication-dot',
    connectorTestId: 'publication-connector',
    label: 'publication row',
  });
  await assertNeutralRailRowHoverAccent({
    page,
    row: olderWritingRow,
    hoverSource: olderWritingRow.locator(
      'a[href="/blog/on-fingerspitzengefuhl"]'
    ),
    accent: 'b',
    label: 'older writing row',
  });
  await assertRailRowKeepsMarkerOnHover({
    page,
    row: page
      .locator('#experience li', { hasText: 'Duke University Philip Romero' })
      .first(),
    hoverSource: page
      .locator('[data-testid="experience-title-run"]', {
        hasText: 'Duke University Philip Romero',
      })
      .first(),
    label: 'present experience row',
  });
}

async function assertWordmarkHoverHighlight(page: Page) {
  await page.locator('[data-testid="wordmark"] a').first().hover();

  const result = await page.evaluate(() => {
    const label = document.querySelector<HTMLElement>(
      '[data-testid="wordmark"] a:hover .royb-link-highlight'
    );
    const icon = document.querySelector<SVGElement>(
      '[data-testid="wordmark"] a:hover svg'
    );
    const labelStyle = label ? getComputedStyle(label) : null;
    const iconStyle = icon ? getComputedStyle(icon) : null;
    const probe = document.createElement('span');

    probe.style.color = 'var(--roy-r)';
    document.body.append(probe);

    const redToken = getComputedStyle(probe).color;

    probe.remove();

    return {
      labelBoxShadow: labelStyle?.boxShadow ?? '',
      labelColor: labelStyle?.color ?? '',
      labelDecoration: labelStyle?.textDecorationLine ?? '',
      iconDecoration: iconStyle?.textDecorationLine ?? '',
      redToken,
    };
  });

  assert.ok(result.labelBoxShadow.includes('inset'));
  assert.equal(result.labelColor, result.redToken);
  assert.equal(result.labelDecoration, 'none');
  assert.equal(result.iconDecoration, 'none');
}

async function assertExperienceInteractions(page: Page) {
  const groupRows = async (group: string) =>
    page
      .locator(`[data-testid="experience-group"][data-group="${group}"]`)
      .locator('[data-testid="rail-title"]')
      .count();

  assert.equal(await groupRows('research'), 3);
  assert.equal(await groupRows('engineering'), 0);
  assert.equal(await groupRows('teaching'), 0);

  const researchGroup = page.locator(
    '[data-testid="experience-group"][data-group="research"]'
  );
  const researchToggle = researchGroup.getByRole('button', {
    name: /Research/,
  });
  const groupBox = await researchGroup.boundingBox();
  const toggleBox = await researchToggle.boundingBox();

  assert.ok(groupBox, 'Research group should have a layout box');
  assert.ok(toggleBox, 'Research toggle should have a layout box');
  assert.ok(
    toggleBox.width < groupBox.width * 0.55,
    'Research toggle should be shrink-wrapped instead of full width'
  );

  await page.mouse.click(
    groupBox.x + groupBox.width - 4,
    toggleBox.y + toggleBox.height / 2
  );
  assert.equal(
    await groupRows('research'),
    3,
    'clicking the empty right side of the experience header should not toggle'
  );

  await page
    .locator('[data-testid="experience-group"][data-group="research"]')
    .getByRole('button', { name: /Research/ })
    .click();
  assert.equal(await groupRows('research'), 0);

  await page
    .locator('[data-testid="experience-group"][data-group="research"]')
    .getByRole('button', { name: /Research/ })
    .click();
  assert.equal(await groupRows('research'), 3);

  const engineeringGroup = page.locator(
    '[data-testid="experience-group"][data-group="engineering"]'
  );
  await engineeringGroup.getByRole('button', { name: /Engineering/ }).click();
  assert.equal(await groupRows('engineering'), 3);
  assert.equal(await groupRows('research'), 3);
  const engineeringText = (await engineeringGroup.textContent()) ?? '';
  assert.ok(engineeringText.includes('Duke Impact Investing Group'));
  assert.ok(engineeringText.includes('Collabs: Life Edit Therapeutics'));
  assert.equal(
    await engineeringGroup.locator('a[href="https://dukeimpact.com/"]').count(),
    1,
    'the DIIG row should link to dukeimpact.com'
  );
  assert.equal(
    await page
      .locator('#experience')
      .getByRole('button', { name: /show (more|less)\.\.\./ })
      .count(),
    0,
    'experience should not render show more or show less controls'
  );

  await page
    .locator('[data-testid="experience-group"][data-group="teaching"]')
    .getByRole('button', { name: /Teaching/ })
    .click();
  assert.equal(await groupRows('teaching'), 3);
  const teachingText = await page
    .locator('[data-testid="experience-group"][data-group="teaching"]')
    .textContent();
  const teachingPresentDot = page
    .locator('[data-testid="experience-group"][data-group="teaching"]')
    .locator('li', { hasText: 'Operating Systems Matthew Lentz' })
    .locator('[data-testid="rail-dot"][data-state="present"]');
  const teachingPresentDotClassName =
    (await teachingPresentDot.getAttribute('class')) ?? '';

  assert.ok(teachingText?.includes('Operating Systems'));
  assert.ok(teachingText?.includes('Computer Systems'));
  assert.ok(teachingText?.includes('Organic Chemistry I'));
  assert.ok(
    teachingText?.includes('Leading a discussion section + office hours')
  );
  assert.ok(teachingText?.includes('Led a discussion section + office hours'));
  assert.ok(
    teachingText?.includes(
      'Led a study group, saw kids quit pre-med as the semester went'
    )
  );
  assert.ok(
    !teachingText?.includes('with Matthew Lentz') &&
      !teachingText?.includes('with SAGE'),
    'instructor and program names moved out of the descriptions into the title labels'
  );
  assert.ok(teachingPresentDotClassName.includes('text-roy-o'));
  assert.ok(teachingText?.includes('Aug 2026 - Dec 2026'));
  assert.ok(!teachingText?.includes('Incoming Aug 2026'));
  const teachingGroup = page.locator(
    '[data-testid="experience-group"][data-group="teaching"]'
  );
  await assertRailRowKeepsMarkerOnHover({
    page,
    row: teachingGroup
      .locator('li', { hasText: 'Operating Systems Matthew Lentz' })
      .first(),
    hoverSource: teachingGroup
      .locator('[data-testid="experience-title-run"]', {
        hasText: 'Operating Systems Matthew Lentz',
      })
      .first(),
    label: 'present teaching row',
  });
  assert.ok(!teachingText?.includes('Duke University.'));
  assert.ok(teachingText?.includes('Jan 2025 - May 2025'));
  assert.ok(!teachingText?.includes('Sophomore spring'));
  assert.equal(
    (teachingText?.match(/Matthew Lentz/g) ?? []).length,
    2,
    'Matthew Lentz should appear as the label on both CS teaching titles'
  );
  assert.match(teachingText ?? '', /Organic Chemistry I\s+SAGE Tutor/);
  const computerSystemsRow = teachingGroup
    .locator('li', { hasText: 'Computer Systems Matthew Lentz' })
    .first();
  const computerSystemsTitle = computerSystemsRow
    .locator('a[data-testid="experience-title-run"]', {
      hasText: 'Computer Systems Matthew Lentz',
    })
    .first();
  const computerSystemsTitleInfo = await computerSystemsTitle.evaluate(
    (element) => ({
      tagName: element.tagName,
      href: element.getAttribute('href'),
      className: element.className,
      textContent: element.textContent,
      textDecoration: getComputedStyle(element).textDecorationLine,
    })
  );
  const teachingDescriptionLinkCount = await teachingGroup
    .locator('p a')
    .count();
  const orgoRow = teachingGroup
    .locator('li', { hasText: /Organic Chemistry I\s+SAGE Tutor/ })
    .first();
  const orgoTitle = orgoRow
    .locator('a[data-testid="experience-title-run"]', {
      hasText: /Organic Chemistry I\s+SAGE Tutor/,
    })
    .first();
  const orgoTitleInfo = await orgoTitle.evaluate((element) => ({
    tagName: element.tagName,
    href: element.getAttribute('href'),
    className: element.className,
    textContent: element.textContent,
    textDecoration: getComputedStyle(element).textDecorationLine,
  }));
  const sageAdvisorOnlyLinkCount = await page
    .locator(
      '[data-testid="experience-group"][data-group="teaching"] a[data-testid="advisor-label"]',
      { hasText: 'Tutor' }
    )
    .count();

  assert.equal(computerSystemsTitleInfo.tagName, 'A');
  assert.equal(
    computerSystemsTitleInfo.href,
    'https://courses.cs.duke.edu/spring26/compsci210d/'
  );
  assert.equal(
    computerSystemsTitleInfo.textContent,
    'Computer Systems Matthew Lentz'
  );
  assert.equal(
    teachingDescriptionLinkCount,
    0,
    'teaching descriptions no longer carry inline links; the title run is the only link'
  );
  assert.ok(
    computerSystemsTitleInfo.className.includes('royb-link') &&
      computerSystemsTitleInfo.className.includes('royb-link-highlight') &&
      computerSystemsTitleInfo.className.includes('royb-link-fragment') &&
      computerSystemsTitleInfo.textDecoration.includes('underline'),
    'Computer Systems Matthew Lentz should use the ROYB underlined title link treatment'
  );
  assert.equal(orgoTitleInfo.tagName, 'A');
  assert.equal(orgoTitleInfo.href, 'https://arc.duke.edu/peer-education/');
  assert.match(
    orgoTitleInfo.textContent ?? '',
    /Organic Chemistry I\s+SAGE Tutor/
  );
  assert.ok(
    orgoTitleInfo.className.includes('royb-link') &&
      orgoTitleInfo.className.includes('royb-link-highlight') &&
      orgoTitleInfo.className.includes('royb-link-fragment') &&
      orgoTitleInfo.textDecoration.includes('underline'),
    'Organic Chemistry I SAGE Tutor should use the ROYB underlined title link treatment'
  );
  assert.equal(
    sageAdvisorOnlyLinkCount,
    0,
    'Tutor should not render as an advisor-only anchor'
  );
  await expectNoTeachingShowMore(page);
}

async function expectNoTeachingShowMore(page: Page) {
  const count = await page
    .locator('[data-testid="experience-group"][data-group="teaching"]')
    .getByRole('button', { name: 'show more...' })
    .count();

  assert.equal(count, 0, 'teaching should not render show more');
}

async function assertHeroLinksHoverHighlight(page: Page) {
  const heroLink = page.locator('[data-testid="hero-section"] a').first();

  await heroLink.hover();

  const colors = await page.evaluate(() => {
    const link = document.querySelector<HTMLElement>(
      '[data-testid="hero-section"] a:hover'
    );
    const probe = document.createElement('span');

    probe.style.color = 'var(--roy-r)';
    document.body.append(probe);

    const linkColor = link ? getComputedStyle(link).color : '';
    const redToken = getComputedStyle(probe).color;

    probe.remove();

    return {
      linkColor,
      redToken,
      boxShadow: link ? getComputedStyle(link).boxShadow : '',
      textDecorationLine: link ? getComputedStyle(link).textDecorationLine : '',
      textDecorationSkipInk: link
        ? getComputedStyle(link).textDecorationSkipInk
        : '',
    };
  });

  assert.equal(colors.linkColor, colors.redToken);
  assert.ok(colors.boxShadow.includes('inset'));
  assert.equal(colors.textDecorationLine, 'none');
  assert.equal(colors.textDecorationSkipInk, 'auto');
}

async function assertBlogIndex(page: Page) {
  const result = await page.evaluate(() => {
    const main = document.querySelector<HTMLElement>('main');
    const mainStyle = main ? getComputedStyle(main) : null;
    const header =
      document
        .querySelector('[data-testid="blog-index-header"]')
        ?.textContent?.replace(/\s+/g, ' ')
        .trim() ?? '';
    const heading =
      document
        .querySelector('#posts h1, #posts h2')
        ?.textContent?.replace(/\s+/g, ' ')
        .trim() ?? '';
    const headingElement = document.querySelector<HTMLElement>(
      '#posts h1, #posts h2'
    );
    const bodyColor = getComputedStyle(document.body).color;
    const markerElement =
      document.querySelector<HTMLElement>('#posts header span');
    const headingLeft = headingElement?.getBoundingClientRect().left ?? 0;
    const sectionLeft =
      document.querySelector<HTMLElement>('#posts')?.getBoundingClientRect()
        .left ?? 0;
    const headerRow = document.querySelector<HTMLElement>(
      '#posts header > div'
    );
    const headerRowRect = headerRow?.getBoundingClientRect();
    const marker =
      markerElement?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const rail = document.querySelector('[data-testid="blog-index-rail"]');
    const items = [...(rail?.querySelectorAll<HTMLElement>('li') ?? [])];
    const legend = document.querySelector<HTMLElement>(
      '[data-testid="blog-index-legend"]'
    );
    const itemMarkers = items.map((item) => {
      const dot = item.querySelector<HTMLElement>('[data-testid="rail-dot"]');
      const dotStyle = dot ? getComputedStyle(dot) : null;

      return {
        title:
          item
            .querySelector('[data-testid="rail-title"]')
            ?.textContent?.replace(/\s+/g, ' ')
            .trim() ?? '',
        border: Number.parseFloat(dotStyle?.borderTopWidth ?? '0'),
        backgroundColor: dotStyle?.backgroundColor ?? '',
        width: dot?.getBoundingClientRect().width ?? 0,
      };
    });
    const firstFooter = items[0]?.querySelector(
      '[data-testid="blog-index-row-meta"]'
    );
    const firstFooterStyle = firstFooter ? getComputedStyle(firstFooter) : null;
    const descriptions = rail?.querySelectorAll('p[data-one-line="true"]');
    const postDates = [
      ...(rail?.querySelectorAll('[data-testid="rail-title"]') ?? []),
    ].map(
      (title) =>
        title.nextElementSibling?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    );
    const externalRows = [
      ...document.querySelectorAll<HTMLElement>(
        '[data-testid="external-writing-row"]'
      ),
    ];
    const externalTitleLinks = [
      ...document.querySelectorAll<HTMLAnchorElement>(
        '[data-testid="external-writing-title"]'
      ),
    ];
    const blogTitleWeights = [
      ...(rail?.querySelectorAll<HTMLElement>('[data-testid="rail-title"]') ??
        []),
    ].map((title) => Number.parseInt(getComputedStyle(title).fontWeight, 10));
    const externalMetas = [
      ...document.querySelectorAll<HTMLElement>(
        '[data-testid="external-writing-meta"]'
      ),
    ];
    const externalMetaStyles = externalMetas.map((meta) => {
      const style = getComputedStyle(meta);

      return {
        color: style.color,
        fontFamily: style.fontFamily,
        fontSize: Number.parseFloat(style.fontSize),
        fontWeight: Number.parseInt(style.fontWeight, 10),
        textTransform: style.textTransform,
      };
    });
    const postTagLabels = [
      ...(rail?.querySelectorAll<HTMLElement>('[data-post-tag]') ?? []),
    ].map((tag) => [tag.dataset.postTag ?? '', tag.textContent?.trim() ?? '']);
    const footer = document.querySelector('footer');
    const sitePage = document.querySelector<HTMLElement>(
      '[data-testid="site-page"]'
    );
    const bodyStyle = getComputedStyle(document.body);
    const readingProbe = document.createElement('span');

    readingProbe.className = 'reading-copy';
    document.body.append(readingProbe);
    const readingFontFamily = getComputedStyle(readingProbe).fontFamily;
    readingProbe.remove();

    const highlightedLinkClassNames = [
      ...document.querySelectorAll<HTMLElement>('a.royb-link-highlight'),
    ].map((link) => link.className);

    return {
      canonicalHref:
        document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
          ?.href ?? '',
      ogUrl:
        document
          .querySelector<HTMLMetaElement>('meta[property="og:url"]')
          ?.getAttribute('content') ?? '',
      h1Texts: [...document.querySelectorAll('h1')].map(
        (heading) => heading.textContent?.replace(/\s+/g, ' ').trim() ?? ''
      ),
      header,
      mainLeft: main?.getBoundingClientRect().left ?? 0,
      mainContentLeft:
        (main?.getBoundingClientRect().left ?? 0) +
        Number.parseFloat(mainStyle?.paddingLeft ?? '0'),
      heading,
      headingLeft,
      bodyColor,
      bodyFontFamily: bodyStyle.fontFamily,
      headingColor: headingElement
        ? getComputedStyle(headingElement).color
        : '',
      readingFontFamily,
      sectionLeft,
      marker,
      markerColor: markerElement ? getComputedStyle(markerElement).color : '',
      headerFirstRowGap:
        (items[0]?.getBoundingClientRect().top ?? 0) -
        (headerRowRect?.bottom ?? 0),
      legendExists: Boolean(legend),
      itemMarkers,
      itemCount: items.length,
      rowPaddingBottoms: items
        .slice(0, -1)
        .map((item) => Number.parseFloat(getComputedStyle(item).paddingBottom)),
      dotCount: rail?.querySelectorAll('[data-testid="rail-dot"]').length ?? 0,
      connectorCount:
        rail?.querySelectorAll('[data-testid="rail-connector"]').length ?? 0,
      externalRows: externalRows.map((row) =>
        row.textContent?.replace(/\s+/g, ' ').trim()
      ),
      externalRowIndexes: externalRows.map((row) => items.indexOf(row)),
      externalTitleTexts: externalTitleLinks.map(
        (link) => link.textContent?.replace(/\s+/g, ' ').trim() ?? ''
      ),
      blogTitleWeights,
      externalHrefs: externalTitleLinks.map((link) => link.href),
      externalMetas: externalMetas.map(
        (meta) => meta.textContent?.replace(/\s+/g, ' ').trim() ?? ''
      ),
      externalMetaStyles,
      postTagLabels,
      firstFooterText:
        firstFooter?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      firstFooterStyle: {
        color: firstFooterStyle?.color ?? '',
        fontFamily: firstFooterStyle?.fontFamily ?? '',
        fontSize: Number.parseFloat(firstFooterStyle?.fontSize ?? '0'),
        fontWeight: Number.parseInt(firstFooterStyle?.fontWeight ?? '0', 10),
        textTransform: firstFooterStyle?.textTransform ?? '',
      },
      postDates,
      firstRailTitleLeft:
        items[0]
          ?.querySelector<HTMLElement>('[data-testid="rail-title"]')
          ?.getBoundingClientRect().left ?? 0,
      bodyText: document.body.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      descriptionCount: descriptions?.length ?? 0,
      highlightedLinkClassNames,
      footerBottom: footer?.getBoundingClientRect().bottom ?? 0,
      sitePageBottom: sitePage?.getBoundingClientRect().bottom ?? 0,
      viewportHeight: window.innerHeight,
    };
  });

  assert.equal(result.header, '', 'blog header should only contain ROYB band');
  assert.equal(result.canonicalHref, 'https://imt.sh/blog');
  assert.equal(result.ogUrl, 'https://imt.sh/blog');
  assert.deepEqual(result.h1Texts, [`Index (${result.itemCount})`]);
  assert.equal(result.marker, '§1');
  assert.equal(result.heading, `Index (${result.itemCount})`);
  assert.equal(
    result.headingColor,
    result.markerColor,
    'blog index title should use the blog section accent color'
  );
  assert.ok(
    Math.abs(result.sectionLeft - result.mainContentLeft) <= 1,
    'blog index section should touch the main document content edge'
  );
  assert.ok(
    Math.abs(result.headingLeft - result.firstRailTitleLeft) <= 1,
    'blog index heading should align with blog rail row titles'
  );
  assert.ok(
    result.headerFirstRowGap >= 11 && result.headerFirstRowGap <= 13,
    `blog index header/list gap should match About/title spacing: ${result.headerFirstRowGap}`
  );
  assert.ok(
    result.rowPaddingBottoms.length > 0 &&
      result.rowPaddingBottoms.every((padding) => padding === 8),
    'blog index rail rows should use pb-2 between rows'
  );
  assert.equal(result.legendExists, false, 'blog index legend should be gone');
  const filledBlogRows = result.itemMarkers.filter(
    (item) => item.border === 0 && item.backgroundColor !== 'rgba(0, 0, 0, 0)'
  );
  const hollowBlogRows = result.itemMarkers.filter(
    (item) => item.border >= 1 && item.backgroundColor === 'rgba(0, 0, 0, 0)'
  );

  assert.equal(
    filledBlogRows.length,
    result.itemCount,
    'all blog rows should use filled rail markers'
  );
  assert.equal(
    hollowBlogRows.length,
    0,
    'blog rows should not use hollow opinion markers'
  );
  assert.ok(
    result.itemMarkers.every((item) => Math.round(item.width) === 12),
    'blog row markers should match the shared marker size'
  );
  assert.ok(result.itemCount >= 3);
  assert.equal(result.dotCount, result.itemCount);
  assert.equal(result.connectorCount, result.itemCount - 1);
  assert.deepEqual(
    result.externalTitleTexts,
    externalWriting.map((item) => item.title)
  );
  assert.ok(
    result.blogTitleWeights.every((weight) => weight === 600),
    'blog index titles should render at font-weight 600'
  );
  assert.deepEqual(
    result.externalHrefs,
    externalWriting.map((item) => item.href)
  );
  assert.deepEqual(
    result.externalMetas,
    externalWriting.map((item) => item.meta)
  );
  assert.deepEqual(result.postTagLabels, [
    ['technical', 'technical'],
    ['technical', 'technical'],
    ['external', 'external'],
  ]);
  assert.deepEqual(
    result.externalRows.map((row) => row?.includes('Nov 2024')),
    externalWriting.map(() => true)
  );
  assert.deepEqual(
    result.externalRowIndexes,
    externalWriting.map(
      (_, index) => result.itemCount - externalWriting.length + index
    )
  );
  assert.equal(result.descriptionCount, 0);
  assert.ok(
    result.postDates.every((date) => /^[A-Z][a-z]{2} \d{4}$/.test(date)),
    'blog index dates should use month-year only'
  );
  assert.match(
    result.firstFooterText,
    /^\d+(?:\.\d+)?K? words \(\d+ mins\)$/,
    'blog index reading metadata should use uppercase-K word counts and parenthesized mins'
  );
  assert.ok(
    !result.firstFooterText.includes('~'),
    'blog index reading metadata should not use approximation markers'
  );
  assert.deepEqual(
    {
      color: result.firstFooterStyle.color,
      fontFamily: result.firstFooterStyle.fontFamily,
      fontSize: result.firstFooterStyle.fontSize,
      fontWeight: result.firstFooterStyle.fontWeight,
      textTransform: result.firstFooterStyle.textTransform,
    },
    {
      color: result.bodyColor,
      fontFamily: result.readingFontFamily,
      fontSize: 16,
      fontWeight: 400,
      textTransform: 'none',
    },
    'blog index word/time metadata should use body foreground styling'
  );
  assert.ok(
    result.externalMetaStyles.every(
      (style) =>
        style.color === result.bodyColor &&
        style.fontFamily === result.readingFontFamily &&
        style.fontSize === 16 &&
        style.fontWeight === 400 &&
        style.textTransform === 'none'
    ),
    'external writing word/time metadata should match blog post metadata'
  );
  assert.ok(
    result.highlightedLinkClassNames.every((className) =>
      className.includes('royb-link-fragment')
    ),
    'blog index highlighted links should share the fragment-aware underline primitive'
  );
  assert.ok(!result.bodyText.includes('Updated'));
  assert.ok(!result.bodyText.includes('GitHub'));
  assert.ok(
    result.bodyText.includes('Finding the Right Answer Was Never the Point')
  );
  assert.ok(result.bodyText.includes('0.9K words (4 mins)'));
  assert.doesNotMatch(
    result.bodyText,
    /\b\d+(?:\.\d+)?k\b/,
    'blog index should not render lowercase-k thousands abbreviations'
  );
  assert.ok(!result.bodyText.includes('Duke Chronicle'));
  assert.ok(
    Math.abs(result.sitePageBottom - result.footerBottom) <= 1,
    'short blog index pages should pin the footer to the paper sheet bottom'
  );
  assert.ok(
    result.footerBottom < result.viewportHeight,
    'desktop paper sheet should leave ledger visible below the footer'
  );
}

async function assertBlogRailHoverAccents(page: Page) {
  const olderBlogRow = page
    .locator('#posts li', { hasText: 'On Fingerspitzengefühl' })
    .first();

  await assertNeutralRailRowHoverAccent({
    page,
    row: olderBlogRow,
    hoverSource: olderBlogRow.locator('a[href="/blog/on-fingerspitzengefuhl"]'),
    accent: 'b',
    label: 'older blog row',
  });
}

async function assertArticle(page: Page) {
  const firstBodyLink = page.locator('.article-prose p a[href]').first();

  if ((await firstBodyLink.count()) > 0) {
    await firstBodyLink.hover();
  }

  const result = await page.evaluate(() => {
    const main = document.querySelector('main');
    const mainRect = main?.getBoundingClientRect();
    const mainStyle = main ? getComputedStyle(main) : null;
    const article = document.querySelector<HTMLElement>(
      '[data-testid="blog-article"]'
    );
    const articleStyle = article ? getComputedStyle(article) : null;
    const title = document.querySelector<HTMLElement>(
      '[data-testid="blog-article-title"]'
    );
    const header = document.querySelector('article > header');
    const headerDate = header?.querySelector<HTMLElement>('time');
    const toc = document.querySelector<HTMLElement>('.article-toc');
    const tocText = toc?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const tocMeta = toc?.querySelector<HTMLElement>('.toc-meta');
    const tocMetaLabel = tocMeta?.querySelector<HTMLElement>(
      '.toc-meta-row > span:first-child'
    );
    const tocMetaValue = tocMeta?.querySelector<HTMLElement>(
      '.toc-meta-row > span:last-child'
    );
    const tocFirstSection = toc?.querySelector<HTMLElement>('.toc-section');
    const tocFirstNum = tocFirstSection?.querySelector<HTMLElement>('.toc-num');
    const tocFirstLink = toc?.querySelector<HTMLElement>('.toc-section > a');
    const tocMonoElements = [
      ...(toc?.querySelectorAll<HTMLElement>(
        'h2, .toc-num, .toc-section > a, .toc-subs a'
      ) ?? []),
    ];
    const hoveredArticleLink = document.querySelector<HTMLElement>(
      '.article-prose p a:hover'
    );
    const image = document.querySelector<HTMLElement>('.article-media img');
    const caption = document.querySelector<HTMLElement>(
      '.article-media figcaption'
    );
    const video = document.querySelector<HTMLVideoElement>(
      '.video-figure video'
    );
    const h2 = document.querySelector<HTMLElement>('.article-prose > h2');
    const h3 = document.querySelector<HTMLElement>('.article-prose > h3');
    const h4 = document.querySelector<HTMLElement>('.article-prose > h4');
    const token = document.querySelector<HTMLElement>(
      '.article-prose .highlight .hljs-keyword, .article-prose .highlight .hljs-string'
    );
    const codeTokenWeights = [
      ...document.querySelectorAll<HTMLElement>(
        '.article-prose .highlight span'
      ),
    ].map((element) =>
      Number.parseInt(getComputedStyle(element).fontWeight, 10)
    );
    const code = document.querySelector<HTMLElement>(
      '.article-prose .highlight code'
    );
    const highlight = document.querySelector<HTMLElement>(
      '.article-prose .highlight'
    );
    const footnoteRef = document.querySelector<HTMLElement>('.footnote-ref a');
    const footnotesSep = document.querySelector<HTMLElement>('.footnotes-sep');
    const footnotes = document.querySelector<HTMLElement>('.footnotes');
    const footnoteList = document.querySelector<HTMLElement>('.footnotes ol');
    const footnoteItem = footnotes?.querySelector<HTMLElement>('li');
    const articleList = document.querySelector<HTMLElement>(
      '.article-prose > ol'
    );
    const tableFigure = document.querySelector<HTMLElement>('.article-table');
    const firstBodyRow = document.querySelector<HTMLElement>(
      '.article-table tbody tr:nth-child(1)'
    );
    const secondBodyRow = document.querySelector<HTMLElement>(
      '.article-table tbody tr:nth-child(2)'
    );

    const mainContentLeft =
      (mainRect?.left ?? 0) + Number.parseFloat(mainStyle?.paddingLeft ?? '0');
    const titleStyle = title ? getComputedStyle(title) : null;
    const articleHeaderStyle = header ? getComputedStyle(header) : null;
    const tocMetaStyle = tocMeta ? getComputedStyle(tocMeta) : null;
    const tocMetaLabelStyle = tocMetaLabel
      ? getComputedStyle(tocMetaLabel)
      : null;
    const tocMetaValueStyle = tocMetaValue
      ? getComputedStyle(tocMetaValue)
      : null;
    const headerDateStyle = headerDate ? getComputedStyle(headerDate) : null;
    const tocFirstLinkStyle = tocFirstLink
      ? getComputedStyle(tocFirstLink)
      : null;
    const tocFirstNumStyle = tocFirstNum ? getComputedStyle(tocFirstNum) : null;
    const tocFirstSectionStyle = tocFirstSection
      ? getComputedStyle(tocFirstSection)
      : null;
    const hoveredArticleLinkStyle = hoveredArticleLink
      ? getComputedStyle(hoveredArticleLink)
      : null;
    const imageStyle = image ? getComputedStyle(image) : null;
    const captionStyle = caption ? getComputedStyle(caption) : null;
    const h2Style = h2 ? getComputedStyle(h2) : null;
    const h3Style = h3 ? getComputedStyle(h3) : null;
    const h4Style = h4 ? getComputedStyle(h4) : null;
    const tokenStyle = token ? getComputedStyle(token) : null;
    const codeStyle = code ? getComputedStyle(code) : null;
    const highlightStyle = highlight ? getComputedStyle(highlight) : null;
    const footnoteRefStyle = footnoteRef ? getComputedStyle(footnoteRef) : null;
    const footnotesStyle = footnotes ? getComputedStyle(footnotes) : null;
    const footnoteListStyle = footnoteList
      ? getComputedStyle(footnoteList)
      : null;
    const footnotesSepStyle = footnotesSep
      ? getComputedStyle(footnotesSep)
      : null;
    const footnoteItemMarkerStyle = footnoteItem
      ? getComputedStyle(footnoteItem, '::marker')
      : null;
    const articleListStyle = articleList ? getComputedStyle(articleList) : null;
    const articleListItem =
      articleList?.querySelector<HTMLElement>(':scope > li');
    const articleListItemRect = articleListItem?.getBoundingClientRect();
    const articleListMarkerStyle = articleListItem
      ? getComputedStyle(articleListItem, '::before')
      : null;
    const articleListMarkerLeft = Number.parseFloat(
      articleListMarkerStyle?.left ?? '0'
    );
    const firstBodyRowStyle = firstBodyRow
      ? getComputedStyle(firstBodyRow)
      : null;
    const secondBodyRowStyle = secondBodyRow
      ? getComputedStyle(secondBodyRow)
      : null;
    const highlightedLinkClassNames = [
      ...document.querySelectorAll<HTMLElement>(
        '.article-prose a.royb-link-highlight'
      ),
    ].map((link) => link.className);
    const jsonLdTypes = [
      ...document.querySelectorAll<HTMLScriptElement>(
        'script[type="application/ld+json"]'
      ),
    ].map((script) => {
      try {
        return JSON.parse(script.textContent ?? '{}')['@type'] as string;
      } catch {
        return 'invalid';
      }
    });
    const blueProbe = document.createElement('span');

    blueProbe.style.color = 'var(--roy-b)';
    document.body.append(blueProbe);
    const blueToken = getComputedStyle(blueProbe).color;
    blueProbe.remove();

    return {
      canonicalHref:
        document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
          ?.href ?? '',
      ogUrl:
        document
          .querySelector<HTMLMetaElement>('meta[property="og:url"]')
          ?.getAttribute('content') ?? '',
      h1Texts: [...document.querySelectorAll('h1')].map(
        (heading) => heading.textContent?.replace(/\s+/g, ' ').trim() ?? ''
      ),
      jsonLdTypes,
      bodyText: document.body.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      headerText: header?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      headerMarginBottom: Number.parseFloat(
        articleHeaderStyle?.marginBottom ?? '0'
      ),
      headerRowGap: Number.parseFloat(articleHeaderStyle?.rowGap ?? '0'),
      headerDateText:
        headerDate?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      headerDateTransform: headerDateStyle?.textTransform ?? '',
      titleText: title?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      titleLeft: title?.getBoundingClientRect().left ?? 0,
      mainContentLeft,
      titleWeight: Number.parseInt(titleStyle?.fontWeight ?? '0', 10),
      tocText,
      tocMetaFontVariantCaps: tocMetaStyle?.fontVariantCaps ?? '',
      tocMetaLetterSpacing: tocMetaStyle?.letterSpacing ?? '',
      tocMetaLabelSize: Number.parseFloat(tocMetaLabelStyle?.fontSize ?? '0'),
      tocMetaValueSize: Number.parseFloat(tocMetaValueStyle?.fontSize ?? '0'),
      tocMetaLabelTransform: tocMetaLabelStyle?.textTransform ?? '',
      tocMetaValueTransform: tocMetaValueStyle?.textTransform ?? '',
      tocMonoElementStyles: tocMonoElements.map((element) => {
        const style = getComputedStyle(element);

        return {
          text: element.textContent?.replace(/\s+/g, ' ').trim() ?? '',
          fontFamily: style.fontFamily,
          fontWeight: Number.parseInt(style.fontWeight, 10),
        };
      }),
      articlePaddingBottom: Number.parseFloat(
        articleStyle?.paddingBottom ?? '0'
      ),
      tocFirstLinkText:
        tocFirstLink?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      tocFirstNumText:
        tocFirstNum?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      tocFirstLinkDecoration: tocFirstLinkStyle?.textDecorationLine ?? '',
      tocFirstLinkWidth: tocFirstLink?.getBoundingClientRect().width ?? 0,
      tocWidth: toc?.getBoundingClientRect().width ?? 0,
      tocFirstGap:
        (tocFirstLink?.getBoundingClientRect().left ?? 0) -
        (tocFirstNum?.getBoundingClientRect().right ?? 0),
      tocFirstColumnGap: Number.parseFloat(
        tocFirstSectionStyle?.columnGap ?? '0'
      ),
      tocFirstNumDecoration: tocFirstNumStyle?.textDecorationLine ?? '',
      hoveredArticleLinkShadow: hoveredArticleLinkStyle?.boxShadow ?? '',
      hoveredArticleLinkColor: hoveredArticleLinkStyle?.color ?? '',
      blueToken,
      hoveredArticleLinkDecoration:
        hoveredArticleLinkStyle?.textDecorationLine ?? '',
      hoveredArticleLinkSkipInk:
        hoveredArticleLinkStyle?.textDecorationSkipInk ?? '',
      highlightedLinkClassNames,
      imageBorderTop: imageStyle?.borderTopWidth ?? '',
      captionAlign: captionStyle?.textAlign ?? '',
      captionSize: Number.parseFloat(captionStyle?.fontSize ?? '0'),
      videoAutoplay: video?.autoplay ?? false,
      videoControls: video?.controls ?? false,
      videoLoop: video?.loop ?? false,
      videoMuted: video?.muted ?? false,
      videoPlaysInline: video?.playsInline ?? false,
      videoPreload: video?.preload ?? '',
      h2Size: Number.parseFloat(h2Style?.fontSize ?? '0'),
      h3Size: Number.parseFloat(h3Style?.fontSize ?? '0'),
      h4Size: Number.parseFloat(h4Style?.fontSize ?? '0'),
      h4Family: h4Style?.fontFamily ?? '',
      h2Weight: Number.parseInt(h2Style?.fontWeight ?? '0', 10),
      h3Weight: Number.parseInt(h3Style?.fontWeight ?? '0', 10),
      h3Transform: h3Style?.textTransform ?? '',
      h4Transform: h4Style?.textTransform ?? '',
      h4LetterSpacing: h4Style?.letterSpacing ?? '',
      tokenColor: tokenStyle?.color ?? '',
      maxCodeTokenWeight: Math.max(0, ...codeTokenWeights),
      codeColor: codeStyle?.color ?? '',
      codeBackground: highlightStyle?.backgroundColor ?? '',
      footnoteRefFamily: footnoteRefStyle?.fontFamily ?? '',
      footnoteRefWeight: Number.parseInt(
        footnoteRefStyle?.fontWeight ?? '0',
        10
      ),
      footnotesSize: Number.parseFloat(footnotesStyle?.fontSize ?? '0'),
      footnoteListPadding: Number.parseFloat(
        footnoteListStyle?.paddingLeft ?? '0'
      ),
      footnotesSepStyle: footnotesSepStyle?.borderTopStyle ?? '',
      footnoteMarkerWeight: Number.parseInt(
        footnoteItemMarkerStyle?.fontWeight ?? '0',
        10
      ),
      footnoteListTag: footnoteList?.tagName ?? '',
      articleListStyle: articleListStyle?.listStyleType ?? '',
      articleListPadding: Number.parseFloat(
        articleListStyle?.paddingLeft ?? '0'
      ),
      articleListItemInset:
        articleListItemRect && articleList
          ? articleListItemRect.left - articleList.getBoundingClientRect().left
          : 0,
      articleListMarkerContent: articleListMarkerStyle?.content ?? '',
      articleListMarkerStart:
        articleListItemRect && articleList
          ? articleListItemRect.left +
            articleListMarkerLeft -
            articleList.getBoundingClientRect().left
          : 0,
      tableCaptionCount:
        tableFigure?.querySelectorAll('figcaption').length ?? 0,
      firstBodyRowBackground: firstBodyRowStyle?.backgroundColor ?? '',
      secondBodyRowBackground: secondBodyRowStyle?.backgroundColor ?? '',
      prototypeCount: document.querySelectorAll('[data-prototype]').length,
    };
  });

  assert.ok(result.titleText.length > 0, 'article title should render');
  assert.equal(
    result.canonicalHref,
    'https://imt.sh/blog/on-agent-memory-fidelity'
  );
  assert.equal(result.ogUrl, 'https://imt.sh/blog/on-agent-memory-fidelity');
  assert.deepEqual(result.h1Texts, [result.titleText]);
  assert.ok(result.jsonLdTypes.includes('BlogPosting'));
  assert.ok(
    result.titleWeight >= 700,
    'article title should stay bold at the top of the article'
  );
  assert.ok(
    Math.abs(result.titleLeft - result.mainContentLeft) <= 1,
    `article title should align to blog section marker edge: ${result.titleLeft} / ${result.mainContentLeft}`
  );
  assert.ok(!result.headerText.includes('GitHub'));
  assert.ok(!result.headerText.includes('Why agent context should be'));
  assert.equal(result.headerMarginBottom, 16);
  assert.equal(result.headerRowGap, 4);
  assert.match(result.headerDateText, /^[A-Z][a-z]{2} \d{2}, \d{4}$/);
  assert.equal(result.headerDateTransform, 'none');
  for (const text of ['Time', 'Last updated', 'Code', 'GitHub']) {
    assert.ok(result.tocText.includes(text), `TOC should include ${text}`);
  }
  for (const text of ['time', 'last updated', 'code', 'github']) {
    assert.ok(!result.tocText.includes(text), `TOC should proper-case ${text}`);
  }
  assert.ok(!result.tocText.includes('Reading time'));
  assert.ok(!result.tocText.includes('~'));
  assert.match(
    result.tocText,
    /\d+(?:\.\d+)?K? words \(\d+ mins\)/,
    'TOC reading metadata should use uppercase-K word counts and parenthesized mins'
  );
  assert.doesNotMatch(
    result.tocText,
    /\b\d+(?:\.\d+)?k\b/,
    'TOC reading metadata should not use lowercase-k thousands abbreviations'
  );
  assert.doesNotMatch(
    result.tocText,
    /\b\d+ min(?!s)\b/,
    'TOC reading metadata should use mins'
  );
  assert.equal(result.tocMetaFontVariantCaps, 'normal');
  assert.equal(result.tocMetaLabelTransform, 'none');
  assert.equal(result.tocMetaValueTransform, 'none');
  assert.equal(result.tocMetaLetterSpacing, 'normal');
  assert.ok(
    result.tocMonoElementStyles.length >= 1 &&
      result.tocMonoElementStyles.every(
        (style) =>
          style.fontFamily.includes('ui-monospace') && style.fontWeight <= 500
      ),
    'TOC index, numbers, section titles, and subsection titles should use normal-weight mono'
  );
  assert.ok(
    result.tocMetaLabelSize >= 14 && result.tocMetaLabelSize < 15,
    'TOC metadata labels should match the hero contact scale'
  );
  assert.ok(
    result.tocMetaValueSize >= 14 && result.tocMetaValueSize < 15,
    'TOC metadata values should match the hero contact scale'
  );
  assert.equal(result.tocFirstNumText, '0');
  assert.equal(result.tocFirstLinkText, 'Background');
  assert.equal(result.tocFirstLinkDecoration, 'underline');
  assert.equal(result.tocFirstNumDecoration, 'none');
  assert.equal(
    result.tocFirstColumnGap,
    12,
    'TOC section number/title column gap should be 0.75rem'
  );
  assert.ok(
    result.tocFirstGap >= 12,
    `TOC rendered number/title gap should reflect the wider grid gap: ${result.tocFirstGap}`
  );
  assert.ok(
    result.tocFirstLinkWidth < result.tocWidth * 0.4,
    'TOC hover/click area should stay close to the text, not full width'
  );
  assert.ok(result.hoveredArticleLinkShadow.includes('inset'));
  assert.equal(result.hoveredArticleLinkColor, result.blueToken);
  assert.equal(result.hoveredArticleLinkDecoration, 'none');
  assert.equal(result.hoveredArticleLinkSkipInk, 'auto');
  assert.ok(
    result.highlightedLinkClassNames.every((className) =>
      className.includes('royb-link-fragment')
    ),
    'article highlighted links should share the fragment-aware underline primitive'
  );

  const tocGithubLink = page
    .locator('.article-toc .toc-meta a[href*="github"]')
    .first();

  if ((await tocGithubLink.count()) > 0) {
    await tocGithubLink.hover();

    const tocGithubHover = await page.evaluate(() => {
      const link = document.querySelector<HTMLElement>(
        '.article-toc .toc-meta a[href*="github"]:hover'
      );
      const probe = document.createElement('span');

      probe.style.color = 'var(--roy-b)';
      document.body.append(probe);

      const blueToken = getComputedStyle(probe).color;
      const style = link ? getComputedStyle(link) : null;

      probe.remove();

      return {
        color: style?.color ?? '',
        boxShadow: style?.boxShadow ?? '',
        decoration: style?.textDecorationLine ?? '',
        skipInk: style?.textDecorationSkipInk ?? '',
        blueToken,
      };
    });

    assert.equal(tocGithubHover.color, tocGithubHover.blueToken);
    assert.ok(tocGithubHover.boxShadow.includes('inset'));
    assert.equal(tocGithubHover.decoration, 'none');
    assert.equal(tocGithubHover.skipInk, 'auto');
  }

  assert.equal(result.imageBorderTop, '0px');
  assert.equal(result.captionAlign, 'center');
  assert.ok(result.captionSize >= 14 && result.captionSize < 15);
  assert.equal(result.videoAutoplay, true);
  assert.equal(result.videoControls, true);
  assert.equal(result.videoLoop, true);
  assert.equal(result.videoMuted, true);
  assert.equal(result.videoPlaysInline, true);
  assert.equal(result.videoPreload, 'auto');
  assert.ok(result.h2Size > result.h3Size);
  assert.ok(result.h2Weight >= 600);
  assert.ok(result.h3Weight >= 600 && result.h3Weight <= result.h2Weight);
  assert.equal(result.h3Transform, 'none');
  if (result.h4Size > 0) {
    assert.ok(result.h3Size > result.h4Size);
    assert.ok(result.h4Size >= 18);
    assert.equal(result.h4Transform, 'none');
    assert.equal(result.h4LetterSpacing, 'normal');
    assert.ok(
      result.h4Family.includes('Open Sans'),
      'article h4 labels should use the site title sans font'
    );
  }
  assert.notEqual(result.tokenColor, result.codeColor);
  assert.ok(
    result.maxCodeTokenWeight <= 400,
    'article code highlighting should not bold tokens'
  );
  assert.equal(result.codeBackground, 'rgb(243, 243, 241)');
  assert.ok(
    result.articlePaddingBottom === 12,
    `articles should use pb-3: ${result.articlePaddingBottom}`
  );
  assert.equal(result.articleListStyle, 'none');
  assert.ok(result.articleListPadding >= 39 && result.articleListPadding <= 41);
  assert.ok(
    result.articleListItemInset >= 39 && result.articleListItemInset <= 41
  );
  assert.ok(
    result.articleListMarkerStart >= 11 && result.articleListMarkerStart <= 13
  );
  assert.ok(result.articleListMarkerContent.includes('counter'));
  assert.ok(result.footnotesSize >= 14 && result.footnotesSize < 15);
  assert.ok(result.footnoteListPadding >= 24);
  assert.ok(result.footnoteRefFamily.includes('ui-monospace'));
  assert.ok(result.footnoteRefWeight >= 600);
  assert.equal(result.footnotesSepStyle, 'dashed');
  assert.ok(
    result.footnoteMarkerWeight <= 500,
    'bottom footnote list markers should not be bold'
  );
  assert.equal(result.footnoteListTag, 'OL');
  assert.equal(result.tableCaptionCount, 0);
  assert.notEqual(
    result.firstBodyRowBackground,
    result.secondBodyRowBackground
  );
  assert.equal(result.prototypeCount, 0);
  assert.ok(!result.bodyText.toLowerCase().includes('prototyping'));

  const darkCode = await page.evaluate(() => {
    const root = document.documentElement;
    const originalClassName = root.className;

    root.classList.remove('light');
    root.classList.add('dark');

    const block = document.querySelector<HTMLElement>(
      '.article-prose .article-code-block'
    );
    const keyword = document.querySelector<HTMLElement>(
      '.article-prose .highlight .hljs-keyword, .article-prose .highlight .k'
    );
    const kbd = document.querySelector<HTMLElement>('.article-prose kbd');
    const code = document.querySelector<HTMLElement>(
      '.article-prose .highlight code'
    );
    const blockStyle = block ? getComputedStyle(block) : null;
    const keywordStyle = keyword ? getComputedStyle(keyword) : null;
    const kbdStyle = kbd ? getComputedStyle(kbd) : null;
    const codeStyle = code ? getComputedStyle(code) : null;
    const result = {
      background: blockStyle?.backgroundColor ?? '',
      color: codeStyle?.color ?? blockStyle?.color ?? '',
      keywordColor: keywordStyle?.color ?? '',
      kbdBackground: kbdStyle?.backgroundColor ?? '',
      kbdBackgroundImage: kbdStyle?.backgroundImage ?? '',
      kbdBorderTop: kbdStyle?.borderTopColor ?? '',
      kbdBorderBottom: kbdStyle?.borderBottomColor ?? '',
      kbdBoxShadow: kbdStyle?.boxShadow ?? '',
      kbdColor: kbdStyle?.color ?? '',
    };

    root.className = originalClassName;

    return result;
  });

  assert.equal(darkCode.background, 'rgb(23, 23, 23)');
  assert.notEqual(darkCode.color, 'rgb(23, 23, 23)');
  assert.notEqual(darkCode.keywordColor, 'rgb(23, 23, 23)');
  assert.equal(darkCode.kbdBackground, 'rgb(38, 38, 38)');
  assert.match(darkCode.kbdBackgroundImage, /linear-gradient/);
  assert.match(darkCode.kbdBackgroundImage, /rgba\(255, 255, 255, 0\.07\)/);
  assert.notEqual(darkCode.kbdColor, darkCode.kbdBackground);
  assert.notEqual(darkCode.kbdBorderTop, darkCode.kbdBackground);
  assert.equal(darkCode.kbdBorderBottom, 'rgb(18, 18, 18)');
  assert.ok(
    colorBrightness(darkCode.kbdBorderBottom) <
      colorBrightness(darkCode.kbdBackground),
    'dark keycap bottom edge should be darker than the key face'
  );
  assert.match(darkCode.kbdBoxShadow, /rgba\(0, 0, 0, 0\.7\)/);
}

async function assertFingerspitzenArticle(page: Page) {
  const expectedSrcs = [
    '/static/media/fingerspitzen-optimization-transparent.png',
    '/static/media/fingerspitzen-language-transparent.png',
  ];
  const readImageStyles = () =>
    page.evaluate((srcs) => {
      const images = [
        ...document.querySelectorAll<HTMLImageElement>('.article-media img'),
      ];

      return srcs.map((src) => {
        const image = images.find((candidate) => {
          return candidate.getAttribute('src') === src;
        });
        const figure = image?.closest('figure');
        const style = image ? getComputedStyle(image) : null;

        return {
          src,
          found: Boolean(image),
          figureClassName: figure?.className ?? '',
          background: style?.backgroundColor ?? '',
          paddingTop: Number.parseFloat(style?.paddingTop ?? '0'),
        };
      });
    }, expectedSrcs);

  const lightImages = await readImageStyles();

  assert.ok(
    lightImages.every((image) => image.found),
    'Fingerspitzengefuhl transparent PNGs should render in the article'
  );
  assert.ok(
    lightImages.every((image) =>
      image.figureClassName.includes('article-media-light-transparent')
    ),
    'Fingerspitzengefuhl transparent PNGs should use the light-transparent media class'
  );
  assert.deepEqual(
    lightImages.map((image) => image.background),
    ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)'],
    'Fingerspitzengefuhl transparent PNGs should stay transparent in light mode'
  );
  assert.deepEqual(
    lightImages.map((image) => Math.round(image.paddingTop)),
    [10, 10],
    'Fingerspitzengefuhl transparent PNGs should keep article image padding'
  );

  await page.getByTestId('theme-toggle').click();
  await page.waitForFunction(() =>
    document.documentElement.classList.contains('dark')
  );

  const darkImages = await readImageStyles();

  assert.deepEqual(
    darkImages.map((image) => image.background),
    ['rgb(250, 250, 250)', 'rgb(250, 250, 250)'],
    'Fingerspitzengefuhl transparent PNGs should use the article image fill in dark mode'
  );
  assert.deepEqual(
    darkImages.map((image) => Math.round(image.paddingTop)),
    [10, 10],
    'Fingerspitzengefuhl transparent PNGs should keep padding in dark mode'
  );
}

async function assertHarmoniaArticle(page: Page) {
  const result = await page.evaluate(() => {
    const prose = document.querySelector<HTMLElement>('.article-prose');
    const proseRect = prose?.getBoundingClientRect();
    const paragraphs = [
      ...document.querySelectorAll<HTMLElement>('.article-prose p'),
    ].map((paragraph) => paragraph.textContent?.trim() ?? '');
    const outputHeader = [...document.querySelectorAll<HTMLElement>('th')].find(
      (header) =>
        header.textContent?.replace(/\s+/g, ' ').trim() === 'Neutral Value'
    );
    const outputHeaderStyle = outputHeader
      ? getComputedStyle(outputHeader)
      : null;
    const outputHeaderRect = outputHeader?.getBoundingClientRect();
    const outputLineHeight = Number.parseFloat(
      outputHeaderStyle?.lineHeight ?? '0'
    );
    const outputPaddingY =
      Number.parseFloat(outputHeaderStyle?.paddingTop ?? '0') +
      Number.parseFloat(outputHeaderStyle?.paddingBottom ?? '0');
    const tableCells = [
      ...document.querySelectorAll<HTMLElement>(
        '.article-table th, .article-table td'
      ),
    ];
    const tableHeaders = [
      ...document.querySelectorAll<HTMLElement>('.article-table th'),
    ];
    const tableDataCells = [
      ...document.querySelectorAll<HTMLElement>('.article-table td'),
    ];
    const tableCodes = [
      ...document.querySelectorAll<HTMLElement>(
        '.article-table th code, .article-table td code'
      ),
    ];
    const tableWraps = [
      ...document.querySelectorAll<HTMLElement>('.article-table .table-wrap'),
    ];
    const h4 = document.querySelector<HTMLElement>('.article-prose h4');
    const h4Style = h4 ? getComputedStyle(h4) : null;
    const iframes = [
      ...document.querySelectorAll<HTMLIFrameElement>('.article-prose iframe'),
    ];

    return {
      bodyText: document.body.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      h4Text: h4?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      h4Transform: h4Style?.textTransform ?? '',
      h4LetterSpacing: h4Style?.letterSpacing ?? '',
      h4FontFamily: h4Style?.fontFamily ?? '',
      hasPronounParagraph: paragraphs.some((text) =>
        text.startsWith('It assumes clusters are')
      ),
      hasRepeatedHdbscanStart: paragraphs.some((text) =>
        text.startsWith('HDBSCAN assumes')
      ),
      outputHeight: outputHeaderRect?.height ?? 0,
      outputLineHeight,
      outputPaddingY,
      outputWhiteSpace: outputHeaderStyle?.whiteSpace ?? '',
      outputWordBreak: outputHeaderStyle?.wordBreak ?? '',
      outputOverflowWrap: outputHeaderStyle?.overflowWrap ?? '',
      tableCellWordBreaks: tableCells.map(
        (cell) => getComputedStyle(cell).wordBreak
      ),
      tableCellOverflowWraps: tableCells.map(
        (cell) => getComputedStyle(cell).overflowWrap
      ),
      tableHeaderWhiteSpaces: tableHeaders.map(
        (cell) => getComputedStyle(cell).whiteSpace
      ),
      tableDataCellWhiteSpaces: tableDataCells.map(
        (cell) => getComputedStyle(cell).whiteSpace
      ),
      tableCodeWhiteSpaces: tableCodes.map(
        (code) => getComputedStyle(code).whiteSpace
      ),
      tableWrapData: tableWraps.map((wrap) => {
        const style = getComputedStyle(wrap);
        const rect = wrap.getBoundingClientRect();

        return {
          right: rect.right,
          overflowX: style.overflowX,
          position: style.position,
          scrollWidth: wrap.scrollWidth,
          clientWidth: wrap.clientWidth,
        };
      }),
      proseRight: proseRect?.right ?? 0,
      iframeData: iframes.map((iframe) => ({
        allowTransparency: iframe.getAttribute('allowtransparency') ?? '',
        styleAttr: iframe.getAttribute('style') ?? '',
        isHarmonia: iframe.getAttribute('data-harmonia-iframe') ?? '',
        src: iframe.getAttribute('src') ?? '',
        loading: iframe.getAttribute('loading') ?? '',
        background: getComputedStyle(iframe).backgroundColor,
        opacity: getComputedStyle(iframe).opacity,
      })),
    };
  });

  assert.equal(result.hasPronounParagraph, true);
  assert.equal(result.h4Text, "Problem 1: Zero isn't always neutral");
  assert.equal(result.h4Transform, 'none');
  assert.equal(result.h4LetterSpacing, 'normal');
  assert.ok(
    result.h4FontFamily.includes('Open Sans'),
    'Harmonia subheads should use the sans title font'
  );
  assert.ok(result.bodyText.includes('(1 - instrumentalness)'));
  assert.equal(result.hasRepeatedHdbscanStart, false);
  assert.equal(result.outputWhiteSpace, 'nowrap');
  assert.equal(result.outputWordBreak, 'normal');
  assert.equal(result.outputOverflowWrap, 'normal');
  assert.ok(
    result.outputHeight <= result.outputLineHeight + result.outputPaddingY + 2,
    'Neutral Value table header should not split across multiple lines'
  );
  assert.ok(
    result.tableCellWordBreaks.every((wordBreak) => wordBreak === 'normal'),
    'article table cells should not break single words'
  );
  assert.ok(
    result.tableCellOverflowWraps.every(
      (overflowWrap) => overflowWrap === 'normal'
    ),
    'article table cells should use shadcn-like normal wrapping'
  );
  assert.ok(
    result.tableHeaderWhiteSpaces.every(
      (whiteSpace) => whiteSpace === 'nowrap'
    ),
    'article table headers should stay intact'
  );
  assert.ok(
    result.tableDataCellWhiteSpaces.every(
      (whiteSpace) => whiteSpace === 'normal'
    ),
    'article table body cells should keep normal multi-word wrapping'
  );
  assert.ok(
    result.tableCodeWhiteSpaces.every((whiteSpace) => whiteSpace === 'nowrap'),
    'article table code tokens should stay intact'
  );
  assert.ok(
    result.tableWrapData.every((wrap) => wrap.overflowX === 'auto'),
    'article table wrappers should expose horizontal overflow only when needed'
  );
  assert.ok(
    result.tableWrapData.every((wrap) => wrap.position === 'relative'),
    'article table wrappers should use the shadcn relative wrapper pattern'
  );
  assert.ok(
    result.tableWrapData.every((wrap) => wrap.scrollWidth >= wrap.clientWidth),
    'article table wrappers should preserve intrinsic table width'
  );
  assert.ok(
    result.tableWrapData.every((wrap) => wrap.right <= result.proseRight + 1),
    'article table wrappers should stay inside prose width'
  );
  assert.equal(
    result.iframeData.length,
    4,
    'Harmonia should render its four iframes'
  );
  assert.ok(
    result.iframeData.every(
      (iframe) =>
        iframe.allowTransparency === 'true' &&
        iframe.isHarmonia === 'true' &&
        iframe.src.startsWith('https://islamtayeb.github.io/harmonia/') &&
        !iframe.src.includes('theme=') &&
        iframe.loading === 'lazy' &&
        !/background\s*:/i.test(iframe.styleAttr) &&
        iframe.background === 'rgba(0, 0, 0, 0)' &&
        iframe.opacity === '1'
    ),
    'all Harmonia iframes should be transparent and fully opaque'
  );
}

async function assertHarmoniaIframeDarkTheme(page: Page) {
  const harmoniaFrame = () =>
    page
      .frames()
      .find((frame) =>
        frame.url().startsWith('https://islamtayeb.github.io/harmonia/')
      );
  const embedTheme = () =>
    harmoniaFrame()?.evaluate(() =>
      document.documentElement.getAttribute('data-harmonia-theme')
    );
  const srcsBefore = await page.evaluate(() =>
    [...document.querySelectorAll('iframe[data-harmonia-iframe="true"]')].map(
      (iframe) => iframe.getAttribute('src') ?? ''
    )
  );

  await page
    .locator('iframe[data-harmonia-iframe="true"]')
    .first()
    .scrollIntoViewIfNeeded();
  await page.waitForFunction(
    () =>
      document
        .querySelector('iframe[data-harmonia-iframe="true"]')
        ?.getAttribute('data-harmonia-theme') === 'light'
  );
  assert.equal(
    await embedTheme(),
    null,
    'a loaded Harmonia embed should start in its light theme'
  );

  await page.getByTestId('theme-toggle').click();
  await page.waitForFunction(() =>
    [...document.querySelectorAll('iframe[data-harmonia-iframe="true"]')].every(
      (iframe) => iframe.getAttribute('data-harmonia-theme') === 'dark'
    )
  );
  await page.waitForTimeout(250);
  assert.equal(
    await embedTheme(),
    'dark',
    'the loaded Harmonia embed should switch to dark from a postMessage'
  );

  const srcsAfter = await page.evaluate(() =>
    [...document.querySelectorAll('iframe[data-harmonia-iframe="true"]')].map(
      (iframe) => iframe.getAttribute('src') ?? ''
    )
  );

  assert.ok(
    srcsBefore.length >= 1,
    'Harmonia should render theme-aware iframes'
  );
  assert.deepEqual(
    srcsAfter,
    srcsBefore,
    'toggling the theme should not reload Harmonia iframes'
  );

  await page.getByTestId('theme-toggle').click();
  await page.waitForFunction(() =>
    [...document.querySelectorAll('iframe[data-harmonia-iframe="true"]')].every(
      (iframe) => iframe.getAttribute('data-harmonia-theme') === 'light'
    )
  );
}

async function assertLegacyMediaArticle(page: Page) {
  const result = await page.evaluate(() => {
    const prose = document.querySelector<HTMLElement>('.article-prose');
    const proseRect = prose?.getBoundingClientRect();
    const videos = [...document.querySelectorAll<HTMLVideoElement>('video')];
    const mediaFigures = [
      ...document.querySelectorAll<HTMLElement>('.article-media'),
    ];
    const captions = [
      ...document.querySelectorAll<HTMLElement>('.article-media figcaption'),
    ];
    const keycap = document.querySelector<HTMLElement>('kbd');
    const detailSummaries = [
      ...document.querySelectorAll<HTMLElement>('.article-summary'),
    ];
    const lists = [
      ...document.querySelectorAll<HTMLElement>(
        '.article-prose > ol, .article-prose > ul'
      ),
    ];

    const captionStyles = captions.map((caption) => {
      const style = getComputedStyle(caption);

      return {
        align: style.textAlign,
        size: Number.parseFloat(style.fontSize),
        color: style.color,
      };
    });
    const videoData = videos.map((video) => {
      const style = getComputedStyle(video);

      return {
        autoplay: video.autoplay,
        controls: video.controls,
        loop: video.loop,
        muted: video.muted,
        playsInline: video.playsInline,
        preload: video.preload,
        borderTop: style.borderTopWidth,
        width: video.getBoundingClientRect().width,
        source: video.currentSrc || video.querySelector('source')?.src || '',
      };
    });
    const root = document.documentElement;
    const originalClassName = root.className;

    root.classList.remove('dark');
    root.classList.add('light');
    const lightKeycapStyle = keycap ? getComputedStyle(keycap) : null;
    const lightKeycap = {
      display: lightKeycapStyle?.display ?? '',
      borderTopWidth: lightKeycapStyle?.borderTopWidth ?? '',
      borderTopColor: lightKeycapStyle?.borderTopColor ?? '',
      borderBottomColor: lightKeycapStyle?.borderBottomColor ?? '',
      boxShadow: lightKeycapStyle?.boxShadow ?? '',
      backgroundColor: lightKeycapStyle?.backgroundColor ?? '',
      backgroundImage: lightKeycapStyle?.backgroundImage ?? '',
      color: lightKeycapStyle?.color ?? '',
    };

    root.classList.remove('light');
    root.classList.add('dark');
    const darkKeycapStyle = keycap ? getComputedStyle(keycap) : null;
    const darkKeycap = {
      display: darkKeycapStyle?.display ?? '',
      borderTopWidth: darkKeycapStyle?.borderTopWidth ?? '',
      borderTopColor: darkKeycapStyle?.borderTopColor ?? '',
      borderBottomColor: darkKeycapStyle?.borderBottomColor ?? '',
      boxShadow: darkKeycapStyle?.boxShadow ?? '',
      backgroundColor: darkKeycapStyle?.backgroundColor ?? '',
      backgroundImage: darkKeycapStyle?.backgroundImage ?? '',
      color: darkKeycapStyle?.color ?? '',
    };

    root.className = originalClassName;

    const listData = lists.map((list) => {
      const style = getComputedStyle(list);
      const rect = list.getBoundingClientRect();
      const firstItem = list.querySelector<HTMLElement>(':scope > li');
      const itemRect = firstItem?.getBoundingClientRect();
      const beforeStyle = firstItem
        ? getComputedStyle(firstItem, '::before')
        : null;
      const beforeLeft = Number.parseFloat(beforeStyle?.left ?? '0');

      return {
        tag: list.tagName,
        paddingLeft: Number.parseFloat(style.paddingLeft),
        listStyleType: style.listStyleType,
        left: rect.left,
        right: rect.right,
        itemInset: itemRect ? itemRect.left - rect.left : 0,
        markerContent: beforeStyle?.content ?? '',
        markerLeft: beforeLeft,
        markerWidth: Number.parseFloat(beforeStyle?.width ?? '0'),
        markerStart: itemRect ? itemRect.left + beforeLeft - rect.left : 0,
      };
    });
    const maxListOverflow = proseRect
      ? Math.max(
          0,
          ...listData.map((list) =>
            Math.max(proseRect.left - list.left, list.right - proseRect.right)
          )
        )
      : 0;

    return {
      videoData,
      captionStyles,
      mediaBorderWidths: mediaFigures.map(
        (figure) => getComputedStyle(figure).borderTopWidth
      ),
      keycapDisplay: lightKeycap.display,
      keycapBorderTop: lightKeycap.borderTopWidth,
      keycapBoxShadow: lightKeycap.boxShadow,
      keycapBackgroundImage: lightKeycap.backgroundImage,
      lightKeycap,
      darkKeycap,
      listData,
      maxListOverflow,
      detailSummaryTexts: detailSummaries.map(
        (summary) => summary.textContent?.replace(/\s+/g, ' ').trim() ?? ''
      ),
      detailSummaryEmTexts: detailSummaries.map(
        (summary) =>
          summary
            .querySelector('em')
            ?.textContent?.replace(/\s+/g, ' ')
            .trim() ?? ''
      ),
    };
  });

  assert.ok(
    result.videoData.length >= 2,
    'legacy article should render videos'
  );
  assert.ok(
    result.videoData.every((video) => video.source.includes('/static/media/')),
    'legacy videos should load copied /static/media assets'
  );
  assert.ok(
    result.videoData.every(
      (video) =>
        video.autoplay &&
        video.controls &&
        video.loop &&
        video.muted &&
        video.playsInline &&
        video.preload === 'auto'
    ),
    'legacy videos should use native APM-like media attributes'
  );
  assert.ok(
    result.videoData.every((video) => video.borderTop === '0px'),
    'legacy videos should be borderless'
  );
  assert.ok(
    result.captionStyles.length >= result.videoData.length,
    'legacy media should keep visible captions'
  );
  assert.ok(
    result.captionStyles.every(
      (caption) => caption.align === 'center' && caption.size >= 14
    ),
    'legacy captions should be centered and caption-sized'
  );
  assert.equal(result.keycapDisplay, 'inline-block');
  assert.notEqual(result.keycapBorderTop, '0px');
  assert.notEqual(result.keycapBoxShadow, 'none');
  assert.match(result.keycapBackgroundImage, /linear-gradient/);
  assert.match(result.keycapBoxShadow, /inset/);
  assert.equal(result.lightKeycap.backgroundColor, 'rgb(236, 236, 234)');
  assert.equal(result.lightKeycap.borderTopColor, 'rgb(185, 185, 177)');
  assert.equal(result.lightKeycap.borderBottomColor, 'rgb(143, 143, 134)');
  assert.equal(result.lightKeycap.color, 'rgb(34, 34, 34)');
  assert.match(
    result.lightKeycap.backgroundImage,
    /rgba\(255, 255, 255, 0\.42\)/
  );
  assert.match(result.lightKeycap.boxShadow, /rgba\(0, 0, 0, 0\.22\)/);
  assert.equal(result.darkKeycap.backgroundColor, 'rgb(38, 38, 38)');
  assert.equal(result.darkKeycap.borderBottomColor, 'rgb(18, 18, 18)');
  assert.ok(
    colorBrightness(result.darkKeycap.borderBottomColor) <
      colorBrightness(result.darkKeycap.backgroundColor),
    'dark keycap bottom edge should render darker than the key face'
  );
  assert.match(
    result.darkKeycap.backgroundImage,
    /rgba\(255, 255, 255, 0\.07\)/
  );
  assert.match(result.darkKeycap.boxShadow, /rgba\(0, 0, 0, 0\.7\)/);
  assert.ok(result.listData.length > 0, 'legacy article should include lists');
  assert.ok(
    result.listData.some(
      (list) =>
        list.tag === 'OL' && list.paddingLeft >= 39 && list.paddingLeft <= 41
    ),
    'ordered article lists should keep a 40px text gutter'
  );
  assert.ok(
    result.listData.some(
      (list) =>
        list.tag === 'UL' && list.paddingLeft >= 39 && list.paddingLeft <= 41
    ),
    'unordered article lists should keep the same 40px text gutter'
  );
  assert.ok(
    result.listData.every((list) => list.listStyleType === 'none'),
    'top-level article lists should use custom aligned markers'
  );
  assert.ok(
    result.listData.every(
      (list) => list.itemInset >= 39 && list.itemInset <= 41
    ),
    'ordered/unordered list item text columns should align at 40px'
  );
  assert.ok(
    result.listData.every(
      (list) => list.markerStart >= 11 && list.markerStart <= 13
    ),
    'ordered/unordered custom markers should start on the same gutter axis'
  );
  assert.ok(
    result.listData.every(
      (list) => list.markerLeft === -28 && list.markerWidth === 20
    ),
    'ordered/unordered custom markers should share the same marker column'
  );
  assert.ok(
    result.listData.some((list) => list.markerContent.includes('counter')) &&
      result.listData.some((list) => list.markerContent === '"•"'),
    'article lists should render ordered counters and unordered bullets'
  );
  assert.ok(
    result.maxListOverflow <= 1,
    `article lists should stay inside prose width: ${result.maxListOverflow}`
  );
  assert.ok(
    result.detailSummaryTexts.includes('tmux: Terminal multiplexer'),
    'details summaries should preserve the visible label text'
  );
  assert.ok(
    result.detailSummaryEmTexts.every((text) => text.endsWith(':')),
    'details summary colons should live inside the emphasized/link label'
  );
}

async function main() {
  await mkdir(screenshotDir, { recursive: true });

  const nextBin = path.join(root, 'node_modules', '.bin', 'next');
  const useExistingServer = await isServerReady(existingBaseUrl);
  const server = useExistingServer
    ? null
    : spawn(nextBin, ['dev', '-p', String(port)], {
        cwd: root,
        stdio: 'ignore',
        env: {
          ...process.env,
          NEXT_TELEMETRY_DISABLED: '1',
        },
      });

  if (useExistingServer) {
    baseUrl = existingBaseUrl;
  }

  let browser: Browser | null = null;

  try {
    await waitForServer(baseUrl);
    await assertThemeBootstrapBeforeHeader();
    await assertScrollbarStyles();

    browser = await chromium.launch();

    const home = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    await home.goto(baseUrl, { waitUntil: 'networkidle' });
    const homeShell = await assertSitePageShell(home, 'desktop');
    const siteMobileBreakpointWidth = Math.round(
      homeShell.siteMobileBreakpointPx
    );
    const siteDesktopBreakpointWidth = Math.round(
      homeShell.siteDesktopBreakpointPx
    );
    const homeBand = await assertRoybBandPlacement(home);
    await assertHome(home);
    await assertPostTagTypographyAndAlignment(home, 'desktop home');
    await assertVisibleOneLineDescriptions(home);
    await assertHeroLinksHoverHighlight(home);
    await assertWordmarkHoverHighlight(home);
    await assertPublicationTitleUnderline(home);
    await assertExperienceGroupLabelHoverHighlight(home);
    await assertHomeRailHoverAccents(home);
    await assertThemeToggleIsStable(home);
    await screenshot(home, 'home-desktop');
    await assertExperienceInteractions(home);
    await screenshot(home, 'home-experience-expanded');
    await assertExperienceTitleHoverColors(home);

    const darkHome = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    await darkHome.addInitScript(() => {
      window.localStorage.setItem('theme', 'dark');
    });
    await darkHome.goto(baseUrl, { waitUntil: 'networkidle' });
    await assertSitePageShell(darkHome, 'desktop');
    await assertDarkRoybBandBorder(darkHome);
    await screenshot(darkHome, 'home-dark-desktop');

    const mobileBreakpoint = await browser.newPage({
      viewport: { width: siteMobileBreakpointWidth, height: 844 },
    });
    await mobileBreakpoint.goto(baseUrl, { waitUntil: 'networkidle' });
    await assertSitePageShell(mobileBreakpoint, 'mobile');

    const desktopBreakpoint = await browser.newPage({
      viewport: { width: siteDesktopBreakpointWidth, height: 844 },
    });
    await desktopBreakpoint.goto(baseUrl, { waitUntil: 'networkidle' });
    await assertSitePageShell(desktopBreakpoint, 'desktop');

    const mobile = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    await mobile.goto(baseUrl, { waitUntil: 'networkidle' });
    await assertSitePageShell(mobile, 'mobile');
    await assertRoybBandPlacement(mobile);
    await assertExperienceGroupLabelHoverHighlight(mobile);
    await assertMobileHeroContactUnderStory(mobile);
    await assertMobileRailDescriptionsWrap(mobile);
    await assertMobileRailDateLayout({
      page: mobile,
      selector:
        '#experience [data-testid="rail-title"] + span, #writing [data-testid="rail-title"] + span, #publications [data-testid="publication-title-wrap"] + span',
      label: 'mobile home rail dates',
      singleLineDates: ['Oct 2024 - Apr 2025', 'Sep 2025'],
    });
    await assertMobileFooterAlignment(mobile);
    await assertPostTagTypographyAndAlignment(mobile, 'mobile home');
    await screenshot(mobile, 'home-mobile');

    const narrowMobile = await browser.newPage({
      viewport: { width: 320, height: 844 },
    });
    await narrowMobile.goto(baseUrl, { waitUntil: 'networkidle' });
    await assertMobileFooterAlignment(narrowMobile);
    await assertMobileRailDateLayout({
      page: narrowMobile,
      selector:
        '#experience [data-testid="rail-title"] + span, #writing [data-testid="rail-title"] + span, #publications [data-testid="publication-title-wrap"] + span',
      label: 'narrow mobile home rail dates',
      requireActualWrap: true,
    });
    await assertMobileHomeWrappedHighlights(narrowMobile);

    const portraitHidden = await browser.newPage({
      viewport: { width: 700, height: 844 },
    });
    await portraitHidden.goto(baseUrl, { waitUntil: 'networkidle' });
    await assertMobileHeroContactUnderStory(portraitHidden);
    await assertMobileFooterAlignment(portraitHidden);

    const mobileBlog = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    await mobileBlog.goto(`${baseUrl}/blog`, { waitUntil: 'networkidle' });
    await assertMobileBlogWrappedHighlight(mobileBlog);
    await assertMobileRailDateLayout({
      page: mobileBlog,
      selector: '#posts [data-testid="rail-title"] + span',
      label: 'mobile blog index dates',
    });
    await assertPostTagTypographyAndAlignment(mobileBlog, 'mobile blog index');
    await screenshot(mobileBlog, 'blog-index-mobile');

    const blog = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    await blog.goto(`${baseUrl}/blog`, { waitUntil: 'networkidle' });
    const blogBand = await assertRoybBandPlacement(blog);
    await assertBlogIndex(blog);
    await assertPostTagTypographyAndAlignment(blog, 'desktop blog index');
    await assertBlogRailHoverAccents(blog);
    await assertVisibleOneLineDescriptions(blog);
    await screenshot(blog, 'blog-index');

    const article = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    await article.goto(`${baseUrl}/blog/on-agent-memory-fidelity`, {
      waitUntil: 'networkidle',
    });
    const articleBand = await assertRoybBandPlacement(article);
    await assertArticle(article);
    await assertVisibleOneLineDescriptions(article);
    await screenshot(article, 'blog-article');

    const harmoniaArticle = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    await harmoniaArticle.goto(`${baseUrl}/blog/on-dimensions-of-taste`, {
      waitUntil: 'networkidle',
    });
    await assertRoybBandPlacement(harmoniaArticle);
    await assertHarmoniaArticle(harmoniaArticle);
    await assertHarmoniaIframeDarkTheme(harmoniaArticle);
    await screenshot(harmoniaArticle, 'blog-dimensions');

    const legacyArticle = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    await legacyArticle.goto(`${baseUrl}/blog/on-using-computers`, {
      waitUntil: 'networkidle',
    });
    await assertRoybBandPlacement(legacyArticle);
    await assertLegacyMediaArticle(legacyArticle);
    await screenshot(legacyArticle, 'blog-using-computers');

    const fingerspitzenArticle = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    await fingerspitzenArticle.addInitScript(() => {
      window.localStorage.setItem('theme', 'light');
    });
    await fingerspitzenArticle.goto(`${baseUrl}/blog/on-fingerspitzengefuhl`, {
      waitUntil: 'networkidle',
    });
    await assertRoybBandPlacement(fingerspitzenArticle);
    await screenshot(fingerspitzenArticle, 'blog-fingerspitzen-light');
    await assertFingerspitzenArticle(fingerspitzenArticle);
    await screenshot(fingerspitzenArticle, 'blog-fingerspitzen-dark');

    assert.deepEqual(
      [homeBand.topGap, blogBand.topGap, articleBand.topGap],
      [homeBand.topGap, homeBand.topGap, homeBand.topGap],
      'ROYB top gap should be consistent on home, blog index, and article pages'
    );

    console.log(`visual ok: screenshots written to ${screenshotDir}`);
  } finally {
    await browser?.close();
    server?.kill();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
