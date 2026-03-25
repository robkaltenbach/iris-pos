// Global font style constant
export const defaultTextStyle = {
  fontFamily: 'RobotoCondensed_400Regular',
};

// Helper to merge default font with custom styles
export const withDefaultFont = (style: any) => {
  if (Array.isArray(style)) {
    return [defaultTextStyle, ...style];
  }
  return [defaultTextStyle, style];
};

