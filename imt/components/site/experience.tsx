import type { ReactNode } from 'react';
import { experienceGroups, type ExperienceGroup } from '@/data/experience';
import { ExternalLink } from '@/components/primitives/external-link';
import {
  OrgMark,
  orgMarkBalancedHeight,
} from '@/components/primitives/org-marks';
import { RailItem, RailList } from '@/components/primitives/rail';
import { RichText } from '@/components/primitives/rich-text';
import { RoybLinkText } from '@/components/primitives/royb-link';
import { BorderedPanel, Section } from '@/components/primitives/section';
import { cn } from '@/lib/utils';

type DescriptionSegment =
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'link';
      text: string;
      href: string;
    };

function AdvisorLabel({
  role,
  boxed,
}: {
  role: ExperienceGroup['roles'][number];
  boxed: boolean;
}) {
  if (!role.piName) {
    return null;
  }

  const className = cn(
    'reading-copy text-base font-normal leading-tight text-muted-foreground',
    role.href &&
      'group-hover/experience-title:text-roy-o group-focus-visible/experience-title:text-roy-o',
    boxed && 'inline-block border border-border px-1'
  );

  if (role.piHref && !role.href) {
    return (
      <ExternalLink
        href={role.piHref}
        section="o"
        className={className}
        data-testid="advisor-label"
        data-boxed={boxed ? 'true' : undefined}
      >
        {role.piName}
      </ExternalLink>
    );
  }

  return (
    <span
      className={className}
      data-testid="advisor-label"
      data-boxed={boxed ? 'true' : undefined}
    >
      {role.piName}
    </span>
  );
}

function RailGroup({
  group,
  boxedAdvisorLabels,
}: {
  group: ExperienceGroup;
  boxedAdvisorLabels: boolean;
}) {
  const roles = group.roles;
  const markerHeights = roles.map((role) =>
    role.orgKey ? orgMarkBalancedHeight(role.orgKey, 12) : undefined
  );

  return (
    <RailList>
      {roles.map((role, index) => {
        const state = role.state ?? (role.incoming ? 'incoming' : 'ended');
        // Org marks take the dot's colors as text color; present and incoming
        // are both solid orange, ended is the neutral dot color.
        const dotClassName = role.orgKey
          ? state === 'ended'
            ? 'text-foreground/75'
            : 'text-roy-o'
          : state === 'incoming'
            ? 'border border-roy-o bg-background'
            : state === 'present'
              ? 'bg-roy-o'
              : 'bg-foreground/75';
        const markerHeight = markerHeights[index];
        const marker = role.orgKey ? (
          <OrgMark
            org={role.orgKey}
            size={markerHeight}
            fit="height"
            className="block max-w-none shrink-0"
          />
        ) : undefined;
        const titleContent: ReactNode = role.piName ? (
          <>
            {role.org} <AdvisorLabel role={role} boxed={boxedAdvisorLabels} />
          </>
        ) : (
          role.org
        );
        const connector = index < roles.length - 1 ? 'solid' : 'none';

        return (
          <RailItem
            key={`${group.kind}-${role.org}-${role.piName ?? role.org}-${role.date}`}
            dotClassName={dotClassName}
            marker={marker}
            markerHeight={markerHeight}
            nextMarkerHeight={markerHeights[index + 1]}
            hoverAccent={state === 'ended' ? 'o' : undefined}
            incoming={role.incoming}
            state={state}
            title={
              role.href ? (
                <ExternalLink
                  href={role.href}
                  section="o"
                  data-rail-hover-source={
                    state === 'ended' ? 'true' : undefined
                  }
                  data-testid="experience-title-run"
                  className="group/experience-title whitespace-break-spaces text-foreground"
                >
                  {titleContent}
                </ExternalLink>
              ) : (
                <span
                  data-testid="experience-title-run"
                  className="group/experience-title inline whitespace-break-spaces text-foreground"
                >
                  {titleContent}
                </span>
              )
            }
            meta={role.date}
            description={
              role.descLinks?.length ? (
                <LinkedDescription
                  text={role.desc}
                  links={role.descLinks}
                  section="o"
                />
              ) : (
                <RichText text={role.desc} />
              )
            }
            wrapDescription
            descriptionLines={role.descLines?.map((line) => (
              <span key={`${line.label ?? ''}:${line.text}`}>
                {line.label ? (
                  <>
                    <em
                      data-testid="experience-line-label"
                      className="text-muted-foreground"
                    >
                      {line.label}:
                    </em>{' '}
                  </>
                ) : null}
                {line.links?.length ? (
                  <LinkedDescription
                    text={line.text}
                    links={line.links}
                    section="o"
                  />
                ) : (
                  <RichText text={line.text} />
                )}
              </span>
            ))}
            connector={connector}
          />
        );
      })}
    </RailList>
  );
}

