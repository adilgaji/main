import {useId} from 'react';

/** Уникальный id для <clipPath>/<defs>, безопасный для url(#...). */
export const useSvgId = (prefix: string) => `${prefix}-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
