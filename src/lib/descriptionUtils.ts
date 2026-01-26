/**
 * Utility functions for processing receipt descriptions
 */

export interface DescriptionSettings {
  max_length: number;
  separator: string;
  truncate_suffix: string;
  include_quantities: boolean;
}

export const DEFAULT_DESCRIPTION_SETTINGS: DescriptionSettings = {
  max_length: 100,
  separator: ', ',
  truncate_suffix: '...',
  include_quantities: false,
};

/**
 * Escapes special regex characters in a string
 */
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Processes and cleans up a raw description from AI extraction
 * @param rawDescription - The raw description from AI
 * @param settings - User's description settings
 * @returns Cleaned and formatted description
 */
export function processDescription(
  rawDescription: string | null | undefined,
  settings: DescriptionSettings = DEFAULT_DESCRIPTION_SETTINGS
): string {
  if (!rawDescription) return '';
  
  let description = rawDescription.trim();
  
  // Replace line breaks with separator
  description = description.replace(/[\n\r]+/g, settings.separator);
  
  // Clean up multiple spaces
  description = description.replace(/\s+/g, ' ');
  
  // Clean up multiple separators
  const separatorRegex = new RegExp(`(${escapeRegex(settings.separator.trim())}\\s*)+`, 'g');
  description = description.replace(separatorRegex, settings.separator);
  
  // Remove leading/trailing separators
  const trimSeparatorRegex = new RegExp(
    `^${escapeRegex(settings.separator.trim())}\\s*|\\s*${escapeRegex(settings.separator.trim())}$`,
    'g'
  );
  description = description.replace(trimSeparatorRegex, '').trim();
  
  // Truncate if necessary
  if (description.length > settings.max_length) {
    // Calculate available space for content
    const maxContentLength = settings.max_length - settings.truncate_suffix.length;
    let truncated = description.substring(0, maxContentLength);
    
    // Find last separator or space to cut at word boundary
    const lastSeparator = truncated.lastIndexOf(settings.separator.trim());
    const lastSpace = truncated.lastIndexOf(' ');
    const cutPoint = Math.max(lastSeparator, lastSpace);
    
    // Only use cut point if it's not too early (at least 50% of content)
    if (cutPoint > maxContentLength * 0.5) {
      truncated = truncated.substring(0, cutPoint);
    }
    
    description = truncated.trim() + settings.truncate_suffix;
  }
  
  return description;
}

/**
 * Validates description settings object
 */
export function validateDescriptionSettings(settings: unknown): DescriptionSettings {
  if (!settings || typeof settings !== 'object') {
    return DEFAULT_DESCRIPTION_SETTINGS;
  }
  
  const s = settings as Record<string, unknown>;
  
  return {
    max_length: typeof s.max_length === 'number' && s.max_length > 0 ? s.max_length : DEFAULT_DESCRIPTION_SETTINGS.max_length,
    separator: typeof s.separator === 'string' ? s.separator : DEFAULT_DESCRIPTION_SETTINGS.separator,
    truncate_suffix: typeof s.truncate_suffix === 'string' ? s.truncate_suffix : DEFAULT_DESCRIPTION_SETTINGS.truncate_suffix,
    include_quantities: typeof s.include_quantities === 'boolean' ? s.include_quantities : DEFAULT_DESCRIPTION_SETTINGS.include_quantities,
  };
}
