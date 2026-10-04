import path from 'node:path';

type CodeLink = {
  label: string;
  href: string;
};

type PostImage = {
  filename: string;
  alt: string;
};

type VideoInsert = {
  beforeHeadingId: string;
  filename: string;
  captionHtml: string;
  ariaLabel: string;
};

const postKinds = ['technical'] as const;
export type PostKind = (typeof postKinds)[number];

export type PostManifest = {
  slug: string;
  source: string;
  title: string;
  publishedAt: string;
  updatedAt: string;
  listed: boolean;
  kind: PostKind | null;
  allowHtml: boolean;
  wrapTables: boolean;
  codeLink: CodeLink | null;
  socialImage: string | null;
  images: PostImage[];
  videoInserts: VideoInsert[];
};

const allowedTopLevelFields = new Set([
  'slug',
  'source',
  'title',
  'publishedAt',
  'updatedAt',
  'listed',
  'kind',
  'allowHtml',
  'wrapTables',
  'codeLink',
  'socialImage',
  'images',
  'videoInserts',
]);

function issueList(label: string, issues: string[]) {
  return `${label}\n${issues.map((issue) => `- ${issue}`).join('\n')}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidDateString(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(new Date(value).getTime());
}

function validateStringField(issues: string[], value: unknown, field: string) {
  if (!isNonEmptyString(value)) {
    issues.push(`${field} must be a non-empty string`);
  }
}

function validateDateField(issues: string[], value: unknown, field: string) {
  if (!isValidDateString(value)) {
    issues.push(`${field} must be a valid date string`);
  }
}

function validatePostKind(issues: string[], value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string' || !postKinds.includes(value as PostKind)) {
    issues.push(`kind must be one of: ${postKinds.join(', ')}`);
    return null;
  }

  return value as PostKind;
}

function validateCodeLink(issues: string[], value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }

  if (!isPlainObject(value)) {
    issues.push('codeLink must be an object when present');
    return null;
  }

  validateStringField(issues, value.label, 'codeLink.label');
  validateStringField(issues, value.href, 'codeLink.href');

  return {
    label: String(value.label),
    href: String(value.href),
  };
}

function validateImages(issues: string[], value: unknown) {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    issues.push('images must be an array when present');
    return [];
  }

  return value.map((image, index) => {
    if (!isPlainObject(image)) {
      issues.push(`images[${index}] must be an object`);
      return { filename: '', alt: '' };
    }

    validateStringField(issues, image.filename, `images[${index}].filename`);
    validateStringField(issues, image.alt, `images[${index}].alt`);

    return {
      filename: String(image.filename),
      alt: String(image.alt),
    };
  });
}

function validateVideoInserts(issues: string[], value: unknown) {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    issues.push('videoInserts must be an array when present');
    return [];
  }

  return value.map((insert, index) => {
    if (!isPlainObject(insert)) {
      issues.push(`videoInserts[${index}] must be an object`);
      return {
        beforeHeadingId: '',
        filename: '',
        captionHtml: '',
        ariaLabel: '',
      };
    }

    validateStringField(
      issues,
      insert.beforeHeadingId,
      `videoInserts[${index}].beforeHeadingId`
    );
    validateStringField(
      issues,
      insert.filename,
      `videoInserts[${index}].filename`
    );
    validateStringField(
      issues,
      insert.captionHtml,
      `videoInserts[${index}].captionHtml`
    );
    validateStringField(
      issues,
      insert.ariaLabel,
      `videoInserts[${index}].ariaLabel`
    );

    return {
      beforeHeadingId: String(insert.beforeHeadingId),
      filename: String(insert.filename),
      captionHtml: String(insert.captionHtml),
      ariaLabel: String(insert.ariaLabel),
    };
  });
}

export function validatePostManifest(raw: unknown, manifestPath: string) {
  const issues: string[] = [];
  const manifestLabel = path.relative(process.cwd(), manifestPath);

  if (!isPlainObject(raw)) {
    throw new Error(`${manifestLabel} must contain a JSON object`);
  }

  for (const field of Object.keys(raw)) {
    if (!allowedTopLevelFields.has(field)) {
      issues.push(`unknown field: ${field}`);
    }
  }

  validateStringField(issues, raw.slug, 'slug');
  validateStringField(issues, raw.source, 'source');
  validateStringField(issues, raw.title, 'title');
  validateDateField(issues, raw.publishedAt, 'publishedAt');
  validateDateField(issues, raw.updatedAt, 'updatedAt');

  if (
    isNonEmptyString(raw.slug) &&
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw.slug)
  ) {
    issues.push('slug must be lowercase kebab-case');
  }

  if (isNonEmptyString(raw.source) && !raw.source.endsWith('.md')) {
    issues.push('source must point to a Markdown file ending in .md');
  }

  if (
    isValidDateString(raw.publishedAt) &&
    isValidDateString(raw.updatedAt) &&
    new Date(raw.updatedAt) < new Date(raw.publishedAt)
  ) {
    issues.push('updatedAt must not be earlier than publishedAt');
  }

  if (
    raw.socialImage !== undefined &&
    raw.socialImage !== null &&
    !isNonEmptyString(raw.socialImage)
  ) {
    issues.push('socialImage must be a non-empty string or null');
  }

  if (raw.listed !== undefined && typeof raw.listed !== 'boolean') {
    issues.push('listed must be a boolean when present');
  }

  if (raw.allowHtml !== undefined && typeof raw.allowHtml !== 'boolean') {
    issues.push('allowHtml must be a boolean when present');
  }

  if (raw.wrapTables !== undefined && typeof raw.wrapTables !== 'boolean') {
    issues.push('wrapTables must be a boolean when present');
  }

  const codeLink = validateCodeLink(issues, raw.codeLink);
  const kind = validatePostKind(issues, raw.kind);
  const images = validateImages(issues, raw.images);
  const videoInserts = validateVideoInserts(issues, raw.videoInserts);

  if (issues.length > 0) {
    throw new Error(
      issueList(`Invalid post manifest: ${manifestLabel}`, issues)
    );
  }

  return {
    slug: String(raw.slug),
    source: String(raw.source),
    title: String(raw.title),
    publishedAt: String(raw.publishedAt),
    updatedAt: String(raw.updatedAt),
    listed: typeof raw.listed === 'boolean' ? raw.listed : true,
    kind,
    allowHtml: typeof raw.allowHtml === 'boolean' ? raw.allowHtml : false,
    wrapTables: typeof raw.wrapTables === 'boolean' ? raw.wrapTables : true,
    codeLink,
    socialImage: isNonEmptyString(raw.socialImage) ? raw.socialImage : null,
    images,
    videoInserts,
  } satisfies PostManifest;
}
