import { splitLangPath, type Lang } from '../i18n/config';
import type { MessageKey } from '../i18n';

export type NavSection = 'home' | 'universities' | 'scholarships' | 'discussions' | 'my';

export interface NavItem {
  section: NavSection;
  labelKey: MessageKey;
  href: string;
}

/** The five main tabs: desktop header and phone bottom bar share this list. */
export function navItems(lang: Lang): NavItem[] {
  return [
    { section: 'home', labelKey: 'nav.home', href: `/${lang}` },
    { section: 'universities', labelKey: 'nav.universities', href: `/${lang}/search` },
    { section: 'scholarships', labelKey: 'nav.scholarships', href: `/${lang}/scholarships` },
    { section: 'discussions', labelKey: 'nav.discussions', href: `/${lang}/discussions` },
    { section: 'my', labelKey: 'nav.my', href: `/${lang}/my` },
  ];
}

const SECTION_PREFIXES: [prefix: string, section: NavSection][] = [
  ['/search', 'universities'],
  ['/universities', 'universities'],
  ['/programs', 'universities'],
  ['/colleges', 'universities'],
  ['/compare', 'universities'],
  ['/scholarships', 'scholarships'],
  ['/discussions', 'discussions'],
  ['/my', 'my'],
];

/** Which main tab a pathname belongs to, for `aria-current` and the active style. */
export function activeSection(pathname: string): NavSection | null {
  const { rest } = splitLangPath(pathname);
  if (rest === '') return 'home';
  for (const [prefix, section] of SECTION_PREFIXES) {
    if (rest === prefix || rest.startsWith(`${prefix}/`)) return section;
  }
  return null;
}
