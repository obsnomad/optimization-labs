import nav from './rinex-nav';
import obs from './rinex-obs';
import calcPosition from './calc-position';

nav.init();
obs.init();
console.log(calcPosition.calc(nav, obs));
