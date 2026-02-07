import kleur from 'kleur';
import { format } from 'util';

/**
 * @param {...any} msg
 */
export const error = (...msg) =>
  console.error(kleur.bold().red('🚨 ' + msg.map(($) => format($)).join(' ')));

/**
 * @param {...any} msg
 */
export const info = (...msg) => console.log('✨', ...msg.map(($) => format($)));
