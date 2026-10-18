/**
 * Shows the address the visitor actually asked for. The 404 page is
 * prerendered once, so the path is filled in by an inline script.
 */
export function NotFoundPath() {
  return (
    <>
      <span data-testid="not-found-path" className="font-mono text-sm">
        /…
      </span>
      <script
        dangerouslySetInnerHTML={{
          __html:
            'document.querySelector(\'[data-testid="not-found-path"]\').textContent=location.pathname;',
        }}
      />
    </>
  );
}
