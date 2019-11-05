const {readFileSync, createWriteStream} = require('fs');

const input = readFileSync('ab140100.10n').toString().split('\n');
const stream = createWriteStream('rtlab1out.txt');

const m = 3.986005;
const eps = 0.001;
const omegaZ = 7.2921151467e-5;

// Уточнить, как берется значение Tpc
const Tpc = new Date(Date.UTC(2010, 0, 3));

const parseNumbers = str => {
    return str.match(/(-?\d\.\d+D[+\-]\d{2})|(^\d+)|((?<= )\d+(?= ))|((?<= )\d+\.\d+)/g).map(num => {
        return parseFloat(num.replace(/d/i, 'e'));
    });
};

const parseDate = numbers => {
    const seconds = Math.floor(numbers[5]);
    return new Date(Date.UTC(
        (numbers[0] > 90 ? 1900 : 2000) + numbers[0],
        numbers[1] - 1,
        numbers[2],
        numbers[3],
        numbers[4],
        seconds,
        (numbers[5] - seconds) * 1000
    ));
};

const calculate = item => {
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
    const t = N * 86400 + Tpc.getUTCHours() * 3600 + Tpc.getUTCMinutes() * 60 + Tpc.getUTCSeconds();
    let tK = t - Toe;
    if (tK > 302400) {
        tK = tK - 604800;
    } else if (tK < -302400) {
        tK = tK + 604800;
    }
    const n = Math.sqrt(m / Math.pow(A, 3)) + DeltaN;
    const MK = M0 + n * tK;
    let EK = MK;
    let EK2;
    while (true) {
        EK2 = EK + (MK - EK + e0 * Math.sin(EK)) / (1 - e0 * Math.cos(EK));
        if (Math.abs(EK2 - EK) < eps) {
            break;
        }
        EK = EK2;
    }
    const EK1 = n / (1 - e0 * Math.cos(EK));
    const THETAK = Math.atan2(Math.sqrt(1 - Math.pow(e0,2)) * Math.sin(EK), (Math.cos(EK) - e0));
    const PHIK = THETAK + omega;
    const PHIK1 = Math.sqrt(1 - Math.pow(e0,2)) * EK1 / (1 - e0 * Math.cos(EK));
    const DeltaUK = Cuc * Math.cos(2 * PHIK) + Cus * Math.sin(2 * PHIK);
    const UK = PHIK + DeltaUK;
    const UK1 = PHIK1 * (1 + 2 * (Cuc * Math.cos(2 * PHIK) - Cus * Math.sin(2 * PHIK)));
    const DeltarK = Crc * Math.cos(2 * PHIK) + Crs * Math.sin(2 * PHIK);
    const rK = A * (1 - e0 * Math.cos(EK)) + DeltarK;
    const rK1 = A * e0 * EK1 * Math.sin(EK) + 2 * PHIK1 * (Crc * Math.cos(2 * PHIK) + Crs * Math.sin(2 * PHIK));
    const DeltaIK = Cic * Math.cos(2 * PHIK) + Cis * Math.sin(2 * PHIK);
    const IK = I0 + DeltaIK + IDOT * tK;
    const IK1 = IDOT + 2 * PHIK1 * (Cis * Math.cos(2 * PHIK) + Cic * Math.sin(2 * PHIK));
    const XPHIK = rK * Math.cos(UK);
    const YPHIK = tK * Math.sin(UK);
    const XPHIK1 = rK1 * Math.cos(UK) - YPHIK * UK1;
    const YPHIK1 = rK1 * Math.sin(UK) - XPHIK * UK1;
    const OMEGAK = OMEGA + (OMEGADOT - omegaZ) * tK - omegaZ * Toe;
    const OMEGAK1 = OMEGADOT - omegaZ;
    const XSVK = XPHIK * Math.cos(OMEGAK) - YPHIK * Math.cos(IK) * Math.sin(OMEGAK);
    const YSVK = XPHIK * Math.sin(OMEGAK) + YPHIK * Math.cos(IK) * Math.cos(OMEGAK);
    const ZSVK = YPHIK * Math.sin(IK);
    const XSVK1 = -OMEGAK1 * YSVK + XPHIK1 * Math.cos(OMEGAK) - (YPHIK1 * Math.cos(IK) - YPHIK * IK1 * Math.sin(IK)) * Math.sin(OMEGAK);
    const YSVK1 = OMEGAK1 * XSVK + XPHIK1 * Math.sin(OMEGAK) - (YPHIK1 * Math.cos(IK) - YPHIK * IK1 * Math.sin(IK)) * Math.cos(OMEGAK);
    const ZSVK1 = YPHIK1 * IK1 * Math.sin(IK) + YPHIK1 * Math.sin(IK);
    return {
        XSVK,
        YSVK,
        ZSVK,
    }
};

const leapSeconds = parseInt(input[2].match(/\d+/)[0]);
const ionAlpha = parseNumbers(input[4]);
const ionBeta = parseNumbers(input[5]);
const [A0, A1, T, W] = parseNumbers(input[6]);

let data = [];
for (let i = 8; i < input.length; i += 8) {
    if (input[i]) {
        let numbers = [];
        for (let j = 0; j < 8; j++) {
            numbers = [...numbers, ...parseNumbers(input[i + j])];
        }
        let Toc = parseDate(numbers.slice(1, 7));
        if (Toc.toLocaleDateString() === Tpc.toLocaleDateString()) {
            let item = {
                satNum: numbers[0],
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
            data.push({
                ...item,
                ...calculate(item),
            });
        }
    }
}

console.log({
    leapSeconds,
    ionAlpha,
    ionBeta,
    A0,
    A1,
    T,
    W,
    data: data[0],
});
