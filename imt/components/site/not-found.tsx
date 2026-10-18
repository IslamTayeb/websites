import { NotFoundPath } from '@/components/site/not-found-path';

const buttonBase =
  'inline-flex items-center justify-center border px-3 py-1.5 font-mono text-sm leading-none outline-none focus-visible:ring-1 focus-visible:ring-ring';

export function NotFound() {
  return (
    <div
      data-testid="not-found-stage"
      data-not-found="true"
      className="flex flex-1 items-center justify-center py-12"
    >
      <div
        role="dialog"
        aria-labelledby="not-found-title"
        data-testid="not-found-dialog"
        className="w-full max-w-md border border-[var(--page-rule)] bg-background shadow-[6px_6px_0_var(--page-shadow)]"
      >
        <div className="flex items-baseline justify-between gap-4 border-b border-[var(--page-rule)] px-3 py-2 font-mono text-sm uppercase tracking-[0.2em]">
          <h1 id="not-found-title" className="font-bold text-foreground">
            <span className="mr-2 inline-block">§?</span>Not found
          </h1>
          <span className="text-muted-foreground">404</span>
        </div>
        <div
          aria-hidden="true"
          className="royb-band h-[5px] w-full border-b border-[var(--page-rule)]"
        />
        <div className="flex flex-col gap-3 px-4 pb-4 pt-4">
          <p className="text-base font-semibold leading-tight text-foreground">
            Nothing lives at this address.
          </p>
          <p className="border border-dotted border-[var(--tag-rule)] bg-[var(--tag-background)] px-2 py-1.5 leading-tight text-foreground [overflow-wrap:anywhere]">
            <NotFoundPath />
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            <a
              href="/"
              className={`${buttonBase} border-foreground bg-foreground text-background hover:border-roy-r hover:bg-roy-r`}
            >
              back to islam
            </a>
            <a
              href="/blog"
              className={`${buttonBase} border-foreground bg-background text-foreground hover:border-roy-b hover:text-roy-b`}
            >
              browse the blog
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
