export type FontFormat = 'ttf' | 'woff2';

export type FontSummary = {
  id: string;
  family: string;
  variants: string[];
  subsets: string[];
  category?: string;
  version?: string;
  lastModified?: string;
  popularity?: number;
  defVariant?: string;
};

export type FontVariant = {
  id: string;
  ttf?: string;
  woff2?: string;
};

export type FontDetails = Omit<FontSummary, 'variants'> & {
  variants: FontVariant[];
};

export type InstalledFont = {
  id: string;
  family: string;
  variant: string;
  format: FontFormat;
  path: string;
  installedAt: string;
};

export type Manifest = {
  version: 1;
  fonts: InstalledFont[];
};
