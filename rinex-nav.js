import {readFileSync} from 'fs';
import moment from 'moment';
import config from './config';
import {parseNumbers, parseDate} from './helper';

export default {
    navData: [],
    sp3Data: [],

    m: 3.986005e14,
    omegaZ: 7.2921151467e-5,

    header: {
        startRow: null,
        leapSeconds: null,
        ionAlpha: null,
        ionBeta: null,
        A0: null,
        A1: null,
        T: null,
        W: null,
    },

    data: {},
    checkedData: {},

    init() {
        this.navData = readFileSync(config.nav).toString().split('\n');
        this.sp3Data = readFileSync(config.sp3).toString().split('\n');
        this.parseHeader();
        this.parseData();
    },

    parseHeader() {
        let row = 0;
        while (this.navData[row].indexOf('END OF HEADER') < 0) {
            const line = this.navData[row];
            const value = line.substr(0, 60);
            const name = line.substr(60);
            switch(name) {
                case 'LEAP SECONDS':
                    this.header.leapSeconds = parseInt(value.match(/\d+/)[0]);
                    break;
                case 'ION ALPHA':
                    this.header.ionAlpha = parseNumbers(value);
                    break;
                case 'ION BETA':
                    this.header.ionBeta = parseNumbers(value);
                    break;
                case 'DELTA-UTC: A0,A1,T,W':
                    const [A0, A1, T, W] = parseNumbers(value);
                    this.header = {...this.header, ...{A0, A1, T, W}};
                    break;
            }
            row++;
        }
        this.header.startRow = ++row;
    },

    newton(eps, e0, MK) {
        let Ecurr = 0;
        let Eold = MK;
        while ((Math.abs(Ecurr - Eold)) > eps) {
            let Etemp = Ecurr;
            Ecurr = Eold + ((MK - Eold + e0 * Math.sin(Eold)) / (1 - e0 * Math.cos(Eold)));
            Eold = Etemp;
        }
        return Ecurr;
    },

    calculate(item) {
        const {
            sqrtA,
            Toe,
            DeltaN,
            M0,
            e0,
            omega,
            Cuc,
            Cus,
            Crc,
            Crs,
            Cic,
            Cis,
            I0,
            IDOT,
            OMEGA,
            OMEGADOT,
        } = item;
        const A = Math.pow(sqrtA, 2);
        const N = Math.floor(Toe / 86400);
        const t = N * 86400 + config.Tpc.getUTCHours() * 3600 + config.Tpc.getUTCMinutes() * 60 + config.Tpc.getUTCSeconds();
        let tK = t - Toe;
        if (tK > 302400) {
            tK -= 604800;
        } else if (tK < -302400) {
            tK += 604800;
        }
        // Скорректированное среднее движение (n)
        const n = Math.sqrt(this.m / Math.pow(A, 3)) + DeltaN;
        // Значение средней аномалии (MK)
        const MK = M0 + n * tK;
        // Эксцентрическая аномалия (EK)
        const EK = this.newton(0.001, e0, MK);
        // Производная эксцентрической аномалии (EK1)
        const EK1 = n / (1 - e0 * Math.cos(EK));
        // Истинная аномалия (THETAK)
        const THETAK = Math.atan2(Math.sqrt(1 - Math.pow(e0, 2)) * Math.sin(EK), (Math.cos(EK) - e0));
        // Аргумент широты (PHIK)
        const PHIK = THETAK + omega;
        // Производная аргумента широты (PHIK1)
        const PHIK1 = Math.sqrt(1 - Math.pow(e0, 2)) * EK1 / (1 - e0 * Math.cos(EK));
        // Исправленный аргумент широты (UK)
        const DeltaUK = Cuc * Math.cos(2 * PHIK) + Cus * Math.sin(2 * PHIK);
        const UK = PHIK + DeltaUK;
        // Производная исправленного аргумента широты (UK1)
        const UK1 = PHIK1 * (1 + 2 * (Cuc * Math.cos(2 * PHIK) - Cus * Math.sin(2 * PHIK)));
        // Текущее значение исправленного радиус-вектора (rK)
        const DeltarK = Crc * Math.cos(2 * PHIK) + Crs * Math.sin(2 * PHIK);
        const rK = A * (1 - e0 * Math.cos(EK)) + DeltarK;
        // Производная радиус-вектора (rK1)
        const rK1 = A * e0 * EK1 * Math.sin(EK) + 2 * PHIK1 * (Crc * Math.cos(2 * PHIK) + Crs * Math.sin(2 * PHIK));
        // Исправленный угол наклона орбиты (IK)
        const DeltaIK = Cic * Math.cos(2 * PHIK) + Cis * Math.sin(2 * PHIK);
        const IK = I0 + DeltaIK + IDOT * tK;
        // Производная угла наклона орбиты (IK1)
        const IK1 = IDOT + 2 * PHIK1 * (Cis * Math.cos(2 * PHIK) + Cic * Math.sin(2 * PHIK));
        // Вектор местоположения спутника в орбитальной плоскости (XPHIK, YPHIK)
        const XPHIK = rK * Math.cos(UK);
        const YPHIK = rK * Math.sin(UK);
        // Производная вектора местоположения спутника в орбитальной плоскости (XPHIK1, YPHIK1)
        const XPHIK1 = rK1 * Math.cos(UK) - YPHIK * UK1;
        const YPHIK1 = rK1 * Math.sin(UK) - XPHIK * UK1;
        // Исправленная долгота восходящего узла орбиты (OMEGAK)
        const OMEGAK = OMEGA + (OMEGADOT - this.omegaZ) * tK - this.omegaZ * Toe;
        // Производная долготы восходящего узла орбиты (OMEGAK1)
        const OMEGAK1 = OMEGADOT - this.omegaZ;
        // Координаты КА на момент времени tK
        const XSVK = XPHIK * Math.cos(OMEGAK) - YPHIK * Math.cos(IK) * Math.sin(OMEGAK);
        const YSVK = XPHIK * Math.sin(OMEGAK) + YPHIK * Math.cos(IK) * Math.cos(OMEGAK);
        const ZSVK = YPHIK * Math.sin(IK);
        // Скорости на момент времени tK
        const XSVK1 = -OMEGAK1 * YSVK + XPHIK1 * Math.cos(OMEGAK) - (YPHIK1 * Math.cos(IK) - YPHIK * IK1 * Math.sin(IK)) * Math.sin(OMEGAK);
        const YSVK1 = OMEGAK1 * XSVK + XPHIK1 * Math.sin(OMEGAK) + (YPHIK1 * Math.cos(IK) - YPHIK * IK1 * Math.sin(IK)) * Math.cos(OMEGAK);
        const ZSVK1 = YPHIK1 * IK1 * Math.sin(IK) + YPHIK1 * Math.sin(IK);
        return {
            EK,
            XSVK,
            YSVK,
            ZSVK,
            XSVK1,
            YSVK1,
            ZSVK1,
        };
    },

    parseData() {
        for (let i = this.header.startRow; i < this.navData.length; i += 8) {
            if (this.navData[i]) {
                let numbers = [];
                for (let j = 0; j < 8; j++) {
                    numbers = [...numbers, ...parseNumbers(this.navData[i + j])];
                }
                let Toc = parseDate(numbers.slice(1, 7));
                if (Toc.toLocaleDateString() === config.Tpc.toLocaleDateString()) {
                    let item = {
                        Toc: parseDate(numbers.slice(1, 7)),
                        DeltaS: numbers[7],
                        VS: numbers[8],
                        aS: numbers[9],
                        IODE: numbers[10],
                        Crs: numbers[11],
                        DeltaN: numbers[12],
                        M0: numbers[13],
                        Cuc: numbers[14],
                        e0: numbers[15],
                        Cus: numbers[16],
                        sqrtA: numbers[17],
                        Toe: numbers[18],
                        Cic: numbers[19],
                        OMEGA: numbers[20],
                        Cis: numbers[21],
                        I0: numbers[22],
                        Crc: numbers[23],
                        omega: numbers[24],
                        OMEGADOT: numbers[25],
                        IDOT: numbers[26],
                        CodeL2: numbers[27],
                        Ngps: numbers[28],
                        FlagL2: numbers[29],
                        Acc: numbers[30],
                        Cond: numbers[31],
                        TGD: numbers[32],
                        IODC: numbers[33],
                        TT: numbers[34],
                        ApxInt: numbers[35],
                    };
                    this.data[`PG${('' + numbers[0]).padStart(2, '0')}`] = {
                        ...item,
                        ...this.calculate(item),
                    };
                }
            }
        }
    },

    checkData() {
        let curDate;
        for (let i = 22; i < this.sp3Data.length; i++) {
            if (this.sp3Data[i]) {
                if (this.sp3Data[i].substr(0, 1) === '*') {
                    curDate = parseDate(parseNumbers(this.sp3Data[i]), false);
                }
                else if (curDate !== undefined && this.sp3Data[i].substr(0, 2) === 'PG') {
                    let sat = this.sp3Data[i].substr(0, 4);
                    if (this.data[sat] !== undefined) {
                        if (this.checkedData[sat] === undefined) {
                            this.checkedData[sat] = {};
                        }
                        let [x, y, z] = parseNumbers(this.sp3Data[i].substr(4));
                        // Убрать условие, если нужно выгрузить таблицы для всех значений времени
                        if (curDate.getTime() === config.Tpc.getTime()) {
                            this.checkedData[sat][curDate.getTime() / 1000] = {
                                date: moment(curDate).utc().format('DD.MM.YYYY HH:mm:ss'),
                                x,
                                y,
                                z,
                                dx: this.data[sat].XSVK / 1000 - x,
                                dy: this.data[sat].YSVK / 1000 - y,
                                dz: this.data[sat].ZSVK / 1000 - z,
                            };
                        }
                    }
                }
            }
        }
    },
}
