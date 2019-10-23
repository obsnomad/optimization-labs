const readline = require('readline');
const {createReadStream, createWriteStream} = require('fs');
const Iter = require('es-iter');
const Fraction = require('fraction.js');
const cTable = require('console.table');

const rl = readline.createInterface({
    input: createReadStream('lab1.txt'),
});
const stream = createWriteStream('lab1out.txt');

let matrix = []; // Текущая расширенная матрица
let arResult = {}; // Все решения
let enumVar = []; // Последовательность для первого набора базисных переменных
let targetFunc = []; // Целевая функция
const arrayDiff = (a, b) => {
    return a.filter(function (i) {
        return b.indexOf(i) < 0;
    });
};

const clone = obj => {
    return JSON.parse(JSON.stringify(obj));
};

const fraction = a => {
    return new Fraction(a);
};

let optimum = {
    index: null,
    value: fraction(0),
};

const getTable = (index, counter) => {
    const result = arResult[index];
    const matrix = result.matrix;
    const keys = result.base;
    let outMatrix = [];
    let base = [];
    let free = [];
    let res = [];
    for (let i in matrix) {
        let row = {};
        for (let j in matrix[i].params) {
            j = parseInt(j);
            const key = `x${j + 1}`;
            if (keys.indexOf(j) >= 0 && base.indexOf(key) < 0) {
                base.push(key);
            } else if (keys.indexOf(j) < 0 && free.indexOf(key) < 0) {
                free.push(key);
            }
            row[`x${j + 1}`] = fraction(matrix[i].params[j]).toFraction();
        }
        row['='] = fraction(matrix[i].equal).toFraction();
        outMatrix.push(row);
    }
    base.sort();
    free.sort();
    for (let i of result.result) {
        res.push(fraction(i).toFraction());
    }
    return cTable.getTable(
        `Матрица №${counter}\n`,
        outMatrix,
        `${base.join(', ')} - базисные переменные`, `${free.join(', ')} - свободные переменные\n`,
        `Решение: (${res.join('; ')}) - ${!result.isReference ? 'не ' : ''}опорное${index === optimum.index ? ', ОПТИМАЛЬНОЕ' : ''}`,
        `Значение z: ${result.target.toFraction()}\n\n`,
    );
};

const resolveStep = (row, col, addEnum = false) => {
    const val = fraction(matrix[row].params[col]);
    // Если разрешающий элемент равен 0, переходим сразу на следующий шаг
    if (val.equals(0)) {
        return false;
    }
    // Если разрешающий элемент не равен единице, делим ведущую строку на него
    if (!val.equals(1)) {
        for (let i in matrix[row].params) {
            matrix[row].params[i] = fraction(matrix[row].params[i]).div(val);
        }
        matrix[row].equal = fraction(matrix[row].equal).div(val);
    }
    // Получаем единичный столбец
    for (let i in matrix) {
        i = parseInt(i);
        // Обрабатываем все строки, кроме ведущей
        if (i !== row) {
            const multi = fraction(matrix[i].params[col]).neg(); // Множитель
            for (let j in matrix[i].params) {
                matrix[i].params[j] = fraction(matrix[i].params[j]).add(fraction(matrix[row].params[j]).mul(multi));
            }
            matrix[i].equal = fraction(matrix[i].equal).add(fraction(matrix[row].equal).mul(multi));
        }
    }
    if (addEnum) {
        enumVar.push(col);
    }
    return true;
};

const resolveMatrix = (matrix, base, matrixIndex) => {
    let result = [];
    let isReference = true;
    let target = fraction(0);
    for (let i = 0; i < matrix[0].params.length; i++) {
        i = parseInt(i);
        let index = base.indexOf(i);
        let res = index >= 0 ? matrix[index].equal : 0;
        isReference = isReference && res >= 0;
        result.push(res);
        target = target.add(fraction(res).mul(targetFunc[i]));
    }
    if (isReference && target.compare(optimum.value) > 0) {
        optimum.index = matrixIndex;
        optimum.value = target;
    }
    return {
        result,
        isReference,
        target,
    };
};

rl
    .on('line', line => {
        // Получаем расширенную матрицу из файла построчно
        if (line.substr(0, 1) === 't') {
            // С символа 't' начинается целевая функция
            line.split(' ').map(item => {
                if (item !== 't') {
                    targetFunc.push(fraction(item));
                }
            });
        } else {
            const [k, v] = line.split(' | ');
            matrix.push({
                params: k.split(' ').map(item => {
                    return fraction(item);
                }),
                equal: fraction(v),
            });
        }
    })
    .on('close', () => {
        // Приводим матрицу к первому базисному виду (перебираем переменные по очереди)
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
                isZero = isZero && matrix[i].params[j].equals(0);
            }
            if (!matrix[i].equal.equals(0)) {
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
        let index = enumVar.join('');
        arResult[index] = {
            matrix,
            base: enumVar,
            ...resolveMatrix(matrix, enumVar, index),
        };
        const baseMatrix = clone(matrix);
        // Генерируем все возможные варианты базисных переменных
        const iterator = Iter.range(len).permutations();
        const matrixLen = matrix.length;
        for (let seq of iterator) {
            // Находим базисное решение, если его еще нет для этой последовательности
            let baseSeq = seq.splice(0, matrixLen);
            baseSeq.sort();
            const index = baseSeq.join('');
            if (arResult[index] === undefined) {
                let oldSeq = arrayDiff(enumVar, baseSeq); // Индексы переменных, которые станут свободными
                let newSeq = arrayDiff(baseSeq, enumVar); // Индексы переменных, которые станут базисными
                matrix = clone(baseMatrix);
                let resolved = true;
                for (let i in oldSeq) {
                    resolved = resolved && resolveStep(enumVar.indexOf(oldSeq[i]), newSeq[i]);
                }
                if (resolved) {
                    arResult[index] = {
                        matrix,
                        base: baseSeq,
                        ...resolveMatrix(matrix, baseSeq, index),
                    };
                }
            }
        }
        let keys = Object.keys(arResult);
        let counter = 0;
        keys.sort();
        for (let i of keys) {
            stream.write(getTable(i, ++counter));
        }
        stream.end();
    });
