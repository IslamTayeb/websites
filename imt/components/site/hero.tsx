import Image from 'next/image';

import { contactLinks } from '@/data/links';
import { newsItems } from '@/data/news';
import { heroParagraphs, type TextSegment } from '@/data/profile';
import { ExternalLink } from '@/components/primitives/external-link';
import { RailItem, RailList } from '@/components/primitives/rail';
import { SectionHeader } from '@/components/primitives/section';

function ContactDetails() {
  return (
    <div data-testid="hero-contact-details" className="flex flex-col gap-0.5">
      <span className="text-muted-foreground">contact</span>
      <ul className="flex flex-wrap text-foreground">
        {contactLinks.map((link, index) => (
          <li key={link.label}>
            <ExternalLink
              href={link.href}
              section="r"
              className="text-foreground"
            >
              {link.label}
            </ExternalLink>
            {index < contactLinks.length - 1 ? (
              <span className="mr-1">, </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContactIndex() {
  return (
    <div className="flex flex-col gap-2 font-mono text-sm leading-snug">
      <Image
        data-testid="hero-portrait"
        src="/me.webp"
        alt="Portrait of Islam Tayeb"
        width={384}
        height={384}
        priority
        unoptimized
        className="hidden aspect-square w-full max-w-48 bg-background object-cover site-desktop:block site-desktop:max-w-none"
      />
      <ContactDetails />
    </div>
  );
}

function HeroSegment({ segment }: { segment: TextSegment }) {
  if (!segment.href) {
    return segment.text;
  }

  return (
    <ExternalLink href={segment.href} section="r" className="text-foreground">
      {segment.text}
    </ExternalLink>
  );
}

function HeroStory() {
  return (
    <div
      data-testid="hero-story"
      className="reading-copy flex flex-col gap-1.5 text-base leading-snug text-foreground"
    >
      {heroParagraphs.map((paragraph, paragraphIndex) => (
        <p key={paragraphIndex}>
          {paragraph.map((segment, segmentIndex) => (
            <HeroSegment
              key={`${paragraphIndex}-${segmentIndex}`}
              segment={segment}
            />
          ))}
        </p>
      ))}
    </div>
  );
}

function News() {
  return (
    <RailList testId="hero-news" className="mt-3">
      {newsItems.map((item, index) => {
        const isLatest = index === 0;
        const text = item.segments.map((segment) => segment.text).join('');

        return (
          <RailItem
            key={`${item.date}-${text}`}
            testId="hero-news-row"
            dotClassName={isLatest ? 'bg-roy-r' : 'bg-foreground/75'}
            titleClassName="reading-copy font-normal leading-snug site-desktop:truncate"
            title={item.segments.map((segment, segmentIndex) => (
              <HeroSegment key={segmentIndex} segment={segment} />
            ))}
            meta={item.date}
            connector={index < newsItems.length - 1 ? 'solid' : 'none'}
          />
        );
      })}
    </RailList>
  );
}

export function Hero() {
  return (
    <section id="about" data-testid="hero-section" className="pb-4 pt-0">
      <div className="flex w-full flex-col">
        <SectionHeader index="1" title="About" accent="text-roy-r" />
        <h1 className="sr-only">Islam Tayeb</h1>
        <div
          data-testid="hero-content"
          className="flex flex-col gap-3 site-desktop:grid site-desktop:grid-cols-[25%_minmax(0,1fr)] site-desktop:gap-3"
        >
          <div
            data-testid="hero-contact-column"
            className="hidden min-w-0 site-desktop:block site-desktop:border-r site-desktop:border-dotted site-desktop:border-border site-desktop:pr-3"
          >
            <ContactIndex />
          </div>
          <div
            data-testid="hero-story-column"
            className="min-w-0 site-desktop:self-center"
          >
            <HeroStory />
            <div
              data-testid="hero-contact-mobile"
              className="mt-3 font-mono text-sm leading-snug site-desktop:hidden"
            >
              <ContactDetails />
            </div>
          </div>
        </div>
        <News />
      </div>
    </section>
  );
}
