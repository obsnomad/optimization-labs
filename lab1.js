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
let arMatrix = {}; // Все варианты матриц
let enumVar = []; // Последовательность для первого набора базисных неизвестных

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

const getTable = (matrix, keys) => {
   let outMatrix = [];
   let base = [];
   let free = [];
   for (let i in matrix) {
       let row = {};
       for (let j in matrix[i].params) {
           const key = `x${parseInt(j) + 1}`;
           if (keys.indexOf(j) >= 0 && base.indexOf(key) < 0) {
               base.push(key);
           }
           else if (keys.indexOf(j) < 0 && free.indexOf(key) < 0) {
               free.push(key);
           }
           row[`x${parseInt(j) + 1}`] = matrix[i].params[j].toFraction();
       }
       row['='] = matrix[i].equal.toFraction();
       outMatrix.push(row);
   }
   base.sort();
   free.sort();
   return cTable.getTable(`${base.join(', ')} - базисные неизвестные`, `${free.join(', ')} - свободные неизвестные`, outMatrix);
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

rl
    .on('line', line => {
        // Получаем расширенную матрицу из файла построчно
        const [k, v] = line.split(' | ');
        matrix.push({
            params: k.split(' ').map(item => {
                return fraction(item);
            }),
            equal: fraction(v),
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
        arMatrix[enumVar.join('')] = matrix;
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
                    arMatrix[index] = matrix;
                }
            }
        }
        let keys = Object.keys(arMatrix);
        let counter = 0;
        keys.sort();
        for (let i of keys) {
            stream.write(`Матрица №${++counter}\n`);
            stream.write(getTable(arMatrix[i], i.split('')));
        }
        stream.end();
    });
