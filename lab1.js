const readline = require('readline');
const {createReadStream} = require('fs');
const Iter = require('es-iter');

const rl = readline.createInterface({
    input: createReadStream('lab1.txt'),
});

let matrix = []; // Текущая расширенная матрица
let arMatrix = {}; // Все варианты матриц
let enumVar = []; // Последовательность для первого набора базисных неизвестных

const arrayDiff = (a, b) => {
    return a.filter(function (i) {
        return b.indexOf(i) < 0;
    });
};

const clone = (obj) => {
    return JSON.parse(JSON.stringify(obj));
};

const round = (num, precision) => {
    const multi = Number('1e' + precision);
    return Math.round(num * multi) / multi;
};

const roundMatrix = (matrix) => {
    for (let row in matrix) {
        for (let col in matrix[row].params) {
            matrix[row].params[col] = round(matrix[row].params[col], 5);
        }
        matrix[row].equal = round(matrix[row].equal, 5);
    }
    return matrix;
};

const resolveStep = (row, col, addEnum = false) => {
    const val = matrix[row].params[col];
    // Если разрешающий элемент равен 0, переходим сразу на следующий шаг
    if (val === 0) {
        return false;
    }
    // Если разрешающий элемент не равен единице, делим ведущую строку на него
    if (val !== 1) {
        for (let i in matrix[row].params) {
            matrix[row].params[i] /= val;
        }
        matrix[row].equal /= val;
    }
    // Получаем единичный столбец
    for (let i in matrix) {
        i = parseInt(i);
        // Обрабатываем все строки, кроме ведущей
        if (i !== row) {
            const multi = 0 - matrix[i].params[col]; // Множитель
            for (let j in matrix[i].params) {
                matrix[i].params[j] += matrix[row].params[j] * multi;
            }
            matrix[i].equal += matrix[row].equal * multi;
        }
    }
    if (addEnum) {
        enumVar.push(col);
    }
    return true;
};

rl
    .on('line', line => {
        // Получаем расширенную матрицу из файла построчно
        const [k, v] = line.split(' | ');
        matrix.push({
            params: k.split(' ').map(item => {
                return parseInt(item);
            }),
            equal: parseInt(v),
        });
    })
    .on('close', () => {
        // Приводим матрицу к первому базисному виду (перебираем неизвестные по очереди)
        let rowCount = 0; // Счетчик строк
        let columnCount = 0; // Счетчик столбцов
        const len = matrix[0].params.length;
        while (rowCount < matrix.length && columnCount < len) {
            if (resolveStep(rowCount, columnCount, true)) {
                rowCount++;
            }
            columnCount++;
        }
        // Выбрасываем нулевые строки
        for (let i in matrix) {
            let isZero = true;
            for (let j in matrix[i].params) {
                isZero = isZero && matrix[i].params[j] === 0;
            }
            if (matrix[i].equal !== 0) {
                if (isZero) {
                    console.error('Система несовместна');
                    return;
                }
                isZero = false;
            }
            if (isZero) {
                matrix.splice(i, 1);
            }
        }
        arMatrix[enumVar.join('')] = roundMatrix(matrix);
        const baseMatrix = clone(matrix);
        // Генерируем все возможные варианты базисных неизвестных
        const iterator = Iter.range(len).permutations();
        const matrixLen = matrix.length;
        for (let seq of iterator) {
            // Находим базисное решение, если его еще нет для этой последовательности
            let baseSeq = seq.splice(0, matrixLen);
            baseSeq.sort();
            const index = baseSeq.join('');
            if (arMatrix[index] === undefined) {
                let oldSeq = arrayDiff(enumVar, baseSeq); // Индексы неизвестных, которые станут свободными
                let newSeq = arrayDiff(baseSeq, enumVar); // Индексы неизвестных, которые станут базисными
                matrix = clone(baseMatrix);
                let resolved = true;
                for (let i in oldSeq) {
                    resolved = resolved && resolveStep(enumVar.indexOf(oldSeq[i]), newSeq[i]);
                }
                if (resolved) {
                    arMatrix[index] = roundMatrix(matrix);
                }
            }
        }
        arMatrix = Object.values(arMatrix);
        for (let mat of arMatrix) {
            console.log(mat);
        }
    });
