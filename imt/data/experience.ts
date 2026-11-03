import type { OrgKey } from '@/components/primitives/org-marks';

type DescriptionLink = {
  text: string;
  href: string;
};

type DescriptionLine = {
  // Italic lead-in rendered before `text`, without its trailing colon.
  label?: string;
  text: string;
  links?: DescriptionLink[];
};

type ExperienceRole = {
  org: string;
  orgKey?: OrgKey;
  piName?: string;
  piHref?: string;
  date: string;
  desc: string;
  descLinks?: DescriptionLink[];
  // Extra rows rendered under `desc`, each on its own one-line row.
  descLines?: DescriptionLine[];
  href?: string;
  incoming?: boolean;
  state?: 'present' | 'ended' | 'incoming';
};

export type ExperienceGroup = {
  kind: 'research' | 'engineering' | 'teaching' | 'open-source';
  roles: ExperienceRole[];
};

export const experienceGroups: ExperienceGroup[] = [
  {
    kind: 'research',
    roles: [
      /*
      {
        org: 'Duke University',
        orgKey: 'duke',
        piName: 'Christian Dallago',
        date: 'Incoming Aug 2026',
        href: 'https://machine.learning.bio/',
        incoming: true,
        state: 'incoming',
        desc: 'GPU acceleration of protein search',
      },
      */
      {
        org: 'Duke University',
        orgKey: 'duke',
        piName: 'Philip Romero',
        date: 'Aug 2025 - Present',
        href: 'https://www.romerolab.org/',
        state: 'present',
        desc: 'Agents for chemical reaction data extraction and analysis',
        descLines: [
          {
            label: 'Collabs & Grants',
            text: 'Microsoft Research + Anthropic (AI for Science Program)',
            links: [
              {
                text: 'Microsoft Research',
                href: 'https://www.microsoft.com/en-us/research/people/kevyan/',
              },
              {
                text: 'Anthropic (AI for Science Program)',
                href: 'https://www.anthropic.com/news/ai-for-science-program',
              },
            ],
          },
          {
            label: 'Outputs',
            text: 'AI Scientist Summer Workshop (Poster)',
            links: [
              {
                text: 'AI Scientist Summer Workshop',
                href: 'https://ai-scientist-workshop.github.io/',
              },
            ],
          },
        ],
      },
      {
        org: 'Duke University',
        orgKey: 'duke',
        piName: 'Navid NaderiAlizadeh',
        date: 'Oct 2024 - Apr 2025',
        href: 'https://sites.duke.edu/navid/',
        state: 'ended',
        desc: 'Continual learning for antibody affinity prediction',
        descLines: [
          {
            label: 'Outputs',
            text: 'Preprint',
            links: [
              {
                text: 'Preprint',
                href: 'https://doi.org/10.13140/RG.2.2.11182.98880',
              },
            ],
          },
        ],
      },
      {
        org: 'KFUPM',
        orgKey: 'kfupm',
        piName: 'Mahmoud Abdelnaby',
        date: 'Jul 2022 - Aug 2023',
        href: 'https://scholar.google.com/citations?user=BLMFawMAAAAJ&hl=en',
        state: 'ended',
        desc: 'Polymer property prediction and synthesis for CO₂ capture',
        descLines: [
          {
            label: 'Collabs & Grants',
            text: 'Saudi Aramco',
            links: [
              {
                text: 'Saudi Aramco',
                href: 'https://www.aramco.com/',
              },
            ],
          },
          {
            label: 'Outputs',
            text: '3 publications @ Q1 journals in applied ML, organic synthesis, and a review',
            links: [
              {
                text: 'applied ML',
                href: 'https://doi.org/10.1016/j.jece.2025.119315',
              },
              {
                text: 'organic synthesis',
                href: 'https://doi.org/10.1016/j.jcou.2023.102647',
              },
              {
                text: 'a review',
                href: 'https://doi.org/10.1002/tcr.202400188',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    kind: 'engineering',
    roles: [
      {
        org: 'Soff (YC S24)',
        orgKey: 'soff',
        date: 'May 2025 - Oct 2025',
        href: 'https://www.ycombinator.com/companies/soff',
        state: 'ended',
        desc: 'Agentic sales intelligence for manufacturers, employee #2',
      },
      {
        org: 'Duke Impact Investing Group',
        orgKey: 'diig',
        date: 'Sep 2024 - May 2025',
        href: 'https://dukeimpact.com/',
        state: 'ended',
        desc: 'Non-linear RNA-seq analysis for CRISPR experiments',
        descLines: [
          {
            label: 'Collabs',
            text: 'Life Edit Therapeutics',
            links: [
              {
                text: 'Life Edit Therapeutics',
                href: 'https://lifeeditinc.com/',
              },
            ],
          },
        ],
      },
      {
        org: 'Duke Institute for Health Innovation',
        orgKey: 'dihi',
        date: 'Jun 2024 - Aug 2024',
        href: 'https://dihi.org/',
        state: 'ended',
        desc: 'Automated literature review agents + VTE detection',
      },
    ],
  },
  {
    kind: 'teaching',
    roles: [
      {
        org: 'Operating Systems',
        orgKey: 'duke',
        piName: 'Matthew Lentz',
        date: 'Aug 2026 - Dec 2026',
        href: 'https://courses.cs.duke.edu/fall26/compsci310/',
        state: 'present',
        desc: 'Leading a discussion section + office hours',
      },
      {
        org: 'Computer Systems',
        orgKey: 'duke',
        piName: 'Matthew Lentz',
        date: 'Jan 2026 - May 2026',
        href: 'https://courses.cs.duke.edu/spring26/compsci210d/',
        state: 'ended',
        desc: 'Led a discussion section + office hours',
      },
      {
        org: 'Organic Chemistry I',
        orgKey: 'duke',
        piName: 'SAGE Tutor',
        href: 'https://arc.duke.edu/peer-education/',
        date: 'Jan 2025 - May 2025',
        state: 'ended',
        desc: 'Led a study group, saw kids quit pre-med as the semester went',
      },
    ],
  },
  {
    kind: 'open-source',
    roles: [
      {
        org: 'Raycast',
        orgKey: 'raycast',
        date: 'Oct 2025 - Present',
        href: 'https://www.raycast.com/islamtayeb/helium',
        state: 'present',
        desc: 'Made Helium, browser tab control (2.2K+ downloads)',
        descLinks: [
          {
            text: 'Helium',
            href: 'https://github.com/raycast/extensions/tree/main/extensions/helium',
          },
        ],
        descLines: [
          {
            label: 'Contributions',
            text: 'Messages (54K) + Paste as Plain Text (28K)',
            links: [
              {
                text: 'Messages',
                href: 'https://github.com/raycast/extensions/pull/29342',
              },
              {
                text: 'Paste as Plain Text',
                href: 'https://github.com/raycast/extensions/pull/31379',
              },
            ],
          },
        ],
      },
    ],
  },
];
