import kleur from 'kleur';
import { format } from 'util';

export const error = (...msg: any[]) =>
  console.error(kleur.bold().red('🚨 ' + msg.map(($) => format($)).join(' ')));

export const info = (...msg: any[]) =>
  console.log('✨', ...msg.map(($) => format($)));
