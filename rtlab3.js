import nav from './rinex-nav';
import obs from './rinex-obs';
import calcPosition from './calc-position';

nav.init();
obs.initCompare();
console.log(calcPosition.calcCompare(nav, obs));
