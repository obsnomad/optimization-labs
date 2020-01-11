import {readFileSync} from 'fs';
import config from './config';
import {parseDate, parseNumbers} from './helper';

export default {
    obsData: [],
    obsDataCompare: [],

    header: {
        startRow: null,
        position: [],
        paramsAmount: null,
        rowsAmount: null,
        params: [],
    },
    headerCompare: {
        startRow: null,
        position: [],
        paramsAmount: null,
        rowsAmount: null,
        params: [],
    },

    data: {},
    dataCompare: {},

    init() {
        this.obsData = readFileSync(config.obs).toString().split('\n');
        this.parseHeader(this.obsData);
        this.parseData();
    },

    initCompare() {
        this.obsData = readFileSync(config.obs1).toString().split('\n');
        this.obsDataCompare = readFileSync(config.obs2).toString().split('\n');
        this.parseHeader();
        this.parseHeader(true);
        this.parseCompareData();
    },

    parseHeader(compare = false) {
        let row = 0;
        let header = compare ? this.header : this.headerCompare;
        let obsData = compare ? this.obsData : this.obsDataCompare;
        while (obsData[row].indexOf('END OF HEADER') < 0) {
            const line = obsData[row];
            const value = line.substr(0, 60);
            const name = line.substr(60).trim();
            switch (name) {
                case 'APPROX POSITION XYZ':
                    header.position = parseNumbers(value);
                    break;
                case '# / TYPES OF OBSERV':
                    if (header.paramsAmount === null) {
                        const match = value.match(/\d+/);
                        if (Array.isArray(match)) {
                            header.paramsAmount = parseInt(match[0]);
                            header.rowsAmount = Math.ceil(header.paramsAmount / 5);
                        }
                    }
                    header.params = [...header.params, ...value.match(/\w\d/g)];
                    break;
            }
            row++;
        }
        header.startRow = ++row;
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
            let sat = line.match(/((G|R|S|E)\d{2})/g);
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

    parseCompareData() {
        this.data = this.parseDataD(this.header, this.obsData);
        this.dataCompare = this.parseDataD(this.headerCompare, this.obsDataCompare);
    },

    parseDataD(header, obsData) {
        const date = parseDate(parseNumbers(obsData[header.startRow].substr(1, 25)));
        const time = date.getUTCHours() * 3600 + date.getUTCMinutes() * 60 + date.getUTCSeconds();
        const sat = obsData[header.startRow].match(/((G|R|S|E)\d{2})/g);
        let block = {
            date,
            time,
            timeMod: time + 86400,
            sat: [],
            satNum: [],
        };
        sat.forEach((item, index) => {
            const line = obsData[index + header.startRow + 2].split(' ');
            let satData = {
                type: item.substr(0, 1),
                num: parseInt(item.substr(1)),
                data: [],
            };
            if (satData.type === 'G') {
                for (let i in header.params) {
                    satData.data[header.params[i]] = line[i].substr(0, 2) === '3&'
                        ? parseInt(line[i].substr(2)) / 1000
                        : null;
                }
                block.sat.push(satData);
                block.satNum.push(satData.num);
            }
        });
        return block;
    },
}
