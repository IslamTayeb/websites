import { profileLinks } from './links';

export type TextSegment = {
  text: string;
  href?: string;
  external?: boolean;
};

export const profile = {
  name: 'Islam Tayeb',
  location: 'Durham, NC',
  hometown: 'Egypt',
  email: 'islam.moh.islamm@gmail.com',
  role: 'Duke CS student researching ML systems',
};

export const heroParagraphs: TextSegment[][] = [
  [
    {
      text: "I'm a senior studying Computer Science at ",
    },
    { text: 'Duke University', href: profileLinks.dukeUniversity },
    {
      text: " in Durham, NC. I want AI to be useful for chemistry, so I build the data and eval infrastructure that scientific agents and foundation models need. I'm also interested in systems and verifiers. I currently work with ",
    },
    { text: 'Philip Romero', href: profileLinks.romeroLab },
    { text: ' and ' },
    { text: 'Kevin Yang', href: profileLinks.kevinYang },
    {
      text: ' to extract and build data at scale and study how it affects chemistry foundation models.',
    },
  ],
  [
    {
      text: 'Before that, I used to do organic chemistry research on porous polymers and ',
    },
    { text: 'published a few papers', href: profileLinks.scholar },
    {
      text: '. Then, I transitioned to software engineering to experience startups and worked at ',
    },
    { text: 'Soff (YC S24)', href: profileLinks.soff },
    { text: ', now ' },
    { text: 'Westgate Supply', href: profileLinks.westgateSupply },
    { text: '.' },
  ],
  [
    {
      text: 'I was born and raised in Egypt, but moved to Taif, Saudi Arabia during high school. I like to play ',
    },
    { text: 'Tetris', href: profileLinks.tetris },
    { text: ' and ' },
    { text: 'Monkeytype', href: profileLinks.monkeytype },
    { text: ' in my free time.' },
  ],
  [
    { text: 'In high school, I worked as a graphic designer for an ' },
    { text: 'esports team', href: profileLinks.esports },
    { text: '. I also played ' },
    { text: 'osu!', href: profileLinks.osu },
    { text: ' competitively and designed a ' },
    { text: 'few', href: profileLinks.skinOne },
    { text: ' ' },
    { text: 'skins', href: profileLinks.skinTwo },
    { text: ' (500K+ downloads).' },
  ],
];
