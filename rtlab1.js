import cTable from 'console.table';
import nav from './rinex-nav';
import {createWriteStream} from 'fs';
import config from './config';

const getTable = data => {
    let result = [];
    for (let i of Object.keys(data)) {
        const item = data[i];
        result.push({
            'Время': item.date,
            'Δx': item.dx,
            'Δy': item.dy,
            'Δz': item.dz,
        });
    }
    return cTable.getTable(result);
};

const stream = createWriteStream(config.output);

nav.init();
nav.checkData();

for (let i of Object.keys(nav.checkedData)) {
    stream.write(`Навигационный спутник №${parseInt(i.substr(2))}\n\n`);
    stream.write(getTable(nav.checkedData[i]));
}