function LinkedDescription({
  text,
  links,
  section,
}: {
  text: string;
  links: NonNullable<ExperienceGroup['roles'][number]['descLinks']>;
  section: 'o' | 'y';
}) {
  const renderStaticText = (value: string) => {
    return value;
  };

  const segments = links.reduce<DescriptionSegment[]>(
    (currentSegments, link) =>
      currentSegments.flatMap((segment) => {
        if (segment.type === 'link' || !segment.text.includes(link.text)) {
          return [segment];
        }

        const [before, ...afterParts] = segment.text.split(link.text);
        const after = afterParts.join(link.text);

        return [
          ...(before ? [{ type: 'text' as const, text: before }] : []),
          { type: 'link' as const, text: link.text, href: link.href },
          ...(after ? [{ type: 'text' as const, text: after }] : []),
        ];
      }),
    [{ type: 'text', text }]
  );

  return (
    <>
      {segments.map((segment, index) =>
        segment.type === 'link' ? (
          <ExternalLink
            key={`${segment.text}-${index}`}
            href={segment.href}
            section={section}
          >
            {segment.text}
          </ExternalLink>
        ) : (
          <span key={`text-${index}`}>
            <RichText text={renderStaticText(segment.text)} />
          </span>
        )
      )}
    </>
  );
}

function FilledDisclosureArrow() {
  return (
    <span
      data-testid="experience-group-arrow"
      className="royb-link-hover-icon section-color-o inline-flex h-[var(--rail-marker-size)] w-[var(--rail-marker-size)] items-center justify-center text-current"
      aria-hidden
    >
      <span className="block h-0 w-0 border-y-[5px] border-l-[7px] border-y-transparent border-l-current group-open/experience-group:hidden" />
      <span className="hidden h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-current group-open/experience-group:block" />
    </span>
  );
}

function experienceGroupLabel(kind: ExperienceGroup['kind']) {
  return kind[0].toUpperCase() + kind.slice(1);
}

// A native <details>, so groups open and close without any page script.
function RailGroupBlock({
  group,
  open,
  isLast,
  boxedAdvisorLabels,
}: {
  group: ExperienceGroup;
  open: boolean;
  isLast: boolean;
  boxedAdvisorLabels: boolean;
}) {
  const label = experienceGroupLabel(group.kind);

  return (
    <details
      open={open}
      data-testid="experience-group"
      data-group={group.kind}
      className="group/experience-group mb-0.5 flex flex-col last:mb-0 open:mb-2.5 open:last:mb-0"
    >
      <summary
        data-testid="experience-group-toggle"
        className={cn(
          'royb-link-hover-scope group/experience-toggle inline-grid w-fit max-w-full list-none grid-cols-[var(--rail-gutter)_max-content] items-center text-left font-mono text-sm tracking-normal text-muted-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring [&::-webkit-details-marker]:hidden',
          isLast ? 'pb-0 group-open/experience-group:pb-2' : 'pb-2'
        )}
      >
        <FilledDisclosureArrow />
        <RoybLinkText
          data-testid="experience-group-label"
          data-group={group.kind}
          className="w-fit justify-self-start"
          section="o"
        >
          <span
            data-testid="experience-group-label-name"
            className="uppercase tracking-[0.2em]"
          >
            {label}
          </span>
        </RoybLinkText>
      </summary>
      <RailGroup group={group} boxedAdvisorLabels={boxedAdvisorLabels} />
    </details>
  );
}

export function Experience({
  boxedAdvisorLabels = false,
}: {
  boxedAdvisorLabels?: boolean;
} = {}) {
  return (
    <Section
      id="experience"
      index="2"
      title="Experience"
      accent="text-roy-o"
      divided
    >
      <BorderedPanel>
        <div className="flex w-full flex-col">
          {experienceGroups.map((group, index) => (
            <RailGroupBlock
              key={group.kind}
              group={group}
              open={group.kind === 'research'}
              isLast={index === experienceGroups.length - 1}
              boxedAdvisorLabels={boxedAdvisorLabels}
            />
          ))}
        </div>
      </BorderedPanel>
    </Section>
  );
}
