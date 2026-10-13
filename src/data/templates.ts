import rawTemplates from './generated/templates.json';
import type { Template } from '../planner/model';

/** Sample farms that ship with the app (built by scripts/build-templates.ts). */
export const TEMPLATES = rawTemplates as unknown as Template[];
