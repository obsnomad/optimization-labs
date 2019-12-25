import {readFileSync} from 'fs';
import config from './config';
import {parseDate, parseNumbers} from './helper';

export default {
    obsData: [],

    header: {
        startRow: null,
        position: [],
        paramsAmount: null,
        rowsAmount: null,
        params: [],
    },

    data: {},

    init() {
        this.obsData = readFileSync(config.obs).toString().split('\n');
        this.parseHeader();
        this.parseData();
    },

    parseHeader() {
        let row = 0;
        while (this.obsData[row].indexOf('END OF HEADER') < 0) {
            const line = this.obsData[row];
            const value = line.substr(0, 60);
            const name = line.substr(60).trim();
            switch (name) {
                case 'APPROX POSITION XYZ':
                    this.header.position = parseNumbers(value);
                    break;
                case '# / TYPES OF OBSERV':
                    if (this.header.paramsAmount === null) {
                        const match = value.match(/\d+/);
                        if (Array.isArray(match)) {
                            this.header.paramsAmount = parseInt(match[0]);
                            this.header.rowsAmount = Math.ceil(this.header.paramsAmount / 5);
                        }
                    }
                    this.header.params = [...this.header.params, ...value.match(/\w\d/g)];
                    break;
            }
            row++;
        }
        this.header.startRow = ++row;
    },

    parseData() {
        let row = this.header.startRow;
        let block = {};
        let satRow = row;
        let satIndex = -1;
        for (let row = this.header.startRow; row < this.obsData.length; row++) {
            const line = this.obsData[row];
            if (line.length === 0) {
                continue;
            }
            // Поиск спутников в строке
            let sat = line.match(/((G|R|S)\d{2})/g);
            if (sat) {
                // Если уже заносились данные, значит это новый блок
                if (block.dataReceived) {
                    delete (block.dataReceived);
                    satRow = row;
                    satIndex = -1;
                    if (block.date.toUTCString() === config.Tpc.toUTCString()) {
                        block.sat = block.sat
                            .filter(item => item.type === 'G')
                            .map(sat => {
                                let data = {};
                                this.header.params.forEach((param, index) => {
                                    data[param] = sat.data[index] !== undefined ? sat.data[index] : null;
                                });
                                sat.data = data;
                                return sat;
                            });
                        this.data = block;
                    }
                    block = {};
                }
                // Получение даты
                if (block.date === undefined) {
                    block.date = parseDate(parseNumbers(line));
                    block.time = block.date.getUTCHours() * 3600 + block.date.getUTCMinutes() * 60 + block.date.getUTCSeconds();
                    block.timeMod = block.time + 86400;
                }
                // Запись типа и номера спутников
                if (block.sat === undefined) {
                    block.sat = [];
                }
                sat.forEach(item => {
                    block.sat.push({
                        type: item.substr(0, 1),
                        num: parseInt(item.substr(1)),
                        data: [],
                    });
                });
                satRow++;
            } else {
                block.dataReceived = true;
                if ((row - satRow) % this.header.rowsAmount === 0) {
                    satIndex++;
                }
                for (let i = 0; i < 5; i++) {
                    let item = line.substr(i * 16, 16).trim().split(' ')[0];
                    block.sat[satIndex].data.push(item.length > 0 ? parseFloat(item) : null);
                }
            }
        }
    },
}
